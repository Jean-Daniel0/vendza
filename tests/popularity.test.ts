import assert from 'node:assert/strict';
import { ratingInfo, isPopularVerified, isVerifiedVendor, byPopularity } from '../src/lib/popularity';

const rv = (id: string, notes: number[]) => notes.map(note => ({ productId: id, note }));
assert.deepEqual(ratingInfo([], 'a'), { avg: null, count: 0 });                       // pas encore noté : ni 0 ni 5
assert.deepEqual(ratingInfo(rv('b', [5, 4]), 'a'), { avg: null, count: 0 });
assert.deepEqual(ratingInfo(rv('a', [5, 4]), 'a'), { avg: 4.5, count: 2 });

const pro = { vendeurPlan: 'Pro Local' }, free = { vendeurPlan: 'Gratuit' }, verified = { vendeurPlan: 'Gratuit', vendeurVerifie: true };
assert.ok(isVerifiedVendor(pro) && isVerifiedVendor(verified) && !isVerifiedVendor(free));
assert.ok(isPopularVerified({ avg: 4.5, count: 10 }, pro));
assert.ok(isPopularVerified({ avg: 4.8, count: 25 }, verified));
assert.ok(!isPopularVerified({ avg: 4.4, count: 40 }, pro));      // note trop basse
assert.ok(!isPopularVerified({ avg: 5, count: 9 }, pro));         // pas assez d'avis
assert.ok(!isPopularVerified({ avg: 5, count: 50 }, free));       // vendeur non vérifié
assert.ok(!isPopularVerified({ avg: null, count: 0 }, pro));      // sans avis : jamais populaire
assert.ok(byPopularity({ avg: 4.6, count: 30 }, { avg: 5, count: 12 }) < 0);
assert.ok(byPopularity({ avg: 4.9, count: 12 }, { avg: 4.6, count: 12 }) < 0);
console.log('  ✓ popularity: note réelle (pas encore noté), populaires et vérifiés');
