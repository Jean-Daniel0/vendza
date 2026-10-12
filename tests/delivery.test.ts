import assert from 'node:assert/strict';
import {
  confirmDelivery, getOrCreateDeliveryCode, assertPaymentVerified, recordVerifiedPayment, rootReference, isBuyerOf, isSellerOf, extractItems
} from '../server/delivery';

// ---------- faux client Supabase en mémoire ----------
function likeToRegex(p: string) { return new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$'); }
class Q {
  mode = 'select'; filters: Array<(r: any) => boolean> = []; values: any = null; returning = false; opts: any = {};
  constructor(private db: FakeDb, private table: string) {}
  select() { if (this.mode === 'select') return this; this.returning = true; return this; }
  eq(c: string, v: any) { this.filters.push(r => r[c] === v); return this; }
  or(s: string) {
    const preds = s.split(',').map(part => {
      const [col, op, ...rest] = part.split('.'); const val = rest.join('.');
      return op === 'eq' ? (r: any) => String(r[col]) === val : (r: any) => likeToRegex(val).test(String(r[col] ?? ''));
    });
    this.filters.push(r => preds.some(p => p(r))); return this;
  }
  update(v: any) { this.mode = 'update'; this.values = v; return this; }
  insert(v: any) { this.mode = 'insert'; this.values = v; return this; }
  upsert(v: any, o: any) { this.mode = 'upsert'; this.values = v; this.opts = o || {}; return this; }
  async exec(): Promise<{ data: any; error: any }> {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (this.mode === 'select') return { data: rows.filter(r => this.filters.every(f => f(r))).map(r => ({ ...r })), error: null };
    if (this.mode === 'update') {
      const hit = rows.filter(r => this.filters.every(f => f(r)));
      hit.forEach(r => Object.assign(r, this.values));
      return { data: this.returning ? hit.map(r => ({ ...r })) : null, error: null };
    }
    if (this.mode === 'insert') {
      const v = { ...this.values };
      const uniq = this.db.unique[this.table];
      if (uniq && rows.some(r => r[uniq] === v[uniq])) return { data: null, error: { code: '23505', message: 'duplicate' } };
      rows.push(v); return { data: [v], error: null };
    }
    if (this.mode === 'upsert') {
      const key = this.opts.onConflict; const i = rows.findIndex(r => r[key] === this.values[key]);
      if (i >= 0) Object.assign(rows[i], this.values); else rows.push({ ...this.values });
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
  maybeSingle() { return this.exec().then(r => ({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error })); }
  then(res: any, rej: any) { return this.exec().then(res, rej); }
}
class FakeDb {
  tables: Record<string, any[]> = {}; unique: Record<string, string> = { order_delivery_codes: 'order_id' };
  rpcCalls: any[] = [];
  from(t: string) { return new Q(this, t); }
  async rpc(name: string, args: any) { this.rpcCalls.push({ name, args }); return { data: null, error: null }; }
}

const BUYER = 'buyer-1', VENDOR = 'vendor-1', STRANGER = 'stranger-1';
function world(over: any = {}) {
  const db = new FakeDb();
  db.tables.orders = [{ id: 'A', buyer_id: BUYER, client_id: BUYER, vendor_id: VENDOR, status: 'payee', total_price: 1000, qr_token: 'MC-1', vendor_credited: false, items: [{ productId: 'P1', qte: 2 }], ...over }];
  db.tables.verified_payments = [{ reference: 'MC-1', amount: 1000, payment_method: 'moncash' }];
  const payouts: any[] = [];
  const payout = async (o: any) => { payouts.push(o.id); return { status: 200, body: { success: true } }; };
  return { db, payouts, deps: { db, payout } };
}
let n = 0; const t = async (name: string, fn: () => Promise<void> | void) => { await fn(); n++; console.log('  ✓', name); };

(async () => {
  console.log('helpers');
  await t('rootReference / isBuyerOf / isSellerOf / extractItems', () => {
    assert.equal(rootReference('MC-1_sub_2'), 'MC-1'); assert.equal(rootReference('MC-1_bz_xyz'), 'MC-1');
    assert.ok(isBuyerOf({ user_id: 'u' }, 'u')); assert.ok(!isBuyerOf({ vendor_id: 'u' }, 'u')); assert.ok(isSellerOf({ owner_id: 'u' }, 'u'));
    assert.deepEqual(extractItems({ items: JSON.stringify([{ product_id: 'p', quantity: 3 }]) }), [{ productId: 'p', qty: 3 }]);
  });

  console.log('confirmDelivery — autorisation');
  await t("le VENDEUR ne peut PAS libérer ses fonds (403)", async () => {
    const w = world(); const r = await confirmDelivery(w.deps, { orderId: 'A', callerId: VENDOR });
    assert.equal(r.status, 403); assert.equal(w.payouts.length, 0); assert.equal(w.db.tables.orders[0].status, 'payee');
  });
  await t('un inconnu ne peut pas confirmer (403)', async () => {
    const w = world(); const r = await confirmDelivery(w.deps, { orderId: 'A', callerId: STRANGER });
    assert.equal(r.status, 403); assert.equal(w.payouts.length, 0);
  });
  await t('commande introuvable (404)', async () => {
    const w = world(); assert.equal((await confirmDelivery(w.deps, { orderId: 'ZZZ', callerId: BUYER })).status, 404);
  });

  console.log('confirmDelivery — « pas d\'argent sorti sans argent entré »');
  await t('fausse commande « payee » SANS paiement vérifié : versement bloqué (409)', async () => {
    const w = world(); w.db.tables.verified_payments = [];
    const r = await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER });
    assert.equal(r.status, 409); assert.equal(w.payouts.length, 0); assert.equal(w.db.tables.orders[0].status, 'payee');
  });
  await t('montant payé (100) inférieur au total (1000) : bloqué', async () => {
    const w = world(); w.db.tables.verified_payments = [{ reference: 'MC-1', amount: 100 }];
    const r = await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER });
    assert.equal(r.status, 409); assert.equal(w.payouts.length, 0);
  });
  await t('panier multi-vendeurs : somme des commandes comparée au paiement', async () => {
    const w = world({ qr_token: 'MC-1_sub_1', total_price: 600 });
    w.db.tables.orders.push({ id: 'B', buyer_id: BUYER, vendor_id: 'vendor-2', status: 'payee', total_price: 600, qr_token: 'MC-1_sub_2' });
    w.db.tables.verified_payments = [{ reference: 'MC-1', amount: 1000 }]; // 600 + 600 > 1000
    assert.equal((await assertPaymentVerified(w.db, w.db.tables.orders[0]))?.status, 409);
    w.db.tables.verified_payments = [{ reference: 'MC-1', amount: 1200 }];
    assert.equal(await assertPaymentVerified(w.db, w.db.tables.orders[0]), null);
  });
  await t('recordVerifiedPayment enregistre la référence racine', async () => {
    const db = new FakeDb(); await recordVerifiedPayment(db, { reference: 'MC-9_bz_abc', method: 'moncash', amount: 500 });
    assert.deepEqual(db.tables.verified_payments[0], { reference: 'MC-9', payment_method: 'moncash', transaction_id: null, amount: 500 });
  });

  console.log('confirmDelivery — transition');
  await t('acheteur : succès, statut completed, 1 virement, stock décrémenté une fois', async () => {
    const w = world(); const r = await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER });
    assert.equal(r.status, 200); assert.equal(r.body.delivery, 'confirmed'); assert.equal(r.body.payout.ok, true);
    const o = w.db.tables.orders[0]; assert.equal(o.status, 'completed'); assert.equal(o.reception_confirmed, true); assert.equal(o.is_validated, true);
    assert.equal(w.payouts.length, 1); assert.deepEqual(w.db.rpcCalls, [{ name: 'decrement_product_stock', args: { p_product_id: 'P1', p_qty: 2 } }]);
  });
  await t('double clic simultané : UNE seule transition, UN seul décrément de stock', async () => {
    const w = world(); const [a, b] = await Promise.all([
      confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER }), confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER })]);
    assert.equal(w.db.rpcCalls.length, 1);
    assert.deepEqual([a.status, b.status].sort(), [200, 409].sort());
  });
  await t('virement échoué : livraison confirmée, virement signalé « en attente »', async () => {
    const w = world(); const deps = { db: w.db, payout: async () => ({ status: 400, body: { error: "Le vendeur n'a pas configuré son numéro MonCash." } }) };
    const r = await confirmDelivery(deps, { orderId: 'A', callerId: BUYER });
    assert.equal(r.status, 200); assert.equal(r.body.payout.ok, false); assert.equal(w.db.tables.orders[0].status, 'completed');
  });
  await t('commande déjà confirmée mais non versée : nouvel essai du virement (retried)', async () => {
    const w = world({ status: 'completed', vendor_credited: false }); const r = await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER });
    assert.equal(r.status, 200); assert.equal(r.body.retried, true); assert.equal(w.payouts.length, 1); assert.equal(w.db.rpcCalls.length, 0);
  });
  await t('commande déjà versée (vendor_credited) : 409', async () => {
    const w = world({ status: 'completed', vendor_credited: true });
    assert.equal((await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER })).status, 409); assert.equal(w.payouts.length, 0);
  });
  for (const s of ['annulee', 'disputed', 'attente']) {
    await t(`statut « ${s} » : pas de libération (409)`, async () => {
      const w = world({ status: s }); assert.equal((await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER })).status, 409); assert.equal(w.payouts.length, 0);
    });
  }

  console.log('code de livraison (QR du vendeur scanné par l\'acheteur)');
  await t('seul le vendeur obtient le code ; il est stable et à 8 caractères', async () => {
    const w = world();
    assert.equal((await getOrCreateDeliveryCode(w.db, 'A', BUYER)).status, 403);
    assert.equal((await getOrCreateDeliveryCode(w.db, 'A', STRANGER)).status, 403);
    const a = await getOrCreateDeliveryCode(w.db, 'A', VENDOR); const b = await getOrCreateDeliveryCode(w.db, 'A', VENDOR);
    assert.equal(a.status, 200); assert.match(a.body.code, /^[A-HJ-NP-Z2-9]{8}$/); assert.equal(a.body.code, b.body.code);
  });
  await t('pas de code pour une commande non payée / déjà livrée', async () => {
    const w = world({ status: 'completed' }); assert.equal((await getOrCreateDeliveryCode(w.db, 'A', VENDOR)).status, 409);
  });
  await t('mauvais code : 403 ; bon code (casse/espaces ignorés) : succès', async () => {
    const w = world(); const { body } = await getOrCreateDeliveryCode(w.db, 'A', VENDOR);
    assert.equal((await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER, code: 'WRONG123' })).status, 403); assert.equal(w.payouts.length, 0);
    const ok = await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER, code: ' ' + body.code.toLowerCase().slice(0, 4) + '-' + body.code.slice(4) + ' ' });
    assert.equal(ok.status, 200); assert.equal(w.payouts.length, 1);
  });
  await t("code fourni mais le vendeur n'en a pas affiché : 409", async () => {
    const w = world(); assert.equal((await confirmDelivery(w.deps, { orderId: 'A', callerId: BUYER, code: 'ABCDEFGH' })).status, 409);
  });

  console.log(`\n${n} tests OK`);
})().catch(e => { console.error('\n✗ ÉCHEC:', e.message); console.error(e.stack?.split('\n').slice(0, 4).join('\n')); process.exit(1); });
