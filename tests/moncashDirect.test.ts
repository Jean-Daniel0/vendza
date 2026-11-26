import assert from 'node:assert/strict';
import { tryDirectPayment,
  moncashConfig, shouldUseDirect, makeMoncashOrderId, rootOrderId,
  createMoncashClient, confirmMoncashPayment, isPaymentSuccessful, MoncashError,
} from '../server/moncashDirect';

(async () => {
  // ---------- configuration ----------
  const dflt = moncashConfig({});
  assert.equal(dflt.provider, 'bazik');           // par défaut : Bazik, rien ne change
  assert.equal(dflt.mode, 'sandbox');
  assert.equal(dflt.configured, false);
  assert.equal(dflt.apiBase, 'https://sandbox.moncashbutton.digicelgroup.com/Api');
  const live = moncashConfig({ MONCASH_PROVIDER: 'DIRECT', MONCASH_MODE: 'live', MONCASH_CLIENT_ID: 'id', MONCASH_CLIENT_SECRET: 's' });
  assert.equal(live.provider, 'direct');
  assert.equal(live.apiBase, 'https://moncashbutton.digicelgroup.com/Api');
  assert.equal(live.gatewayBase, 'https://moncashbutton.digicelgroup.com/Moncash-middleware');
  assert.equal(live.configured, true);
  assert.equal(moncashConfig({ MONCASH_PROVIDER: 'n importe quoi', MONCASH_MODE: 'prod' }).provider, 'bazik');
  assert.equal(moncashConfig({ MONCASH_MODE: 'prod' }).mode, 'sandbox'); // en cas de doute : sandbox

  // ---------- qui passe par MonCash direct ----------
  const u = (o: any) => shouldUseDirect({ provider: 'direct', mode: 'sandbox', isAdmin: false, isSubscription: false, ...o });
  assert.equal(u({}), false);                                   // client en sandbox → Bazik
  assert.equal(u({ isAdmin: true }), true);                     // admin en sandbox → direct
  assert.equal(u({ mode: 'live' }), true);                      // live → tout le monde
  assert.equal(u({ isAdmin: true, isSubscription: true }), false); // abonnement → Bazik
  assert.equal(u({ provider: 'bazik', isAdmin: true }), false);

  // ---------- références ----------
  const mcId = makeMoncashOrderId('ORD-123', 1700000000000);
  assert.ok(mcId.startsWith('ORD-123_mc_'));
  assert.equal(rootOrderId(mcId), 'ORD-123');
  assert.equal(rootOrderId('ORD-123'), null);         // pas la nôtre
  assert.equal(rootOrderId('_mc_abc'), null);
  assert.equal(rootOrderId(undefined), null);
  assert.notEqual(makeMoncashOrderId('A', 1), makeMoncashOrderId('A', 2)); // un nouvel essai a une autre référence

  // ---------- faux MonCash ----------
  const calls: Array<{ url: string; init: any }> = [];
  let tokenTtl = 59;
  const payments: Record<string, any> = {};
  const fake = async (url: string, init: any = {}) => {
    calls.push({ url, init });
    const ok = (body: any, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
    if (url.endsWith('/oauth/token')) {
      if (!String(init.headers.Authorization).startsWith('Basic ')) return ok({}, 401);
      return ok({ access_token: 'tok' + calls.length, token_type: 'bearer', expires_in: tokenTtl });
    }
    if (init.headers.Authorization?.startsWith('Bearer ') !== true) return ok({}, 401);
    const body = JSON.parse(init.body);
    if (url.endsWith('/v1/CreatePayment')) return ok({ status: 202, mode: 'sandbox', payment_token: { token: 'PT/1 2', created: 1, expired: 2 } }, 202);
    if (url.endsWith('/v1/RetrieveOrderPayment')) { const p = payments[body.orderId]; return p ? ok({ status: 200, payment: p }) : ok({}, 404); }
    if (url.endsWith('/v1/RetrieveTransactionPayment')) {
      const p = Object.values(payments).find((x: any) => String(x.transaction_id) === String(body.transactionId));
      return p ? ok({ status: 200, payment: p }) : ok({}, 404);
    }
    return ok({}, 404);
  };

  let now = 1_000_000;
  const cfg = moncashConfig({ MONCASH_PROVIDER: 'direct', MONCASH_CLIENT_ID: 'id', MONCASH_CLIENT_SECRET: 'secret' });
  const client = createMoncashClient(cfg, fake as any, () => now);

  // jeton : identifiants en Basic, jamais dans l'URL ; jeton court réutilisé tant qu'il est valable
  await client.getToken();
  assert.equal(calls[0].init.headers.Authorization, 'Basic ' + Buffer.from('id:secret').toString('base64'));
  assert.ok(!calls[0].url.includes('secret'));
  assert.equal(calls[0].init.body, 'scope=read,write&grant_type=client_credentials');
  await client.getToken();
  assert.equal(calls.filter(c => c.url.endsWith('/oauth/token')).length, 1);
  now += 58_000;                                                  // il reste moins de 5 s : on en redemande un
  await client.getToken();
  assert.equal(calls.filter(c => c.url.endsWith('/oauth/token')).length, 2);

  // sans clés : erreur claire, aucun appel réseau
  const before = calls.length;
  await assert.rejects(() => createMoncashClient(moncashConfig({}), fake as any).getToken(), MoncashError);
  assert.equal(calls.length, before);

  // mauvaises clés
  const refused = createMoncashClient(cfg, (async () => ({ ok: false, status: 401, text: async () => '{}' })) as any);
  await assert.rejects(() => refused.getToken(), /jeton refusé/);

  // création de paiement : montant arrondi, adresse de redirection encodée
  const created = await client.createPayment({ amount: 1500.4, orderId: mcId });
  assert.equal(created.redirectUrl, 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=PT%2F1%202');
  const createCall = calls.filter(c => c.url.endsWith('/v1/CreatePayment')).pop()!;
  assert.deepEqual(JSON.parse(createCall.init.body), { amount: 1500, orderId: mcId });
  await assert.rejects(() => client.createPayment({ amount: 0, orderId: mcId }), /montant invalide/);
  await assert.rejects(() => client.createPayment({ amount: NaN, orderId: mcId }), /montant invalide/);

  // ---------- confirmation ----------
  assert.equal(isPaymentSuccessful({ message: 'successful' }), true);
  assert.equal(isPaymentSuccessful({ message: 'Successful ' }), true);
  assert.equal(isPaymentSuccessful({ message: 'pending' }), false);
  assert.equal(isPaymentSuccessful({}), false);
  assert.equal(isPaymentSuccessful(null), false);

  payments[mcId] = { reference: mcId, transaction_id: 987654, cost: 1500, message: 'successful', payer: '50937000000' };

  // par transactionId : la commande vient de la réponse de MonCash
  let r = await confirmMoncashPayment(client, { transactionId: '987654' });
  assert.deepEqual(r, { status: 'paid', rootOrderId: 'ORD-123', moncashReference: mcId, transactionId: '987654', amount: 1500 });
  // par référence
  r = await confirmMoncashPayment(client, { orderRef: mcId });
  assert.equal(r.status, 'paid');
  // l'appelant ne peut pas imposer une autre commande : seule la réponse de MonCash compte
  r = await confirmMoncashPayment(client, { transactionId: '987654', orderRef: 'AUTRE-COMMANDE_mc_zzz' });
  assert.equal(r.status === 'paid' && r.rootOrderId, 'ORD-123');
  // paiement inconnu, non réussi, sans montant, ou d'une autre origine
  assert.equal((await confirmMoncashPayment(client, { transactionId: '111' })).status, 'unpaid');
  payments['P_mc_2'] = { reference: 'P_mc_2', transaction_id: 5, cost: 100, message: 'pending' };
  assert.equal((await confirmMoncashPayment(client, { transactionId: '5' })).status, 'unpaid');
  payments['P_mc_3'] = { reference: 'P_mc_3', transaction_id: 6, cost: 0, message: 'successful' };
  assert.equal((await confirmMoncashPayment(client, { transactionId: '6' })).status, 'unpaid');
  payments['SANSMARQUE'] = { reference: 'SANSMARQUE', transaction_id: 7, cost: 100, message: 'successful' };
  assert.equal((await confirmMoncashPayment(client, { transactionId: '7' })).status, 'invalid');
  assert.equal((await confirmMoncashPayment(client, { orderRef: 'SANSMARQUE' })).status, 'invalid');
  assert.equal((await confirmMoncashPayment(client, {})).status, 'invalid');
  assert.equal((await confirmMoncashPayment(client, { transactionId: '  ', orderRef: '' })).status, 'invalid');

  // --- secours Bazik : tryDirectPayment ne lève jamais d'exception
  {
    const ok = await tryDirectPayment({ createPayment: async () => ({ redirectUrl: 'https://x/redirect?token=t' }) }, { amount: 100, orderId: 'a_mc_1' });
    assert.deepEqual(ok, { ok: true, redirectUrl: 'https://x/redirect?token=t' });
    const refuse = await tryDirectPayment({ createPayment: async () => { throw new MoncashError('MonCash : jeton refusé (HTTP 401)', 401); } }, { amount: 100, orderId: 'a_mc_1' });
    assert.equal(refuse.ok, false); assert.ok(refuse.ok === false && refuse.reason.includes('401'));
    const panne = await tryDirectPayment({ createPayment: async () => { throw new Error('fetch failed'); } }, { amount: 100, orderId: 'a_mc_1' });
    assert.equal(panne.ok, false);
    // Avec le vrai client : clés absentes ou montant invalide -> échec propre (le serveur bascule alors sur Bazik)
    const noKeys = await tryDirectPayment(createMoncashClient(moncashConfig({ MONCASH_PROVIDER: 'direct' }), (async () => { throw new Error('ne doit pas être appelé'); }) as any), { amount: 100, orderId: 'a_mc_1' });
    assert.equal(noKeys.ok, false);
    const badAmount = await tryDirectPayment(createMoncashClient(moncashConfig({ MONCASH_PROVIDER: 'direct', MONCASH_CLIENT_ID: 'i', MONCASH_CLIENT_SECRET: 's' }), (async () => { throw new Error('ne doit pas être appelé'); }) as any), { amount: 0, orderId: 'a_mc_1' });
    assert.equal(badAmount.ok, false);
    console.log('  ✓ moncashDirect: en cas d\'échec de MonCash officiel, le serveur retombe sur Bazik sans erreur');
  }

  // --- phase de test : MONCASH_SANDBOX_FOR_ALL ouvre le sandbox à tous, jamais par défaut
  {
    assert.equal(moncashConfig({}).sandboxForAll, false); assert.equal(moncashConfig({ MONCASH_SANDBOX_FOR_ALL: 'true' }).sandboxForAll, true); assert.equal(moncashConfig({ MONCASH_SANDBOX_FOR_ALL: 'non' }).sandboxForAll, false);
    const base = { provider: 'direct' as const, mode: 'sandbox' as const, isSubscription: false };
    assert.equal(shouldUseDirect({ ...base, isAdmin: false }), false);                                   // défaut : le client reste sur Bazik
    assert.equal(shouldUseDirect({ ...base, isAdmin: false, sandboxForAll: true }), true);               // phase de test : tout le monde
    assert.equal(shouldUseDirect({ ...base, provider: 'bazik' as any, isAdmin: true, sandboxForAll: true }), false);   // interrupteur principal respecté
    assert.equal(shouldUseDirect({ ...base, isAdmin: false, sandboxForAll: true, isSubscription: true }), false);      // abonnements : toujours Bazik
    console.log('  ✓ moncashDirect: sandbox ouvert à tous seulement avec MONCASH_SANDBOX_FOR_ALL');
  }

  console.log('  ✓ moncashDirect: interrupteur, sandbox réservé à l\'admin, confirmation auprès de MonCash');
})().catch(e => { console.error(e); process.exit(1); });
