import assert from 'node:assert/strict';
import { priceVendorOrder, promoPercent, isUnderpaid, usdCents, DbProduct } from '../server/pricing';
import { resolveShippingFee, sanitizeFees, legacyShippingFee } from '../src/lib/shipping';

const P = (id: string, price: number, o: Partial<DbProduct> = {}): [string, DbProduct] => [id, { id, name: 'Prod ' + id, price, stock: 10, vendor_id: 'V1', is_active: true, status: 'published', ...o }];
const prods = new Map([P('a', 1000), P('b', 500), P('low', 100, { stock: 2 }), P('off', 100, { is_active: false }), P('other', 100, { vendor_id: 'V2' }), P('big', 10, { stock: 1000 })]);
const base = { products: prods, vendorId: 'V1', shippingFee: 150, promoPct: 0 };

// prix pris en base, pas dans le navigateur
let r: any = priceVendorOrder({ ...base, items: [{ productId: 'a', qte: 2, prix: 1 }, { productId: 'b', qte: 1, prix: 1 }] });
assert.ok(r.ok); assert.equal(r.subtotal, 2500); assert.equal(r.total, 2650); assert.deepEqual(r.items.map((i: any) => i.prix), [1000, 500]);
// promotion validée côté serveur : sur les produits seulement, pas sur la livraison
r = priceVendorOrder({ ...base, promoPct: promoPercent('vendza10'), items: [{ productId: 'a', qte: 1 }] });
assert.equal(r.discount, 100); assert.equal(r.total, 1000 - 100 + 150);
assert.equal(promoPercent('FAUX'), 0); assert.equal(promoPercent(undefined), 0);
// refus : produit inconnu, autre vendeur, retiré, stock insuffisant (même réparti sur deux lignes), épuisé
assert.equal(priceVendorOrder({ ...base, items: [{ productId: 'zzz', qte: 1 }] }).ok, false);
assert.match((priceVendorOrder({ ...base, items: [{ productId: 'other', qte: 1 }] }) as any).error, /n'appartient pas/);
assert.match((priceVendorOrder({ ...base, items: [{ productId: 'off', qte: 1 }] }) as any).error, /plus disponible/);
assert.match((priceVendorOrder({ ...base, items: [{ productId: 'low', qte: 2 }, { productId: 'low', qte: 1 }] }) as any).error, /il n'en reste que 2/);
assert.equal(priceVendorOrder({ ...base, items: [] }).ok, false);
// quantités absurdes bornées
assert.equal((priceVendorOrder({ ...base, items: [{ productId: 'big', qte: 5000 }] }) as any).items[0].qte, 99);
assert.match((priceVendorOrder({ ...base, items: [{ productId: 'b', qte: 5000 }] }) as any).error, /Stock insuffisant/);
// paiement insuffisant : bloqué seulement si l'écart est net (pas pour de petits frais du fournisseur)
assert.equal(isUnderpaid(1, 2650), true); assert.equal(isUnderpaid(2000, 2650), true);
assert.equal(isUnderpaid(2600, 2650), false); assert.equal(isUnderpaid(2450, 2650), false); assert.equal(isUnderpaid(null, 2650), false);
assert.equal(usdCents(1300, 130), 1000); assert.equal(usdCents(10, 130), 50);

// frais de livraison saisis par le vendeur
const cfg = { shipping_fee_default: 300, shipping_fees: { Ouest: 100, 'Cap-Haïtien': 450, Nord: 400 } };
assert.equal(resolveShippingFee(cfg, 'Ouest', 'Delmas'), 100);          // tarif du département
assert.equal(resolveShippingFee(cfg, 'Nord', 'Cap-Haïtien'), 450);      // la commune passe avant le département
assert.equal(resolveShippingFee(cfg, 'Sud', 'Les Cayes'), 300);         // sinon tarif par défaut du vendeur
assert.equal(resolveShippingFee({ shipping_fee_default: 0 }, 'Sud', 'Les Cayes'), 0);   // 0 = livraison gratuite (choix du vendeur)
assert.equal(resolveShippingFee({}, 'Sud', 'Les Cayes'), 200);          // rien saisi : ancien tarif de la plateforme
assert.equal(resolveShippingFee(null, 'Ouest', 'Delmas'), 0);
assert.equal(resolveShippingFee({ shipping_fee_default: -5, shipping_fees: { Ouest: 'x' } }, 'Ouest', 'Delmas'), 0); // valeurs invalides ignorées
assert.deepEqual(sanitizeFees({ Ouest: '150', Nord: -1, Sud: 'abc', '': 5, Centre: 99999999 }), { Ouest: 150 });
assert.equal(legacyShippingFee('Jacmel'), 200);
console.log('  ✓ pricing: 30 assertions OK');
