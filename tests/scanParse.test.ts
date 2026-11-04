import assert from 'node:assert/strict';
import { parseScan, cleanCode, precheckScan } from '../src/lib/scanParse';

const ID = '49749283-4bc9-488a-9f05-e93ec2b01be5';
// formats de QR
assert.deepEqual(parseScan(`https://www.vendza.store/?confirm=${ID}&code=ABCD2345`), { id: ID, code: 'ABCD2345' });
assert.deepEqual(parseScan(`https://www.vendza.store/?order=${ID}`), { id: ID, code: '' });
assert.deepEqual(parseScan(`https://x.test/?id=${ID}`), { id: ID, code: '' });
assert.deepEqual(parseScan(`?confirm=${ID}&code=ab%20cd`), { id: ID, code: 'ab cd' });
assert.deepEqual(parseScan(`  ${ID}  `), { id: ID, code: '' });
assert.deepEqual(parseScan(''), { id: '', code: '' });
assert.equal(cleanCode('abcd-2345'), 'ABCD2345');
assert.equal(cleanCode(' a b!c d '), 'ABCD');
assert.equal(cleanCode(null), '');
assert.equal(cleanCode('x'.repeat(30)).length, 12);
console.log('  ✓ scanParse: lecture des QR et nettoyage du code');

const mk = (id: string, status: string, clientId = 'u1') => ({ id, clientId, clientNom: 'A', status, items: [], total: 1, date: '', departement: '', commune: '' }) as any;
const orders = [mk(ID, 'payee'), mk('11111111-1111-1111-1111-111111111111', 'livree'), mk('22222222-2222-2222-2222-222222222222', 'annulee'),
  mk('33333333-3333-3333-3333-333333333333', 'attente'), mk('44444444-4444-4444-4444-444444444444', 'payee', 'autre')];
const good = precheckScan(orders, 'u1', `https://www.vendza.store/?confirm=${ID}&code=abcd-2345`);
assert.ok(good.ok && good.code === 'ABCD2345' && good.order.id === ID);
const msg = (t: string, extra?: string) => { const r = precheckScan(orders, 'u1', t, extra); return r.ok === false ? r.message : 'OK'; };
assert.match(msg('https://www.vendza.store/?confirm=99999999-9999-9999-9999-999999999999&code=ABCD2345'), /aucune de vos commandes/);
assert.match(msg('?confirm=44444444-4444-4444-4444-444444444444&code=ABCD2345'), /autre compte/);
assert.match(msg('?confirm=11111111-1111-1111-1111-111111111111&code=ABCD2345'), /déjà confirmée/);
assert.match(msg('?confirm=22222222-2222-2222-2222-222222222222&code=ABCD2345'), /annulée/);
assert.match(msg('?confirm=33333333-3333-3333-3333-333333333333&code=ABCD2345'), /pas encore payée/);
assert.match(msg(`https://www.vendza.store/?order=${ID}`), /ne contient pas le code/);   // ancien QR sans code : refusé
assert.match(msg(`?confirm=${ID}&code=AB`), /ne contient pas le code/);                // code trop court
assert.equal(msg(ID, 'abcd 2345'), 'OK');                                              // saisie manuelle : commande choisie + code tapé
assert.match(msg(''), /illisible/);
assert.equal(precheckScan(orders, undefined, `?confirm=${ID}&code=ABCD2345`).ok, true); // pas d'utilisateur connu : le serveur tranche
console.log('  ✓ scanParse: contrôles avant confirmation (autre compte, livrée, annulée, sans code…)');
