import assert from 'node:assert/strict';
import { toRows, mergeRows, hydrate, mergeCartItems, diffRows, removePaid, readLocalRows, isLowStock } from '../src/lib/cartSync';
const U = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const P = (n: number, stock = 10): any => ({ id: U(n), nom: 'P' + n, prix: 100, stock });
const I = (n: number, quantity = 1, selectedColor?: string, selectedSize?: string, stock = 10): any => ({ product: P(n, stock), quantity, selectedColor, selectedSize });

// sérialisation : produits de démo (non UUID) ignorés, quantités bornées
let rows = toRows([I(1, 2, 'Rouge'), { product: { id: 'demo-1', stock: 5 }, quantity: 1 } as any, I(2, 500)]);
assert.equal(rows.length, 2); assert.deepEqual(rows[0], { product_id: U(1), color: 'Rouge', size: '', quantity: 2 }); assert.equal(rows[1].quantity, 99);
// restauration : prix/stock à jour, produit supprimé retiré, quantité plafonnée au stock, épuisé conservé
const hyd = hydrate([{ product_id: U(1), color: '', size: '', quantity: 5 }, { product_id: U(9), color: '', size: '', quantity: 1 }, { product_id: U(3), color: '', size: '', quantity: 2 }], [P(1, 3), P(3, 0)]);
assert.deepEqual(hyd.map(i => [i.product.id, i.quantity]), [[U(1), 3], [U(3), 2]]);
// fusion invité + compte : union, quantité max
assert.deepEqual(mergeRows([{ product_id: U(1), color: '', size: '', quantity: 1 }], [{ product_id: U(1), color: '', size: '', quantity: 4 }, { product_id: U(2), color: '', size: '', quantity: 1 }]).map(r => r.quantity), [4, 1]);
assert.equal(mergeCartItems([I(1, 2)], [I(1, 5), I(2, 1)]).length, 2);
// synchronisation : seulement les différences
const d = diffRows([{ product_id: U(1), color: '', size: '', quantity: 1 }, { product_id: U(2), color: '', size: '', quantity: 1 }], [{ product_id: U(1), color: '', size: '', quantity: 3 }, { product_id: U(4), color: '', size: '', quantity: 1 }]);
assert.deepEqual([d.inserts.length, d.updates.length, d.deletes.length], [1, 1, 1]);
// paiement : seul ce qui est payé disparaît
const cart = [I(1, 2), I(2, 1), I(3, 4, 'Bleu', 'M')];
let after = removePaid(cart, [{ productId: U(1), qte: 2 }, { productId: U(3), couleur: 'Bleu', taille: 'M', qte: 1 }]);
assert.deepEqual(after.map(i => [i.product.id, i.quantity]), [[U(2), 1], [U(3), 3]]);          // 2 non payé conservé, 3 réduit
assert.equal(removePaid(cart, []).length, 3);                                                    // commande inconnue : on ne touche à rien
assert.equal(removePaid(cart, [{ productId: U(3), couleur: 'Rouge', taille: 'M' }]).length, 3);  // autre variante : conservé
// stock bas
assert.ok(isLowStock({ stock: 3 }) && isLowStock({ stock: 1 }) && !isLowStock({ stock: 4 }) && !isLowStock({ stock: 0 }));
// stockage local corrompu : panier vide, pas d'erreur
assert.deepEqual(readLocalRows('x', { getItem: () => '{pas du json' }), []);
assert.equal(readLocalRows('x', { getItem: () => JSON.stringify([{ product_id: U(1), quantity: 2 }, { nope: 1 }]) }).length, 1);
console.log('  ✓ cartSync: 20 assertions OK');
