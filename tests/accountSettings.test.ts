import assert from 'node:assert/strict';
import { validatePasswordChange, hasPasswordLogin, pushState, readPrefs, PREF_COLUMNS, MIN_PASSWORD } from '../src/lib/accountSettings';
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

assert.deepEqual(readPrefs({ newsletter: true, notif_commandes: false }), { promotions: true, cart: false });
assert.deepEqual(readPrefs({}), { promotions: false, cart: true });
assert.deepEqual(readPrefs(null), { promotions: false, cart: true });
assert.deepEqual(PREF_COLUMNS, { promotions: 'newsletter', cart: 'notif_commandes' }); // les colonnes réellement lues par le serveur

assert.deepEqual(routeFromPath('/parametres'), { view: 'settings' });
assert.equal(pathForView('settings'), '/parametres');
console.log('  ✓ accountSettings: mot de passe, connexion Google, permission push, préférences, adresse /parametres');
