import assert from 'node:assert/strict';
import { postAuthRoute, routeFromPath, pathForView, isRoutedPath } from '../src/lib/postAuthRoute';

// Connexion : tableau de bord
assert.deepEqual(postAuthRoute({ userType: 'client', mode: 'login' }), { view: 'client-dashboard', url: '/client/tableau-de-bord-client', clientTab: 'dashboard', welcome: false });
assert.deepEqual(postAuthRoute({ userType: 'vendeur', mode: 'login' }), { view: 'vendor-dashboard', url: '/vendeur/tableau-de-bord-vendeur', welcome: false });
// Inscription : profil à compléter, avec message
assert.deepEqual(postAuthRoute({ userType: 'client', mode: 'signup' }), { view: 'client-dashboard', url: '/client/profil', clientTab: 'profile', welcome: true });
assert.deepEqual(postAuthRoute({ userType: 'vendeur', mode: 'signup' }), { view: 'shop-settings', url: '/vendeur/profil', welcome: true });
// Lien QR en attente : pas de message, tableau de bord (le scanner prend ensuite la main)
assert.equal(postAuthRoute({ userType: 'client', mode: 'signup', hasPendingConfirm: true }).welcome, false);
assert.equal(postAuthRoute({ userType: 'client', mode: 'signup', hasPendingConfirm: true }).view, 'client-dashboard');
// Type inconnu = client
assert.equal(postAuthRoute({ userType: 'autre', mode: 'login' }).view, 'client-dashboard');

// Adresse <-> vue, dans les deux sens, pour chaque destination
for (const mode of ['login', 'signup'] as const) for (const t of ['client', 'vendeur']) {
  const r = postAuthRoute({ userType: t, mode });
  const back = routeFromPath(r.url);
  assert.ok(back, `adresse non reconnue : ${r.url}`);
  assert.equal(back!.view, r.view);
  assert.equal(pathForView(r.view, r.clientTab), r.url);
}
assert.equal(routeFromPath('/client/profil/')!.clientTab, 'profile');
assert.equal(routeFromPath('/'), null);
assert.equal(routeFromPath('/panier'), null);
assert.equal(pathForView('cart'), null);
assert.equal(isRoutedPath('/vendeur/profil'), true);
assert.equal(isRoutedPath('/'), false);
console.log('  ✓ postAuthRoute: destinations après connexion/inscription et adresses');
