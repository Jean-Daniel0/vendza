import assert from 'node:assert/strict';
import { privateFromUpdates, stripKeys, LEGACY_PROFILE_KEYS, LEGACY_SHOP_KEYS } from '../src/lib/privateData';

// seuls les champs modifiés partent vers la table privée, nettoyés
assert.deepEqual(privateFromUpdates({ prenom: 'A', moncash: ' 509 1234 ', idNumber: '12-34' }), { moncash: '509 1234', id_number: '12-34' });
assert.deepEqual(privateFromUpdates({ prenom: 'A', tel: '1' }), {});
assert.deepEqual(privateFromUpdates({ moncash: '', banque: undefined, compteBanque: null }), { moncash: '', bank_account: '' }); // vider un champ reste possible
// plus rien de sensible n'est écrit dans les anciennes colonnes publiques
const profile: any = { prenom: 'A', moncash: '1', numero_moncash: '1', bank_name: 'B', id_number: '9', avatar_url: 'x' };
assert.deepEqual(stripKeys(profile, LEGACY_PROFILE_KEYS), { prenom: 'A', avatar_url: 'x' });
const shop: any = { shop_name: 'S', moncash: '1', bank_account: '2', id_document_url: 'u', plan: 'gratuit' };
assert.deepEqual(stripKeys(shop, LEGACY_SHOP_KEYS), { shop_name: 'S', plan: 'gratuit' });
console.log('  ✓ privateData: 5 assertions OK');
