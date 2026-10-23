import assert from 'node:assert/strict';
import { haitiClock, isFlashWindow, flashSummary, buildFlashMessage, pickRecommendation, buildRecommendationMessage, effectiveScore, discountPct } from '../server/marketing';

// --- horloge d'Haïti (UTC-4 en été, UTC-5 en hiver)
assert.equal(isFlashWindow(new Date('2026-07-10T12:00:00Z')), true);   // 08:00 en heure d'été
assert.equal(isFlashWindow(new Date('2026-07-10T11:59:00Z')), false);  // 07:59
assert.equal(isFlashWindow(new Date('2026-12-10T13:00:00Z')), true);   // 08:00 en hiver (UTC-5)
assert.equal(isFlashWindow(new Date('2026-12-10T12:00:00Z')), false);  // 07:00
assert.equal(isFlashWindow(new Date('2026-12-11T01:00:00Z')), false);  // 20:00 -> fenêtre fermée
assert.equal(haitiClock(new Date('2026-12-11T01:30:00Z')).dateKey, '2026-12-10'); // le jour d'Haïti, pas celui d'UTC

// --- Ventes Flash
const P = (o: any) => ({ id: 'p', name: 'X', price: 100, old_price: null, stock: 5, category: 'Mode', vendor_id: 'v', created_at: '2026-10-01T00:00:00Z', is_active: true, status: 'published', ...o });
const prods = [P({ id: 'a', price: 50, old_price: 100 }), P({ id: 'b', price: 80, old_price: 100 }), P({ id: 'c' }), P({ id: 'd', price: 10, old_price: 100, stock: 0 }), P({ id: 'e', price: 10, old_price: 100, is_active: false })];
assert.deepEqual(flashSummary(prods), { count: 2, maxPct: 50 });   // sans rupture ni produit inactif
assert.equal(buildFlashMessage({ count: 2, maxPct: 50 }).title, "🔥 Ventes Flash — jusqu'à -50%");
assert.match(buildFlashMessage({ count: 1, maxPct: 20 }).message, /^1 produit en promotion/);
assert.equal(discountPct(P({ price: 150, old_price: 100 })), 0);

// --- suggestions
const now = new Date('2026-10-17T12:00:00Z');
const interests = [{ category: 'Mode', score: 10, last_viewed_at: '2026-10-16T00:00:00Z' }, { category: 'Audio', score: 4, last_viewed_at: '2026-10-16T00:00:00Z' }];
const catalog = [P({ id: 'm1', category: 'Mode', name: 'Robe', created_at: '2026-10-10T00:00:00Z' }), P({ id: 'm2', category: 'Mode', name: 'Costume', price: 60, old_price: 100 }),
  P({ id: 'au', category: 'Audio', name: 'Casque' }), P({ id: 'mine', category: 'Mode', vendor_id: 'me', price: 1, old_price: 100 })];
const r = pickRecommendation(interests, catalog, { userId: 'me', now })!;
assert.equal(r.category, 'Mode'); assert.equal(r.product.id, 'm2');        // meilleure promo, pas son propre produit
assert.equal(buildRecommendationMessage(r).title, '🔥 Pour vous : -40% sur Costume');
const r2 = pickRecommendation(interests, catalog.filter(p => p.id !== 'm2'), { userId: 'me', now })!;
assert.equal(r2.product.id, 'm1'); assert.equal(buildRecommendationMessage(r2).title, '✨ Nouveau en Mode');
// plafond : pas de 2e message avant 72 h
assert.equal(pickRecommendation([{ ...interests[0], last_notified_at: '2026-10-15T13:00:00Z' }], catalog, { userId: 'me', now }), null);
assert.ok(pickRecommendation([{ ...interests[0], last_notified_at: '2026-10-14T11:00:00Z' }], catalog, { userId: 'me', now }));
// la catégorie vide est sautée, la suivante est utilisée
assert.equal(pickRecommendation(interests, catalog.filter(p => p.category === 'Audio'), { userId: 'me', now })!.category, 'Audio');
// décroissance : après 14 jours le score est divisé par 2
assert.ok(Math.abs(effectiveScore({ category: 'x', score: 8, last_viewed_at: '2026-10-03T12:00:00Z' }, now) - 4) < 0.01);
assert.equal(pickRecommendation([], catalog, { userId: 'me', now }), null);
console.log('  ✓ marketing: 19 assertions OK');
