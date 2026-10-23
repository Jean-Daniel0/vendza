import assert from 'node:assert/strict';
import { runFlashSale, runRecommendations } from '../server/campaigns';

// Mini base en mémoire qui imite les appels supabase-js utilisés
function fakeDb(tables: Record<string, any[]>) {
  const q = (name: string) => {
    let rows = () => tables[name]; let filters: Array<(r: any) => boolean> = []; let op: any = null;
    const api: any = {
      select: () => api, limit: () => api,
      eq: (c: string, v: any) => { filters.push(r => r[c] === v); return api; },
      in: (c: string, v: any[]) => { filters.push(r => v.includes(r[c])); return api; },
      insert: (row: any) => { op = () => {
        if (name === 'notification_log' && tables[name].some(r => r.key === row.key)) return { error: { message: 'duplicate' } };
        tables[name].push(row); return { error: null }; }; return api; },
      update: (patch: any) => { op = () => { rows().filter(r => filters.every(f => f(r))).forEach(r => Object.assign(r, patch)); return { error: null }; }; return api; },
      maybeSingle: async () => ({ data: rows().filter(r => filters.every(f => f(r)))[0] || null, error: null }),
      then: (res: any, rej: any) => Promise.resolve(op ? op() : { data: rows().filter(r => filters.every(f => f(r))), error: null }).then(res, rej),
    };
    return api;
  };
  return { from: (n: string) => q(n) };
}
const P = (o: any) => ({ id: 'p', name: 'X', price: 100, old_price: null, stock: 5, category: 'Mode', vendor_id: 'v', created_at: '2026-10-01T00:00:00Z', is_active: true, status: 'published', ...o });
const mk = () => ({
  products: [P({ id: 'a', name: 'Robe', price: 50, old_price: 100 }), P({ id: 'b', name: 'Casque', category: 'Audio' })],
  profiles: [{ id: 'u1', newsletter: true }, { id: 'u2', newsletter: true }, { id: 'u3', newsletter: false }],
  user_interests: [{ user_id: 'u1', category: 'Mode', score: 5, last_viewed_at: '2026-10-22T00:00:00Z', last_notified_at: null }, { user_id: 'u3', category: 'Mode', score: 9, last_viewed_at: '2026-10-22T00:00:00Z', last_notified_at: null }],
  notification_log: [] as any[], platform_messages: [] as any[],
});
const sent: any[] = []; const send = async (ids: string[], t: string, m: string, c: string) => { sent.push({ ids, t, m, c }); };

(async () => {
  const noon = new Date('2026-10-23T16:00:00Z'); // 12h à Port-au-Prince
  // --- Ventes Flash
  let t = mk(); sent.length = 0;
  let r = await runFlashSale(fakeDb(t), send, noon);
  assert.equal(r.status, 'sent'); assert.equal(r.recipients, 2);
  assert.deepEqual(sent[0].ids, ['u1', 'u2']);                       // jamais u3 (pas d'opt-in)
  assert.match(sent[0].t, /jusqu'à -50%/);
  assert.equal(t.platform_messages.length, 1); assert.equal(t.platform_messages[0].audience, 'all');
  r = await runFlashSale(fakeDb(t), send, noon);                      // 2e appel le même jour
  assert.equal(r.status, 'skipped'); assert.equal(sent.length, 1);    // pas de doublon
  r = await runFlashSale(fakeDb(mk()), send, new Date('2026-10-23T02:00:00Z')); // 22h à Haïti
  assert.equal(r.status, 'skipped');
  t = mk(); t.products = [P({})];
  assert.equal((await runFlashSale(fakeDb(t), send, noon)).status, 'skipped'); // aucune promo
  // --- Recommandations
  t = mk(); sent.length = 0;
  r = await runRecommendations(fakeDb(t), send, noon);
  assert.equal(r.status, 'sent'); assert.equal(r.recipients, 1);
  assert.deepEqual(sent[0].ids, ['u1']);                              // u3 n'a pas activé les promos
  assert.match(sent[0].t, /-50% sur Robe/);
  assert.equal(t.platform_messages[0].audience, 'u1');
  assert.ok(t.user_interests[0].last_notified_at);                    // plafond 72 h enregistré
  r = await runRecommendations(fakeDb(t), send, noon);
  assert.equal(r.status, 'skipped'); assert.equal(sent.length, 1);
  assert.equal((await runRecommendations(fakeDb(mk()), send, new Date('2026-10-23T02:00:00Z'))).status, 'skipped');
  t = mk(); t.profiles.forEach(p => (p.newsletter = false));
  assert.equal((await runRecommendations(fakeDb(t), send, noon)).status, 'skipped');
  console.log('  ✓ campaigns: 20 assertions OK');
})().catch(e => { console.error(e); process.exit(1); });
