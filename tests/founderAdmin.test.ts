import assert from 'node:assert/strict';
import { founderCost, inviteTargets, runFounderInvite, daysLeft, parsePeriod, periodStart, INVITE_KEY, Member } from '../server/founderAdmin';

const NOW = Date.parse('2026-11-25T12:00:00Z');
const iso = (d: number) => new Date(NOW + d * 86400000).toISOString();
const m1: Member = { vendor_id: 'v1', category: 'Mode', joined_at: iso(-30), expires_at: iso(60) };
const plans = { v1: 'gratuit' };

// --- coût : (payé + livraison offerte) x taux de base x 0,9 ; MonCash gratuit = 20 %
const c = founderCost([
  { vendor_id: 'v1', total_price: 1000, shipping_subsidy: 250, payment_method: 'moncash', status: 'payee', created_at: iso(-5) },   // 1250 x 0,20 x 0,9 = 225
  { vendor_id: 'v1', total_price: 1000, payment_method: 'stripe', status: 'livree', created_at: iso(-2) },                           // 1000 x 0,12 x 0,9 = 108
  { vendor_id: 'v1', total_price: 999, payment_method: 'moncash', status: 'annulee', created_at: iso(-1) },                          // pas payée
  { vendor_id: 'v1', total_price: 999, payment_method: 'moncash', status: 'payee', created_at: iso(-40) },                           // avant l'adhésion
  { vendor_id: 'v1', total_price: 999, payment_method: 'moncash', status: 'payee', created_at: iso(70) },                            // après les 90 jours
  { vendor_id: 'autre', total_price: 999, payment_method: 'moncash', status: 'payee', created_at: iso(-1) },                         // pas membre
], [m1], plans, null);
assert.equal(c.orders, 2); assert.equal(c.total, 333); assert.equal(c.sales, 2000);
assert.equal(Math.round(c.byVendor.v1.cost), 333);
// période 7 jours : la commande d'il y a 5 jours reste, mais pas celle d'il y a 40
const c7 = founderCost([{ vendor_id: 'v1', total_price: 1000, payment_method: 'moncash', status: 'payee', created_at: iso(-10) }, { vendor_id: 'v1', total_price: 1000, payment_method: 'moncash', status: 'payee', created_at: iso(-3) }], [m1], plans, periodStart('7', NOW));
assert.equal(c7.orders, 1);
// scénario Bazik 9 % : MonCash seulement ; commission appliquée 2 % -> perte 7 % du payé
assert.equal(founderCost([{ vendor_id: 'v1', total_price: 1000, payment_method: 'moncash', status: 'payee', created_at: iso(-1) }], [m1], plans, null).bazikScenario, 70);
assert.equal(founderCost([{ vendor_id: 'v1', total_price: 1000, payment_method: 'stripe', status: 'payee', created_at: iso(-1) }], [m1], plans, null).bazikScenario, 0);
assert.equal(parsePeriod('30'), '30'); assert.equal(parsePeriod('x'), 'all'); assert.equal(periodStart('all'), null);
assert.equal(daysLeft(iso(60), NOW), 60); assert.equal(daysLeft(iso(-1), NOW), 0);
console.log('  ✓ founderAdmin: coût estimé, périodes, scénario Bazik, jours restants');

// --- éligibilité : propriétaires de boutique non membres, sans doublon
assert.deepEqual(inviteTargets(['a', 'b', 'b', 'v1', ''], ['v1']), ['a', 'b']);

// --- faux Supabase minimal pour l'idempotence
function fakeDb(shops: string[], members: string[], logged: string[] = []) {
  const log = new Set(logged);
  return {
    log,
    from(t: string) {
      if (t === 'shops') return { select: () => ({ limit: async () => ({ data: shops.map(vendor_id => ({ vendor_id })) }) }) };
      if (t === 'founder_program') return { select: () => ({ limit: async () => ({ data: members.map(vendor_id => ({ vendor_id })) }) }) };
      return {
        select: () => ({ in: async (_c: string, keys: string[]) => ({ data: keys.filter(k => log.has(k)).map(key => ({ key })) }) }),
        insert: async ({ key }: { key: string }) => { if (log.has(key)) return { error: { code: '23505' } }; log.add(key); return { error: null }; },
        delete: () => ({ in: async (_c: string, keys: string[]) => { keys.forEach(k => log.delete(k)); return {}; } }),
      };
    },
  };
}
(async () => {
  const sent: string[][] = [];
  const send = async (ids: string[]) => { sent.push(ids); };
  const db: any = fakeDb(['a', 'b', 'v1'], ['v1']);
  // simulation : compte, n'envoie rien, ne réserve rien
  const sim = await runFounderInvite(db, send, { simulate: true });
  assert.deepEqual([sim.status, sim.recipients], ['simulation', 2]); assert.equal(sent.length, 0); assert.equal(db.log.size, 0);
  // envoi réel, puis rejeu : personne ne reçoit deux fois
  const r1 = await runFounderInvite(db, send, { simulate: false });
  assert.deepEqual([r1.status, r1.recipients], ['sent', 2]); assert.deepEqual(sent[0], ['a', 'b']);
  const r2 = await runFounderInvite(db, send, { simulate: false });
  assert.equal(r2.recipients, 0); assert.equal(sent.length, 1);
  // un nouveau vendeur reçoit l'invitation, pas les anciens
  const db2: any = fakeDb(['a', 'b', 'c'], [], [INVITE_KEY('a'), INVITE_KEY('b')]);
  const r3 = await runFounderInvite(db2, send, { simulate: false });
  assert.equal(r3.recipients, 1); assert.deepEqual(sent[1], ['c']); assert.equal(r3.alreadyInvited, 2);
  // échec d'envoi : les clés sont libérées pour réessayer
  const db3: any = fakeDb(['x'], []);
  await assert.rejects(() => runFounderInvite(db3, async () => { throw new Error('boom'); }, { simulate: false }));
  assert.equal(db3.log.size, 0);
  // 50 places prises : plus d'invitation
  const full = await runFounderInvite(fakeDb(['z'], Array.from({ length: 50 }, (_, i) => `m${i}`)) as any, send, { simulate: false });
  assert.equal(full.status, 'skipped');
  console.log('  ✓ founderAdmin: éligibilité, simulation, envoi unique par vendeur, reprise après échec, places complètes');
})();
