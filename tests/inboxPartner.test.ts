import assert from 'node:assert/strict';
import { derivePartner } from '../src/lib/inboxPartner';

const ME = 'me', VENDOR = 'vendor-1', BUYER = 'buyer-1';
// acheteur normal
assert.deepEqual(derivePartner({ buyer_id: ME, vendor_id: VENDOR }, ME, []), { partnerId: VENDOR, partnerIsVendor: true });
// vendeur voyant l'acheteur
assert.deepEqual(derivePartner({ buyer_id: BUYER, vendor_id: ME }, ME, []), { partnerId: BUYER, partnerIsVendor: false });
// VENDEUR qui est ACHETEUR chez un autre vendeur (cas qui disparaissait de la liste)
assert.deepEqual(derivePartner({ buyer_id: ME, vendor_id: VENDOR }, ME, []), { partnerId: VENDOR, partnerIsVendor: true });
// conversation « avec soi-même » (buyer = vendor = moi) : interlocuteur lu dans les messages reçus du produit
const selfConv = { buyer_id: ME, vendor_id: ME, product_id: 'P1' };
assert.deepEqual(derivePartner(selfConv, ME, [{ senderId: 'Y', recipientId: ME, productId: 'P1' }]), { partnerId: 'Y', partnerIsVendor: false });
// … ou dans les messages que j'ai envoyés
assert.deepEqual(derivePartner(selfConv, ME, [{ senderId: ME, recipientId: 'Z', productId: 'P1' }]), { partnerId: 'Z', partnerIsVendor: false });
// message système ignoré ; autre produit ignoré
assert.equal(derivePartner(selfConv, ME, [{ senderId: '99999999-9999-4999-9999-999999999999', recipientId: ME, productId: 'P1' }]).partnerId, '');
assert.equal(derivePartner(selfConv, ME, [{ senderId: 'Y', recipientId: ME, productId: 'OTHER' }]).partnerId, '');
console.log('  ✓ inboxPartner: 7 assertions OK');
