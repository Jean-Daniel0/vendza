import assert from 'node:assert/strict';
import { validatePasswordChange, hasPasswordLogin, pushState, readPrefs, PREF_COLUMNS, PROFILE_FIELD, MIN_PASSWORD } from '../src/lib/accountSettings';
import { routeFromPath, pathForView } from '../src/lib/postAuthRoute';

assert.equal(validatePasswordChange('', 'abcdef', 'abcdef').ok, false);
assert.equal(validatePasswordChange('old', 'abc', 'abc').ok, false);
assert.equal(validatePasswordChange('old', 'abcdef', 'abcdeg').ok, false);
assert.equal(validatePasswordChange('abcdef', 'abcdef', 'abcdef').ok, false);
assert.equal(validatePasswordChange('old', 'a'.repeat(MIN_PASSWORD), 'a'.repeat(MIN_PASSWORD)).ok, true);

assert.equal(hasPasswordLogin([{ provider: 'google' }], 'google'), false);
assert.equal(hasPasswordLogin([{ provider: 'google' }, { provider: 'email' }], 'google'), true);
assert.equal(hasPasswordLogin([], 'email'), true);
assert.equal(hasPasswordLogin(null, 'google'), false);

assert.equal(pushState('granted'), 'granted'); assert.equal(pushState('nimporte'), 'unsupported'); assert.equal(pushState(undefined), 'unsupported');

assert.deepEqual(readPrefs({ newsletter: true, notif_commandes: false, notif_livraisons: false }), { promotions: true, cart: false, orders: false, messages: true });
assert.deepEqual(readPrefs({}), { promotions: false, cart: true, orders: true, messages: true });
assert.deepEqual(readPrefs(null), { promotions: false, cart: true, orders: true, messages: true });
assert.deepEqual(PREF_COLUMNS, { promotions: 'newsletter', cart: 'notif_commandes', orders: 'notif_livraisons', messages: 'notif_avis' });
for (const col of Object.values(PREF_COLUMNS)) assert.ok(PROFILE_FIELD[col]); // les colonnes réellement lues par le serveur

assert.deepEqual(routeFromPath('/parametres'), { view: 'settings' });
assert.equal(pathForView('settings'), '/parametres');
console.log('  ✓ accountSettings: mot de passe, connexion Google, permission push, préférences, adresse /parametres');
