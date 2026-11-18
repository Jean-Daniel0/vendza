import assert from 'node:assert/strict';
import { firstOrderShippingSubsidy } from '../src/lib/shipping';

assert.equal(firstOrderShippingSubsidy(0), 0);
assert.equal(firstOrderShippingSubsidy(100), 100);   // gratuit
assert.equal(firstOrderShippingSubsidy(250), 250);   // gratuit
assert.equal(firstOrderShippingSubsidy(450), 350);   // Vendza 250 + 50 % de 200 ; le client paie 100
assert.equal(firstOrderShippingSubsidy(251), 251);   // 250 + 0,5 arrondi
assert.equal(firstOrderShippingSubsidy(-5), 0);
assert.equal(firstOrderShippingSubsidy(NaN), 0);
for (const fee of [0, 90, 250, 251, 333, 1000, 99999]) {
  const s = firstOrderShippingSubsidy(fee);
  assert.ok(s >= 0 && s <= fee, `subvention ${s} hors limites pour ${fee}`);
}
console.log('  ✓ firstOrderShipping: 250 Gdes offertes, puis 50 % du reste');
