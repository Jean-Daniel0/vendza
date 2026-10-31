import assert from 'node:assert/strict';
import { csvCell, toCsv, parseDecision, buildQueue, isUuid } from '../server/adminPayments';

// CSV : guillemets doublés, séparateurs protégés, formules Excel neutralisées
assert.equal(csvCell('simple'), 'simple');
assert.equal(csvCell('a,b'), '"a,b"');
assert.equal(csvCell('dit "oui"'), '"dit ""oui"""');
assert.equal(csvCell('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`);
for (const f of ['+1', '-1', '@x']) assert.ok(csvCell(f).startsWith(`'`), f);
assert.equal(csvCell(null), ''); assert.equal(csvCell(undefined), ''); assert.equal(csvCell(0), '0');
const csv = toCsv([{ a: 'x', b: 2 }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
assert.equal(csv, '\uFEFFA,B\r\nx,2\r\n');
console.log('  ✓ adminPayments: CSV sûr (guillemets, formules)');

// Décisions : référence MonCash obligatoire pour « payé », motif obligatoire pour « refusé »
assert.equal(parseDecision('paid', { reference: '' }).ok, false);
assert.equal(parseDecision('paid', { reference: 'ab' }).ok, false);
assert.equal(parseDecision('paid', {}).ok, false);
assert.equal(parseDecision('paid', { reference: 'MC123456' }).ok, true);
assert.equal(parseDecision('reject', { note: '' }).ok, false);
assert.equal(parseDecision('reject', { note: 'Fraude suspectée' }).ok, true);
assert.equal(parseDecision('reject', { note: 'x'.repeat(501) }).ok, false);
assert.equal(parseDecision('paid', { reference: 'r'.repeat(81) }).ok, false);
assert.equal(parseDecision('paid', null).ok, false);
assert.equal(isUuid('617c0371-7f92-41d0-ab9c-886be4524b0c'), true);
for (const bad of ['', 'abc', "1' or 1=1", 42, null]) assert.equal(isUuid(bad as any), false);
console.log('  ✓ adminPayments: décisions validées (référence / motif / longueurs)');

// File d'attente : remboursements et virements à suivre
const q = buildQueue({
  refunds: [
    { id: 'r1', order_id: 'o1', buyer_id: 'b1', status: 'pending', amount: '925', fee: '75', created_at: '2026-10-30' },
    { id: 'r2', order_id: 'o2', buyer_id: 'b1', status: 'paid', amount: 100, fee: 0, created_at: '2026-10-01' },
  ],
  orders: [
    { id: 'o1', status: 'annulee', product_name: 'Robe', payment_method: 'moncash', client_name: 'Marie' },
    { id: 'o2', status: 'annulee' },
    { id: 'o3', status: 'completed', vendor_id: 'v1', vendor_credited: false, total_price: 2000 },
    { id: 'o4', status: 'completed', vendor_id: 'v2', vendor_credited: null, total_price: 500 },
    { id: 'o5', status: 'completed', vendor_id: 'v1', vendor_credited: true, total_price: 700 },
    { id: 'o6', status: 'payee', vendor_id: 'v1', total_price: 900 },
  ],
  profiles: [{ id: 'b1', prenom: 'Marie', nom: 'Joseph', numero_moncash: '37000000' }, { id: 'v1', boutique_nom: 'Chez Jo' }, { id: 'v2', prenom: 'Luc', nom: 'P' }],
  vendorPrivate: [{ user_id: 'v1', moncash: '38111111', moncash_nom: 'Jo Pierre' }],
  payouts: [{ reference: 'PAY_VENDOR_o3', amount: 1800, status: 'pending' }],
});
assert.equal(q.totals.refunds_pending_count, 1);
assert.equal(q.totals.refunds_pending_amount, 925);
assert.equal(q.refunds[0].buyer_moncash, '37000000');
assert.equal(q.refunds[0].product_name, 'Robe');
assert.deepEqual(q.payouts.map(p => p.order_id).sort(), ['o3', 'o4']); // déjà versée (o5) et non livrée (o6) exclues
assert.equal(q.payouts.find(p => p.order_id === 'o3')!.state, 'en cours');
assert.equal(q.payouts.find(p => p.order_id === 'o3')!.payout_amount, 1800);
assert.equal(q.payouts.find(p => p.order_id === 'o4')!.state, 'n° MonCash manquant');
console.log('  ✓ adminPayments: files remboursements / virements');
