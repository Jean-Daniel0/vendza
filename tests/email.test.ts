import assert from 'node:assert/strict';
import { loadEmailConfig, esc, normalizeItems, orderConfirmedBuyer, newOrderVendor, deliveryConfirmedBuyer, deliveryConfirmedVendor, payoutSentVendor, payoutFailedAdmin, refundPaidBuyer, welcome, sendViaResend, EmailConfig } from '../server/email';
import { notifyOrderConfirmed, notifyDeliveryConfirmed, notifyPayoutSent, notifyPayoutFailed, notifyRefundPaid, notifyWelcome } from '../server/emailEvents';

const cfg: EmailConfig = { apiKey: 're_test_123', from: 'Vendza <notifications@vendza.store>', siteUrl: 'https://www.vendza.store' };

// --- configuration : sans clé ou sans expéditeur, tout est désactivé
assert.equal(loadEmailConfig({}), null);
assert.equal(loadEmailConfig({ RESEND_API_KEY: 'x' }), null);
assert.equal(loadEmailConfig({ EMAIL_FROM: 'a@b.c' }), null);
assert.equal(loadEmailConfig({ RESEND_API_KEY: ' k ', EMAIL_FROM: 'V <a@b.co>', BASE_URL: 'https://x.test/' })!.siteUrl, 'https://x.test');
console.log('  ✓ email: configuration (désactivé sans clé ni expéditeur)');

// --- modèles : échappement HTML, pas d'injection d'en-tête, pas d'emoji, version texte
const evil = { siteUrl: cfg.siteUrl, orderId: '49749283-4bc9-488a-9f05-e93ec2b01be5', total: 1500, shipping: 250, commune: 'Pétion-Ville', name: '<img src=x onerror=alert(1)>', vendorName: 'Boutique "X" & Cie',
  items: normalizeItems([{ productNom: '<script>alert(1)</script>', qte: 2, prix: 500 }, { name: 'Sac', quantity: 1, price: 500 }]) };
const all = [orderConfirmedBuyer(evil), newOrderVendor(evil), deliveryConfirmedBuyer(evil), deliveryConfirmedVendor(evil),
  payoutSentVendor({ siteUrl: cfg.siteUrl, orderId: evil.orderId, amount: 1250, name: evil.name }), payoutFailedAdmin({ siteUrl: cfg.siteUrl, orderId: evil.orderId, reason: '<b>solde</b>' }),
  refundPaidBuyer({ siteUrl: cfg.siteUrl, amount: 900, reference: '<i>MC1</i>', name: evil.name }), refundPaidBuyer({ siteUrl: cfg.siteUrl, amount: 900, method: 'card' }), welcome({ siteUrl: cfg.siteUrl, name: evil.name })];
for (const m of all) {
  assert.ok(!/<script|<img|<b>solde|<i>MC1/i.test(m.html), 'HTML non échappé : ' + m.subject);
  assert.ok(m.subject && m.text && !/[\r\n]/.test(m.subject));
  assert.ok(!/\p{Extended_Pictographic}/u.test(m.html + m.text + m.subject), 'emoji dans ' + m.subject);
}
assert.ok(orderConfirmedBuyer(evil).html.includes('&lt;script&gt;'));
assert.ok(orderConfirmedBuyer(evil).subject.includes('#49749283'));
assert.ok(orderConfirmedBuyer(evil).html.includes('1\u202f500 Gdes') || orderConfirmedBuyer(evil).html.includes('1 500 Gdes') || /1.500 Gdes/.test(orderConfirmedBuyer(evil).html));
assert.equal(normalizeItems(null).length, 0);
assert.equal(esc(`<>"'&`), '&lt;&gt;&quot;&#39;&amp;');
assert.ok(!/[\r\n]/.test(orderConfirmedBuyer({ ...evil, vendorName: 'a\r\nBcc: x@y.z' }).subject));
console.log('  ✓ email: modèles échappés, sans emoji, sujets sans retour à la ligne');

