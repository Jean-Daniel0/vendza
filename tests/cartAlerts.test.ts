import assert from 'node:assert/strict';
import { runCartReminders, runLowStockAlerts } from '../server/cartAlerts';

function fakeDb(tables: Record<string, any[]>) {
  const q = (name: string) => {
    let filters: Array<(r: any) => boolean> = []; let op: (() => any) | null = null;
    const match = () => tables[name].filter(r => filters.every(f => f(r)));
    const api: any = {
      select: () => api, limit: () => api,
      eq: (c: string, v: any) => { filters.push(r => r[c] === v); return api; },
      in: (c: string, v: any[]) => { filters.push(r => v.includes(r[c])); return api; },
      gt: (c: string, v: number) => { filters.push(r => Number(r[c]) > v); return api; },
      lte: (c: string, v: number) => { filters.push(r => Number(r[c]) <= v); return api; },
      insert: (row: any) => { op = () => { if (name === 'notification_log' && tables[name].some(r => r.key === row.key)) return { error: { message: 'dup' } }; tables[name].push(row); return { error: null }; }; return api; },
      update: (patch: any) => { op = () => { match().forEach(r => Object.assign(r, patch)); return { error: null }; }; return api; },
      then: (res: any, rej: any) => Promise.resolve(op ? op() : { data: match(), error: null }).then(res, rej),
    };
    return api;
  };
  return { from: (n: string) => q(n) };
}
const now = new Date('2026-10-24T16:00:00Z');                 // 12h à Port-au-Prince
const ago = (h: number) => new Date(now.getTime() - h * 3600e3).toISOString();
const mk = () => ({
  products: [{ id: 'p1', name: 'Robe', stock: 2, is_active: true, status: 'published' }, { id: 'p2', name: 'Casque', stock: 50, is_active: true, status: 'published' }, { id: 'p3', name: 'Épuisé', stock: 0, is_active: true, status: 'published' }],
  profiles: [{ id: 'u1', notif_commandes: true }, { id: 'u2', notif_commandes: false }, { id: 'u3', notif_commandes: true }],
  cart_items: [
    { id: 'c1', user_id: 'u1', product_id: 'p1', quantity: 1, updated_at: ago(5), stock_alert_at: null },
    { id: 'c2', user_id: 'u1', product_id: 'p2', quantity: 1, updated_at: ago(5), stock_alert_at: null },
    { id: 'c3', user_id: 'u2', product_id: 'p1', quantity: 1, updated_at: ago(5), stock_alert_at: null },   // a désactivé les notifications
    { id: 'c4', user_id: 'u3', product_id: 'p2', quantity: 1, updated_at: ago(0.5), stock_alert_at: null }, // panier modifié il y a 30 min
  ],
  notification_log: [] as any[], platform_messages: [] as any[],
});
const sent: any[] = []; const send = async (ids: string[], t: string, m: string, c: string) => { sent.push({ ids, t, m, c }); };

(async () => {
  // --- rappel de panier
  let t = mk(); sent.length = 0;
  let r = await runCartReminders(fakeDb(t), send, now);
  assert.equal(r.status, 'sent'); assert.equal(r.recipients, 1);
  assert.deepEqual(sent[0].ids, ['u1']);                                   // pas u2 (désactivé), pas u3 (panier encore actif)
  assert.match(sent[0].m, /^2 articles : Robe et 1 autre\./);
  assert.equal(t.platform_messages[0].audience, 'u1');
  r = await runCartReminders(fakeDb(t), send, now); assert.equal(r.status, 'skipped'); assert.equal(sent.length, 1);   // pas de doublon
  r = await runCartReminders(fakeDb(mk()), send, new Date('2026-10-24T03:00:00Z')); assert.equal(r.status, 'skipped');  // 23h : silence
  t = mk(); t.cart_items.forEach(c => (c.updated_at = ago(24 * 20)));                                                   // panier abandonné depuis 20 jours
  assert.equal((await runCartReminders(fakeDb(t), send, now)).status, 'skipped');
  t = mk(); t.products.forEach(p => (p.stock = 0));                                                                      // tout épuisé : rien à relancer
  assert.equal((await runCartReminders(fakeDb(t), send, now)).status, 'skipped');
  // --- stock presque épuisé
  t = mk(); sent.length = 0;
  r = await runLowStockAlerts(fakeDb(t), send, now);
  assert.equal(r.status, 'sent'); assert.equal(r.recipients, 1);            // u1 seulement (u2 désactivé) ; Casque (50) et Épuisé (0) ignorés
  assert.deepEqual(sent[0].ids, ['u1']); assert.match(sent[0].m, /^Plus que 2 « Robe » en stock/);
  assert.ok(t.cart_items[0].stock_alert_at); assert.equal(t.cart_items[1].stock_alert_at, null);
  r = await runLowStockAlerts(fakeDb(t), send, now); assert.equal(r.status, 'skipped'); assert.equal(sent.length, 1);     // une seule alerte par article
  r = await runLowStockAlerts(fakeDb(t), send, new Date(now.getTime() + 4 * 86400000)); assert.equal(r.status, 'sent');     // réarmée après 3 jours
  assert.equal((await runLowStockAlerts(fakeDb(mk()), send, new Date('2026-10-24T03:00:00Z'))).status, 'skipped');
  console.log('  ✓ cartAlerts: 20 assertions OK');
})().catch(e => { console.error(e); process.exit(1); });
