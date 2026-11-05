import assert from 'node:assert/strict';
import { commissionPercent, commissionRate, isCardMethod, normalizePlanKey } from '../src/lib/commission';

assert.equal(commissionPercent('gratuit', 'moncash'), 20);
assert.equal(commissionPercent('Pro Local', 'moncash'), 15);
assert.equal(commissionPercent('pro_national'), 10);
assert.equal(commissionPercent('gratuit', 'stripe'), 12);
assert.equal(commissionPercent('Pro Local', 'stripe'), 9.5);
assert.equal(commissionPercent('Pro National', 'stripe'), 5);
assert.equal(commissionPercent('inconnu', 'stripe'), 12);
assert.equal(commissionRate('pro_local', 'stripe'), 0.095);
assert.ok(isCardMethod('stripe') && !isCardMethod('moncash') && !isCardMethod(undefined));
assert.equal(normalizePlanKey('Pro National'), 'pro_national');
console.log('  ✓ commission: taux par forfait, MonCash et carte bancaire');
