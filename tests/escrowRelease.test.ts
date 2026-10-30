import assert from 'node:assert/strict';
import { escrowDays, escrowStage, releaseDate, autoReleaseDelivery, runEscrowAutoRelease } from '../server/escrowRelease';

// ---------- faux client Supabase en mémoire (eq, in, lte, insert unique, update, select) ----------
class Q {
  mode = 'select'; f: Array<(r: any) => boolean> = []; values: any = null; returning = false; lim = Infinity;
  constructor(private db: Fake, private table: string) {}
  select() { if (this.mode !== 'select') this.returning = true; return this; }
  eq(c: string, v: any) { this.f.push(r => r[c] === v); return this; }
  in(c: string, vs: any[]) { this.f.push(r => vs.includes(r[c])); return this; }
  lte(c: string, v: any) { this.f.push(r => new Date(r[c]).getTime() <= new Date(v).getTime()); return this; }
  or(s: string) { const [col, , val] = s.split(',')[0].split('.'); this.f.push(r => String(r[col]) === val || String(r.payment_reference) === val); return this; }
  limit(n: number) { this.lim = n; return this; }
  update(v: any) { this.mode = 'update'; this.values = v; return this; }
  insert(v: any) { this.mode = 'insert'; this.values = v; return this; }
  async exec(): Promise<any> {
    const rows = this.db.t[this.table] ?? (this.db.t[this.table] = []);
    if (this.mode === 'select') return { data: rows.filter(r => this.f.every(g => g(r))).slice(0, this.lim).map(r => ({ ...r })), error: null };
    if (this.mode === 'update') { const hit = rows.filter(r => this.f.every(g => g(r))); hit.forEach(r => Object.assign(r, this.values)); return { data: this.returning ? hit.map(r => ({ ...r })) : null, error: null }; }
    if (this.mode === 'insert') {
      if (this.table === 'notification_log' && rows.some(r => r.key === this.values.key)) return { data: null, error: { code: '23505', message: 'duplicate' } };
      rows.push({ ...this.values }); return { data: null, error: null };
    }
    return { data: null, error: null };
  }
  maybeSingle() { return this.exec().then((r: any) => ({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error })); }
  then(a: any, b: any) { return this.exec().then(a, b); }
}
class Fake { t: Record<string, any[]> = {}; rpcs: any[] = []; from(n: string) { return new Q(this, n); } async rpc(name: string, args: any) { this.rpcs.push({ name, args }); return { data: null, error: null }; } }

