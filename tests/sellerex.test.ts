import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  sellerexEnabled, isSellerexHostname, cleanPhoneNumber, validateWholesalerApplication, validateApiKeyFormat,
  loadEncryptionKey, encryptSecret, decryptSecret, secretHint, createRateLimiter,
} from '../server/sellerexCore';
import { isSellerexHost } from '../src/lib/host';

// indicateur : éteint par défaut, allumé seulement avec "true"
assert.equal(sellerexEnabled({}), false);
assert.equal(sellerexEnabled({ SELLEREX_ENABLED: '1' }), false);
assert.equal(sellerexEnabled({ SELLEREX_ENABLED: 'true' }), true);

// nom d'hôte (serveur et front)
assert.equal(isSellerexHostname('sellerex.vendza.store'), true);
assert.equal(isSellerexHostname('SELLEREX.vendza.store:443'), true);
assert.equal(isSellerexHostname('www.vendza.store'), false);
assert.equal(isSellerexHostname('vendza.store'), false);
assert.equal(isSellerexHostname('evil-sellerex.vendza.store'), false);
assert.equal(isSellerexHostname(undefined), false);
assert.equal(isSellerexHost({ hostname: 'sellerex.vendza.store', search: '' }), true);
assert.equal(isSellerexHost({ hostname: 'www.vendza.store', search: '?sellerex=1' }), false); // le forçage ne marche qu'en local
assert.equal(isSellerexHost({ hostname: 'localhost', search: '?sellerex=1' }), true);
assert.equal(isSellerexHost({ hostname: 'localhost', search: '' }), false);

// téléphone
assert.equal(cleanPhoneNumber('+509 3712-3456'), '+50937123456');
assert.equal(cleanPhoneNumber('37123456'), '37123456');
assert.equal(cleanPhoneNumber('123'), null);
assert.equal(cleanPhoneNumber(null), null);
assert.equal(cleanPhoneNumber('1'.repeat(16)), null);

// inscription grossiste
const good = {
  business_name: '  Gros   Import SA ', contact_name: 'Jean Michel', phone: '+509 3712 3456', whatsapp: '', nif: '001-234-567-8',
  categories: ['Mode', 'mode', ' Beauté '], description: 'Importation et vente en gros de vêtements et cosmétiques.',
  min_order_qty: 10, min_order_amount_htg: '5000', delivery_zones: ['Ouest', 'Nord'], accept_terms: true,
  user_id: 'pirate', status: 'approved', // champs interdits : ne doivent jamais passer
};
const ok = validateWholesalerApplication(good);
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.value.business_name, 'Gros Import SA');
  assert.deepEqual(ok.value.categories, ['Mode', 'Beauté']);
  assert.equal(ok.value.phone, '+50937123456');
  assert.equal(ok.value.whatsapp, null);
  assert.equal(ok.value.min_order_amount_htg, 5000);
  assert.equal((ok.value as any).user_id, undefined);
  assert.equal((ok.value as any).status, undefined);
}
const bad = validateWholesalerApplication({ ...good, business_name: 'A', phone: '12', categories: [], description: 'court', min_order_qty: 0, delivery_zones: 'Ouest', accept_terms: false });
assert.equal(bad.ok, false);
if (!bad.ok) assert.equal(bad.errors.length, 7);
assert.equal(validateWholesalerApplication(null).ok, false);
assert.equal(validateWholesalerApplication({ ...good, min_order_qty: 2.5 }).ok, false);
assert.equal(validateWholesalerApplication({ ...good, nif: '<script>' }).ok, false);
assert.equal(validateWholesalerApplication({ ...good, categories: Array(11).fill(0).map((_, i) => 'cat' + i) }).ok, false);

// clé API : format
assert.equal(validateApiKeyFormat('sk_live_1234567890abcdef'), 'sk_live_1234567890abcdef');
assert.equal(validateApiKeyFormat('court'), null);
assert.equal(validateApiKeyFormat('a b c d e f g h i j k l m n o p'), null);
assert.equal(validateApiKeyFormat(42), null);

// chiffrement : aller-retour, IV aléatoire, détection d'altération, mauvaise clé
const keyB64 = crypto.randomBytes(32).toString('base64');
const key = loadEncryptionKey({ SELLEREX_ENCRYPTION_KEY: keyB64 });
const secret = 'sk_live_1234567890abcdef';
const c1 = encryptSecret(secret, key);
const c2 = encryptSecret(secret, key);
assert.notEqual(c1, c2);
assert.ok(!c1.includes(secret));
assert.equal(decryptSecret(c1, key), secret);
assert.throws(() => decryptSecret(c1.slice(0, -2) + 'AA', key));
assert.throws(() => decryptSecret(c1, crypto.randomBytes(32)));
assert.throws(() => decryptSecret('n_importe_quoi', key));
assert.throws(() => loadEncryptionKey({}));
assert.throws(() => loadEncryptionKey({ SELLEREX_ENCRYPTION_KEY: Buffer.from('trop court').toString('base64') }));
assert.equal(secretHint(secret), '••••cdef');
assert.ok(!secretHint(secret).includes('sk_live'));

// limite de débit
const limited = createRateLimiter(3, 1000);
assert.equal(limited('u', 0), false);
assert.equal(limited('u', 10), false);
assert.equal(limited('u', 20), false);
assert.equal(limited('u', 30), true);   // 4e dans la fenêtre : bloqué
assert.equal(limited('autre', 30), false); // un autre utilisateur n'est pas touché
assert.equal(limited('u', 1500), false); // fenêtre écoulée

console.log('  ✓ sellerex: indicateur, hôte, grossiste, clés chiffrées, débit OK');