// --- envoi Resend (réseau simulé)
const calls: any[] = [];
const okFetch: any = async (url: string, init: any) => { calls.push({ url, init }); return { ok: true, json: async () => ({ id: 'em_1' }) }; };
const r1 = await sendViaResend(cfg, { to: 'a@b.co', rendered: { subject: 'S\nX', html: '<p>x</p>', text: 'x' }, idempotencyKey: 'k1' }, okFetch);
assert.deepEqual(r1, { ok: true, id: 'em_1' });
assert.equal(calls[0].url, 'https://api.resend.com/emails');
assert.equal(calls[0].init.headers.Authorization, 'Bearer re_test_123');
assert.equal(calls[0].init.headers['Idempotency-Key'], 'k1');
const body = JSON.parse(calls[0].init.body);
assert.deepEqual(body.to, ['a@b.co']); assert.equal(body.from, cfg.from); assert.equal(body.subject, 'S X');
const n0 = calls.length;
assert.equal((await sendViaResend(cfg, { to: 'pas une adresse', rendered: { subject: 's', html: 'h', text: 't' } }, okFetch)).ok, false);
assert.equal((await sendViaResend(cfg, { to: 'a@b.co\nbcc:x@y.z', rendered: { subject: 's', html: 'h', text: 't' } }, okFetch)).ok, false);
assert.equal(calls.length, n0, 'adresse invalide : aucun appel réseau');
const bad: any = async () => ({ ok: false, status: 403, json: async () => ({ message: 'domaine non vérifié' }) });
assert.deepEqual(await sendViaResend(cfg, { to: 'a@b.co', rendered: { subject: 's', html: 'h', text: 't' } }, bad), { ok: false, status: 403, error: 'domaine non vérifié' });
const down: any = async () => { throw new Error('ECONNRESET'); };
assert.equal((await sendViaResend(cfg, { to: 'a@b.co', rendered: { subject: 's', html: 'h', text: 't' } }, down)).ok, false);
console.log('  ✓ email: appel Resend (en-têtes, idempotence, adresse invalide, erreurs réseau)');

// --- événements : destinataires, anti-doublons, pannes sans conséquence
function fakeDb(opts: { noEmailFor?: string[]; logMissing?: boolean; orders?: any[] } = {}) {
  const log = new Map<string, any>();
  return {
    log,
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: opts.noEmailFor?.includes(id) ? {} : { email: `${id}@test.dev`, user_metadata: {} } } }) } },
    from(table: string) {
      return {
        insert: async (row: any) => {
          if (table !== 'email_log') return { error: null };
          if (opts.logMissing) return { error: { code: '42P01', message: 'relation does not exist' } };
          if (log.has(row.dedupe_key)) return { error: { code: '23505', message: 'duplicate key value' } };
          log.set(row.dedupe_key, row); return { error: null };
        },
        update: () => ({ eq: async () => ({ error: null }) }),
        delete: () => ({ eq: async (_c: string, k: string) => { log.delete(k); return { error: null }; } }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'orders' ? (opts.orders || [])[0] : { prenom: 'Marie' } }) }) }),
      };
    },
  };
}
const sent: any[] = [];
const mkDeps = (db: any, extra: any = {}) => ({ db, cfg, spacingMs: 0, adminEmail: 'admin@vendza.test', send: async (_c: any, m: any) => { sent.push(m); return { ok: true as const, id: 'em_' + sent.length }; }, ...extra });
const order = { id: '49749283-4bc9-488a-9f05-e93ec2b01be5', total_price: 2000, frais_livraison: 250, items: [{ productNom: 'Sac', qte: 1, prix: 1750 }], vendor_name: 'Boutique' };