const NOW = new Date('2026-11-10T15:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();
function world(opts: { shownDaysAgo?: number | null; order?: any; verified?: boolean; payoutOk?: boolean } = {}) {
  const db = new Fake();
  db.t.orders = [{ id: 'abcdef12-0000', buyer_id: 'B', client_id: 'B', vendor_id: 'V', status: 'payee', vendor_credited: false, total_price: 1000, qr_token: 'MC-1', items: [{ productId: 'P1', qte: 2 }], ...opts.order }];
  db.t.order_delivery_codes = opts.shownDaysAgo == null ? [] : [{ order_id: 'abcdef12-0000', code: 'ABCD2345', created_at: daysAgo(opts.shownDaysAgo) }];
  db.t.verified_payments = opts.verified === false ? [] : [{ reference: 'MC-1', amount: 1000 }];
  const pushes: any[] = []; const payouts: string[] = []; let ok = opts.payoutOk !== false;
  const send = async (ids: string[], title: string) => { pushes.push({ ids, title }); };
  const payout = async (o: any) => {
    payouts.push(o.id);
    if (ok) { (db.t.orders.find(x => x.id === o.id) as any).vendor_credited = true; return { status: 200, body: {} }; }
    return { status: 502, body: { error: 'MonCash indisponible' } };
  };
  return { db, pushes, payouts, deps: { db, send, payout }, setPayoutOk: (v: boolean) => { ok = v; } };
}
let n = 0; const t = async (name: string, fn: () => Promise<void> | void) => { await fn(); n++; console.log('  ✓', name); };
const orderOf = (w: any) => w.db.t.orders[0];

(async () => {
  console.log('logique du délai');
  await t('escrowDays : 7 par défaut, réglable entre 3 et 30', () => {
    assert.equal(escrowDays(undefined), 7); assert.equal(escrowDays('10'), 10); assert.equal(escrowDays(3), 3); assert.equal(escrowDays(30), 30);
    for (const bad of ['1', 2, '31', 'abc', '', null, -5, 0]) assert.equal(escrowDays(bad), 7);
  });
  await t('escrowStage : attendre jusqu\'à J+5, rappeler de J+5 à J+7, libérer à J+7', () => {
    assert.equal(escrowStage(daysAgo(0), NOW, 7), 'wait'); assert.equal(escrowStage(daysAgo(4.9), NOW, 7), 'wait');
    assert.equal(escrowStage(daysAgo(5), NOW, 7), 'remind'); assert.equal(escrowStage(daysAgo(6.9), NOW, 7), 'remind');
    assert.equal(escrowStage(daysAgo(7), NOW, 7), 'release'); assert.equal(escrowStage(daysAgo(40), NOW, 7), 'release');
    assert.equal(escrowStage('pas une date', NOW, 7), 'wait');
    assert.equal(releaseDate('2026-11-01T00:00:00Z', 7).toISOString(), '2026-11-08T00:00:00.000Z');
  });

  console.log('libération');
  await t('code affiché il y a 8 jours + paiement vérifié : libérée, virement une fois, stock décrémenté, deux notifications', async () => {
    const w = world({ shownDaysAgo: 8 });
    const r = await runEscrowAutoRelease(w.deps, NOW, 7);
    assert.equal(r.released, 1); assert.equal(orderOf(w).status, 'completed'); assert.ok(orderOf(w).auto_released_at); assert.equal(orderOf(w).reception_confirmed, true);
    assert.deepEqual(w.payouts, ['abcdef12-0000']); assert.equal(w.db.rpcs.length, 1); assert.deepEqual(w.db.rpcs[0].args, { p_product_id: 'P1', p_qty: 2 });
    assert.equal(w.pushes.length, 2); assert.deepEqual(w.pushes.map(p => p.ids[0]).sort(), ['B', 'V']);
    assert.equal(w.db.t.platform_messages.length, 2);
  });
  await t('stock déjà réservé au paiement : pas de seconde décrémentation', async () => {
    const w = world({ shownDaysAgo: 8, order: { stock_reserved: true } });
    await runEscrowAutoRelease(w.deps, NOW, 7); assert.equal(w.db.rpcs.length, 0); assert.equal(orderOf(w).status, 'completed');
  });
  await t('deuxième passage : aucun double virement ni double notification', async () => {
    const w = world({ shownDaysAgo: 8 });
    await runEscrowAutoRelease(w.deps, NOW, 7); const r2 = await runEscrowAutoRelease(w.deps, NOW, 7);
    assert.deepEqual(w.payouts, ['abcdef12-0000']); assert.equal(r2.released, 0); assert.equal(w.pushes.length, 2);
  });
  await t('JAMAIS sans code de livraison affiché (cas des 7 commandes de test de 120 jours)', async () => {
    const w = world({ shownDaysAgo: null, order: { created_at: daysAgo(120) } });
    const r = await runEscrowAutoRelease(w.deps, NOW, 7);
    assert.equal(r.released, 0); assert.equal(orderOf(w).status, 'payee'); assert.equal(w.payouts.length, 0);
  });
  await t('code affiché depuis moins de 5 jours : rien ne se passe', async () => {
    const w = world({ shownDaysAgo: 3 }); const r = await runEscrowAutoRelease(w.deps, NOW, 7);
    assert.equal(r.status, 'skipped'); assert.equal(orderOf(w).status, 'payee'); assert.equal(w.pushes.length, 0);
  });
  await t('paiement non vérifié : jamais libérée, jamais virée', async () => {
    const w = world({ shownDaysAgo: 30, verified: false }); const r = await runEscrowAutoRelease(w.deps, NOW, 7);
    assert.equal(r.released, 0); assert.equal(r.failed, 1); assert.equal(orderOf(w).status, 'payee'); assert.equal(w.payouts.length, 0);
  });
  for (const status of ['disputed', 'annulee', 'completed', 'pending']) {
    await t(`statut « ${status} » exclu de la libération`, async () => {
      const w = world({ shownDaysAgo: 30, order: { status, vendor_credited: status === 'completed' ? true : false } });
      const r = await runEscrowAutoRelease(w.deps, NOW, 7); assert.equal(r.released, 0); assert.equal(orderOf(w).status, status); assert.equal(w.payouts.length, 0);
    });
  }
  await t('déjà réglée au vendeur : exclue', async () => {
    const w = world({ shownDaysAgo: 30, order: { vendor_credited: true } }); await runEscrowAutoRelease(w.deps, NOW, 7); assert.equal(w.payouts.length, 0);
  });

  console.log('rappel à l\'acheteur');
  await t('à J+6 : un seul rappel, à l\'acheteur, avec la date de libération ; pas de libération', async () => {
    const w = world({ shownDaysAgo: 6 }); const r = await runEscrowAutoRelease(w.deps, NOW, 7);
    assert.equal(r.reminded, 1); assert.equal(r.released, 0); assert.equal(orderOf(w).status, 'payee');
    assert.deepEqual(w.pushes.map(p => p.ids), [['B']]); assert.match(w.db.t.platform_messages[0].message, /ABCDEF12/);
    const r2 = await runEscrowAutoRelease(w.deps, NOW, 7); assert.equal(r2.reminded, 0); assert.equal(w.pushes.length, 1);
  });

  console.log('virement en échec');
  await t('virement raté : commande terminée mais non créditée, nouvel essai au passage suivant, sans doublon', async () => {
    const w = world({ shownDaysAgo: 8, payoutOk: false });
    const r1 = await runEscrowAutoRelease(w.deps, NOW, 7);
    assert.equal(orderOf(w).status, 'completed'); assert.equal(orderOf(w).vendor_credited, false); assert.equal(r1.released, 1);
    w.setPayoutOk(true);
    const r2 = await runEscrowAutoRelease(w.deps, NOW, 7);
    assert.equal(r2.payoutRetried, 1); assert.equal(orderOf(w).vendor_credited, true);
    const r3 = await runEscrowAutoRelease(w.deps, NOW, 7); assert.equal(r3.payoutRetried, 0);
  });
  await t('une commande confirmée normalement par l\'acheteur (non automatique) n\'est jamais retentée par le système', async () => {
    const w = world({ shownDaysAgo: 8, order: { status: 'completed', vendor_credited: false } });
    const r = await runEscrowAutoRelease(w.deps, NOW, 7); assert.equal(r.payoutRetried, 0); assert.equal(w.payouts.length, 0);
  });
  await t('autoReleaseDelivery : commande inconnue = 404', async () => {
    const w = world({ shownDaysAgo: 8 }); const r = await autoReleaseDelivery(w.deps, 'inconnue'); assert.equal(r.status, 404);
  });
  console.log(`\n${n} tests OK`);
})().catch(e => { console.error(e); process.exit(1); });
