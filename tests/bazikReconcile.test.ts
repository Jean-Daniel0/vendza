import assert from 'node:assert/strict';
import { decideReconcile, reconcileMoncashPayments, type Ref } from '../server/bazikReconcile';

// Décision : seul « successful » crée une commande
assert.equal(decideReconcile({ status: 'successful', amount: 1284 }), 'fulfill');
assert.equal(decideReconcile({ status: 'SUCCESSFUL' }), 'fulfill');
assert.equal(decideReconcile({ status: 'pending' }), 'wait');
for (const st of ['failed', 'cancelled']) assert.equal(decideReconcile({ status: st }), 'ignore');
for (const bad of [null, {}, { status: 42 }, { status: 'bizarre' }]) assert.equal(decideReconcile(bad as any), 'unknown');
console.log('  ✓ bazikReconcile: décision selon le statut Bazik');

const refs: Ref[] = [
  { reference_id: 'A_bz_1', order_ref: 'A', bazik_order_id: 'BZK_A' },   // payé chez Bazik, commande absente -> créée
  { reference_id: 'B_bz_1', order_ref: 'B', bazik_order_id: 'BZK_B' },   // déjà traité
  { reference_id: 'C_bz_1', order_ref: 'C', bazik_order_id: 'BZK_C' },   // en attente chez MonCash
  { reference_id: 'D_bz_1', order_ref: 'D', bazik_order_id: 'BZK_D' },   // annulé
  { reference_id: 'E_bz_1', order_ref: 'E', bazik_order_id: 'BZK_E' },   // Bazik injoignable
  { reference_id: 'S_bz_1', order_ref: 'SUB_1', bazik_order_id: 'BZK_S' }, // abonnement : ignoré
  { reference_id: 'A_bz_0', order_ref: 'A', bazik_order_id: 'BZK_A0' },  // 2e tentative de A : un seul passage
];
const fetched: string[] = []; const fulfilled: any[] = [];
const sum = await reconcileMoncashPayments({
  listRefs: async () => refs,
  isSubscription: r => r.startsWith('SUB_'),
  isProcessed: async r => r === 'B',
  fetchOrder: async id => { fetched.push(id); return ({ BZK_A: { status: 'successful', amount: 1284 }, BZK_C: { status: 'pending' }, BZK_D: { status: 'cancelled' } } as any)[id] ?? 'error'; },
  fulfill: async (r, id, amt) => { fulfilled.push([r, id, amt]); },
});
assert.deepEqual(fulfilled, [['A', 'BZK_A', 1284]]);
assert.deepEqual(fetched.sort(), ['BZK_A', 'BZK_C', 'BZK_D', 'BZK_E']); // B (déjà traité), abonnement et 2e tentative de A : jamais interrogés
assert.deepEqual(sum, { checked: 5, already: 1, fulfilled: ['A'], waiting: 1, ignored: 1, unknown: 0, errors: 1, skipped_subscriptions: 1 });
// Une erreur pendant la création n'arrête pas les autres paiements
const sum2 = await reconcileMoncashPayments({
  listRefs: async () => refs.slice(0, 1).concat([{ reference_id: 'Z_bz_1', order_ref: 'Z', bazik_order_id: 'BZK_Z' }]),
  isSubscription: () => false, isProcessed: async () => false,
  fetchOrder: async () => ({ status: 'successful', amount: 10 }),
  fulfill: async r => { if (r === 'A') throw new Error('boom'); },
});
assert.deepEqual([sum2.errors, sum2.fulfilled], [1, ['Z']]);
console.log('  ✓ bazikReconcile: une seule création par paiement, abonnements et déjà-traités ignorés, erreurs isolées');