// désactivé : aucun envoi
{ sent.length = 0; await notifyOrderConfirmed({ db: fakeDb(), cfg: null, spacingMs: 0 } as any, order, 'buyer1', 'vendor1'); assert.equal(sent.length, 0); }
// commande confirmée : un e-mail à l'acheteur, un au vendeur, jamais deux fois
{ sent.length = 0; const db = fakeDb(); const d = mkDeps(db);
  await notifyOrderConfirmed(d as any, order, 'buyer1', 'vendor1');
  assert.deepEqual(sent.map(m => m.to).sort(), ['buyer1@test.dev', 'vendor1@test.dev']);
  assert.match(sent.find(m => m.to === 'buyer1@test.dev').rendered.subject, /confirmée/); assert.match(sent.find(m => m.to === 'vendor1@test.dev').rendered.subject, /Nouvelle commande/);
  await notifyOrderConfirmed(d as any, order, 'buyer1', 'vendor1'); await notifyOrderConfirmed(d as any, order, 'buyer1', 'vendor1');
  assert.equal(sent.length, 2, 'webhook rejoué : pas de doublon'); }
// échec d'envoi : la réservation est retirée, un rejeu peut réessayer
{ sent.length = 0; const db = fakeDb(); let fail = true;
  const d = mkDeps(db, { send: async (_c: any, m: any) => { if (fail) return { ok: false as const, status: 500, error: 'boom' }; sent.push(m); return { ok: true as const }; } });
  await notifyOrderConfirmed(d as any, order, 'buyer1', null); assert.equal(sent.length, 0); assert.equal(db.log.size, 0);
  fail = false; await notifyOrderConfirmed(d as any, order, 'buyer1', null); assert.equal(sent.length, 1); }
// utilisateur sans adresse : ignoré ; table de journal absente : on envoie quand même
{ sent.length = 0; await notifyOrderConfirmed(mkDeps(fakeDb({ noEmailFor: ['buyer1'] })) as any, order, 'buyer1', 'vendor1'); assert.deepEqual(sent.map(m => m.to), ['vendor1@test.dev']);
  sent.length = 0; await notifyOrderConfirmed(mkDeps(fakeDb({ logMissing: true })) as any, order, 'buyer1', null); assert.equal(sent.length, 1); }
// une exception interne ne remonte jamais
{ const boom: any = { cfg, spacingMs: 0, db: { auth: { admin: { getUserById: async () => { throw new Error('db down'); } } }, from: () => { throw new Error('db down'); } } };
  await notifyOrderConfirmed(boom, order, 'b', 'v'); await notifyDeliveryConfirmed(boom, order.id); await notifyPayoutSent(boom, order.id, 'v', 100); await notifyRefundPaid(boom, 'r1', 'b', 10); assert.equal(await notifyWelcome(boom, 'u1', false), 'no-recipient'); }
console.log('  ✓ emailEvents: destinataires, anti-doublons, reprise après échec, pannes sans conséquence');

// livraison confirmée, virement, échec, remboursement, bienvenue
{ sent.length = 0; const db = fakeDb({ orders: [{ ...order, buyer_id: 'buyer1', vendor_id: 'vendor1' }] }); const d = mkDeps(db);
  await notifyDeliveryConfirmed(d as any, order.id); assert.deepEqual(sent.map(m => m.to).sort(), ['buyer1@test.dev', 'vendor1@test.dev']);
  sent.length = 0; await notifyPayoutSent(d as any, order.id, 'vendor1', 1800); await notifyPayoutSent(d as any, order.id, 'vendor1', 1800); assert.equal(sent.length, 1); assert.match(sent[0].rendered.subject, /1[\s\u202f\u00a0]?800 Gdes/);
  sent.length = 0; await notifyPayoutFailed(d as any, order.id, 'solde insuffisant'); assert.deepEqual(sent.map(m => m.to), ['admin@vendza.test']);
  sent.length = 0; await notifyPayoutFailed(mkDeps(db, { adminEmail: undefined }) as any, order.id); assert.equal(sent.length, 0);
  sent.length = 0; await notifyRefundPaid(d as any, 'r1', 'buyer1', 900, 'MC99'); await notifyRefundPaid(d as any, 'r1', 'buyer1', 900, 'MC99'); assert.equal(sent.length, 1);
  sent.length = 0; assert.equal(await notifyWelcome(d as any, 'u1', false), 'sent'); assert.equal(await notifyWelcome(d as any, 'u1', false), 'duplicate'); assert.equal(sent.length, 1); }
console.log('  ✓ emailEvents: livraison, virement, alerte admin, remboursement, bienvenue (une seule fois)');
