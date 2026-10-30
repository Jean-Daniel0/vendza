import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  sellerexEnabled, isSellerexHostname, cleanPhoneNumber, validateWholesalerApplication, validateApiKeyFormat,
  loadEncryptionKey, encryptSecret, decryptSecret, secretHint, createRateLimiter, isAdminEmail, validateReview, buildSellerexCsp, sellerexHtml,
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

// admin : liste d'e-mails dans l'environnement, aucun par défaut
assert.equal(isAdminEmail('a@x.com', {}), false);
assert.equal(isAdminEmail('a@x.com', { SELLEREX_ADMIN_EMAILS: ' A@x.com , b@y.com ' }), true);
assert.equal(isAdminEmail('B@Y.COM', { SELLEREX_ADMIN_EMAILS: 'a@x.com,b@y.com' }), true);
assert.equal(isAdminEmail('c@z.com', { SELLEREX_ADMIN_EMAILS: 'a@x.com,b@y.com' }), false);
assert.equal(isAdminEmail('', { SELLEREX_ADMIN_EMAILS: ',' }), false);
assert.equal(isAdminEmail(undefined, { SELLEREX_ADMIN_EMAILS: 'a@x.com' }), false);
// décision de validation
assert.deepEqual(validateReview({ decision: 'approved' }), { ok: true, value: { decision: 'approved', note: null } });
assert.equal(validateReview({ decision: 'rejected' }).ok, false);               // refus sans motif
assert.equal(validateReview({ decision: 'rejected', note: 'Pièces illisibles' }).ok, true);
assert.equal(validateReview({ decision: 'delete' }).ok, false);
assert.equal(validateReview({ decision: 'approved', note: 'x'.repeat(501) }).ok, false);
assert.equal(validateReview(null).ok, false);

// CSP
const csp = buildSellerexCsp({ supabaseUrl: 'https://abc.supabase.co', nonce: 'N0nce' });
assert.ok(csp.includes("script-src 'self' 'nonce-N0nce'"));
assert.ok(!/script-src[^;]*unsafe-inline/.test(csp));     // aucun script en ligne sans nonce
assert.ok(!/script-src[^;]*unsafe-eval/.test(csp));
assert.ok(csp.includes("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co"));
assert.ok(csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") && csp.includes("base-uri 'self'"));
assert.ok(!csp.includes('*'));
assert.ok(buildSellerexCsp({ supabaseUrl: '', nonce: 'x' }).includes("connect-src 'self'"));  // pas d'URL : pas d'erreur

// page servie sur sellerex.*
const sample = `<!doctype html><html><head><meta charset="UTF-8" /><meta name="google-site-verification" content="x" />
<title>Vendza | Marketplace</title><link rel="canonical" href="https://www.vendza.store/" /><meta name="robots" content="index, follow" />
<meta property="og:title" content="Vendza" /><meta name="description" content="Vendza" /><meta property="twitter:card" content="x" />
<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#0f172a" />
<script type="application/ld+json">{"@type":"Organization"}</script></head><body><div id="root"><!--SEO_FALLBACK_START--><main>Vendza texte</main><!--SEO_FALLBACK_END--></div>
<script type="module" crossorigin src="/assets/index.js"></script><script id="vite-plugin-pwa:inline-sw">navigator.serviceWorker.register('/sw.js')</script></body></html>`;
const page = sellerexHtml(sample, { nonce: 'N1', supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'k</script><x>' });
assert.ok(page.includes('<title>Sellerex | Vendza</title>') && !page.includes('Vendza | Marketplace'));
for (const gone of ['canonical', 'manifest', 'og:title', 'twitter:card', 'ld+json', 'inline-sw', 'serviceWorker', 'Vendza texte', 'google-site-verification', 'index, follow']) assert.ok(!page.includes(gone), gone);
assert.ok(page.includes('name="robots" content="noindex, nofollow"'));
assert.ok(page.includes('<script id="supabase-config" nonce="N1">'));
assert.ok(page.includes('<script type="module" nonce="N1" crossorigin src="/assets/index.js">'));
assert.ok(page.includes('theme-color'));                       // le reste de la page est conservé
assert.ok(!page.includes('k</script><x>'));                    // une valeur ne peut pas fermer le script en ligne
assert.equal((page.match(/<script/g) || []).length, 2);        // config + module : aucun autre script exécutable

console.log('  ✓ sellerex: indicateur, hôte, grossiste, clés chiffrées, débit OK');
