import assert from 'node:assert/strict';
import { normalizePlan, normalizeBilling, planPriceHtg, checkSubscriptionPayment, stripePaidHtg, newSubscriptionRef, isUuid, isSubscriptionRef, PLAN_PRICES_HTG, decideActivation } from '../server/subscriptions';

// grille officielle
assert.deepEqual(PLAN_PRICES_HTG, { pro_local: { mensuel: 350, annuel: 3500 }, pro_national: { mensuel: 499, annuel: 4990 } });
assert.equal(planPriceHtg('pro_local', 'mensuel'), 350);
assert.equal(planPriceHtg('pro_national', 'annuel'), 4990);

// forfaits : variantes acceptées, « gratuit » et le reste refusés
for (const v of ['pro_local', 'Pro Local', ' PRO-LOCAL ']) assert.equal(normalizePlan(v), 'pro_local');
assert.equal(normalizePlan('Pro National'), 'pro_national');
for (const bad of ['gratuit', 'free', 'elite-499', '', null, undefined, 42, {}]) assert.equal(normalizePlan(bad), null);
assert.equal(normalizeBilling('annuel'), 'annuel');
assert.equal(normalizeBilling(' Mensuel '), 'mensuel');
for (const bad of ['yearly', '', null, 'annuelle']) assert.equal(normalizeBilling(bad), null);

// MonCash : montant exact (1 gourde d'arrondi)
assert.equal(checkSubscriptionPayment({ plan: 'pro_local', billing: 'mensuel', paidHtg: 350 }).ok, true);
assert.equal(checkSubscriptionPayment({ plan: 'pro_local', billing: 'mensuel', paidHtg: 349 }).ok, true);
const cheap = checkSubscriptionPayment({ plan: 'pro_national', billing: 'annuel', paidHtg: 1 });
assert.deepEqual(cheap, { ok: false, reason: 'underpaid', expected: 4990 });
assert.equal(checkSubscriptionPayment({ plan: 'pro_national', billing: 'annuel', paidHtg: 499 }).ok, false); // mensuel payé pour un annuel
assert.equal(checkSubscriptionPayment({ plan: 'pro_local', billing: 'annuel', paidHtg: 4000 }).ok, true);   // surpaiement accepté
for (const paid of [0, -5, NaN, 'abc', null, undefined]) assert.equal((checkSubscriptionPayment({ plan: 'pro_local', billing: 'mensuel', paidHtg: paid }) as any).reason, 'invalid_amount');
assert.equal((checkSubscriptionPayment({ plan: 'gratuit', billing: 'mensuel', paidHtg: 999 }) as any).reason, 'invalid_plan');
assert.equal((checkSubscriptionPayment({ plan: 'pro_local', billing: 'x', paidHtg: 999 }) as any).reason, 'invalid_billing');
// tolérance Stripe (taux de change)
assert.equal(checkSubscriptionPayment({ plan: 'pro_local', billing: 'mensuel', paidHtg: 330, tolerancePct: 10 }).ok, true);
assert.equal(checkSubscriptionPayment({ plan: 'pro_local', billing: 'mensuel', paidHtg: 300, tolerancePct: 10 }).ok, false);
assert.equal(checkSubscriptionPayment({ plan: 'pro_local', billing: 'mensuel', paidHtg: 250, tolerancePct: 500 }).ok, false); // tolérance plafonnée à 20 %

// Stripe : cents -> HTG
assert.equal(stripePaidHtg(269, 130), 350);
assert.equal(stripePaidHtg(269, 0), 350);
assert.equal(stripePaidHtg(null, 130), 0);

// référence serveur
const uid = '3f2b8a10-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const ref = newSubscriptionRef(uid, 1700000000000);
assert.ok(ref.startsWith(`sub-${uid}-`) && !ref.includes('_bz_') && isSubscriptionRef(ref));
assert.ok(isUuid(uid) && !isUuid('3f2b8a10') && !isUuid(null));
// décision d'activation
const U = '3f2b8a10-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
assert.deepEqual(decideActivation({ userId: U, planCode: 'pro_local', billing: 'mensuel', paidHtg: 350 }), { action: 'activate', plan: 'pro_local', billing: 'mensuel' });
// l'ancienne faille : 1 gourde pour un annuel national -> mis de côté, jamais activé
const attack = decideActivation({ userId: U, planCode: 'pro_national', billing: 'annuel', paidHtg: 1 });
assert.equal(attack.action, 'set_aside'); assert.equal((attack as any).status, 'underpaid'); assert.equal((attack as any).expected, 4990);
// identifiant utilisateur deviné dans la référence (8 caractères) : refusé
assert.equal((decideActivation({ userId: '3f2b8a10', planCode: 'pro_local', billing: 'mensuel', paidHtg: 350 }) as any).reason, 'invalid_user');
assert.equal((decideActivation({ userId: undefined, planCode: 'pro_local', billing: 'mensuel', paidHtg: 350 }) as any).reason, 'invalid_user');
// forfait gratuit ou inconnu payé : refusé
assert.equal((decideActivation({ userId: U, planCode: 'gratuit', billing: 'mensuel', paidHtg: 999 }) as any).reason, 'invalid_plan');
// même paiement rejoué (webhook + vérification de session) : une seule activation
assert.deepEqual(decideActivation({ userId: U, planCode: 'pro_local', billing: 'mensuel', paidHtg: 350, alreadyProcessed: true }), { action: 'skip_duplicate' });
// un paiement insuffisant n'est jamais masqué par « déjà traité »
assert.equal(decideActivation({ userId: U, planCode: 'pro_local', billing: 'mensuel', paidHtg: 10, alreadyProcessed: true }).action, 'set_aside');
// Stripe avec tolérance de change
assert.equal(decideActivation({ userId: U, planCode: 'pro_local', billing: 'mensuel', paidHtg: stripePaidHtg(200, 130), tolerancePct: 10 }).action, 'set_aside');
assert.equal(decideActivation({ userId: U, planCode: 'pro_local', billing: 'mensuel', paidHtg: stripePaidHtg(250, 130), tolerancePct: 10 }).action, 'activate');
assert.equal(decideActivation({ userId: U, planCode: 'pro_local', billing: 'mensuel', paidHtg: stripePaidHtg(269, 128), tolerancePct: 10 }).action, 'activate');
console.log('  ✓ subscriptions: toutes les vérifications OK');
