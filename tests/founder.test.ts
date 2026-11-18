import assert from 'node:assert/strict';
import { effectiveCommissionRate, isFounderActive, founderCategory, FOUNDER_PER_CATEGORY } from '../src/lib/founder';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
near(effectiveCommissionRate('gratuit', 'moncash', true), 0.02);
near(effectiveCommissionRate('pro_local', 'moncash', true), 0.015);
near(effectiveCommissionRate('pro_national', 'moncash', true), 0.01);
near(effectiveCommissionRate('gratuit', 'stripe', true), 0.012);
near(effectiveCommissionRate('gratuit', 'moncash', false), 0.2);
assert.equal(FOUNDER_PER_CATEGORY, 5);
assert.equal(isFounderActive(new Date(Date.now() + 1000).toISOString()), true);
assert.equal(isFounderActive(new Date(Date.now() - 1000).toISOString()), false);
assert.equal(isFounderActive(null), false);
assert.equal(founderCategory(['Inconnue', 'Beauté']), 'Beauté');
assert.equal(founderCategory([]), 'Autre');
console.log('founder tests OK');
