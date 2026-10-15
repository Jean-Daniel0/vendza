import assert from 'node:assert/strict';
import { productRefTag, withProductTagOnFirstMessage } from '../src/lib/chatText';

const p = { id: '3992990a-fda0-44fb-88e3-1e91bdc997da', nom: 'Tablette BLU' };
assert.equal(productRefTag(p), '📦 Tablette BLU · Réf. #3992990A');
assert.equal(withProductTagOnFirstMessage({ text: 'Bonjour, encore disponible ?', product: p, hasHistory: false }), '📦 Tablette BLU · Réf. #3992990A\n\nBonjour, encore disponible ?');
assert.equal(withProductTagOnFirstMessage({ text: 'Merci', product: p, hasHistory: true }), 'Merci');                 // pas le premier message
assert.equal(withProductTagOnFirstMessage({ text: 'Bonjour', product: null, hasHistory: false }), 'Bonjour');         // pas de produit
assert.equal(withProductTagOnFirstMessage({ text: 'ID cmd', product: p, hasHistory: false, orderId: 'o1' }), 'ID cmd'); // message de commande
assert.equal(withProductTagOnFirstMessage({ text: '   ', product: p, hasHistory: false }), '   ');                    // image seule / vide
assert.equal(productRefTag({ id: 'p1', nom: 'Robe' }), '📦 Robe · Réf. #P1');
console.log('  ✓ chatText: 6 assertions OK');
