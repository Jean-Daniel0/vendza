// Où envoyer l'utilisateur après une connexion ou une inscription explicite.
// Fonction pure : aucune dépendance à React ni au navigateur (testable).

export type AuthMode = 'login' | 'signup';
export type UserKind = 'client' | 'vendeur';

export interface PostAuthRoute {
  view: string;        // vue de l'application
  url: string;         // adresse affichée dans la barre du navigateur
  clientTab?: 'dashboard' | 'profile'; // onglet du tableau de bord client
  welcome: boolean;    // afficher le message « complétez votre profil »
}

export function postAuthRoute(opts: { userType: UserKind | string; mode: AuthMode; hasPendingConfirm?: boolean }): PostAuthRoute {
  const vendeur = opts.userType === 'vendeur';
  const signup = opts.mode === 'signup';
  // Un acheteur qui vient de scanner le QR de livraison doit finir au scanner : on ne touche pas à la vue
  // (l'effet « pendingConfirm » de App.tsx le dirige ensuite vers le scanner).
  if (opts.hasPendingConfirm) {
    return vendeur
      ? { view: 'vendor-dashboard', url: '/vendeur/tableau-de-bord-vendeur', welcome: false }
      : { view: 'client-dashboard', url: '/client/tableau-de-bord-client', clientTab: 'dashboard', welcome: false };
  }
  if (vendeur) {
    return signup
      ? { view: 'shop-settings', url: '/vendeur/profil', welcome: true }
      : { view: 'vendor-dashboard', url: '/vendeur/tableau-de-bord-vendeur', welcome: false };
  }
  return signup
    ? { view: 'client-dashboard', url: '/client/profil', clientTab: 'profile', welcome: true }
    : { view: 'client-dashboard', url: '/client/tableau-de-bord-client', clientTab: 'dashboard', welcome: false };
}

// Adresse -> vue, pour recharger la page sur une adresse de destination.
export function routeFromPath(pathname: string): { view: string; clientTab?: 'dashboard' | 'profile' } | null {
  const p = String(pathname || '').replace(/\/+$/, '');
  switch (p) {
    case '/client/tableau-de-bord-client': return { view: 'client-dashboard', clientTab: 'dashboard' };
    case '/client/profil': return { view: 'client-dashboard', clientTab: 'profile' };
    case '/vendeur/tableau-de-bord-vendeur': return { view: 'vendor-dashboard' };
    case '/vendeur/profil': return { view: 'shop-settings' };
    default: return null;
  }
}

// Vue -> adresse (null = pas d'adresse dédiée).
export function pathForView(view: string, clientTab: 'dashboard' | 'profile' = 'dashboard'): string | null {
  if (view === 'client-dashboard') return clientTab === 'profile' ? '/client/profil' : '/client/tableau-de-bord-client';
  if (view === 'vendor-dashboard') return '/vendeur/tableau-de-bord-vendeur';
  if (view === 'shop-settings') return '/vendeur/profil';
  return null;
}

export function isRoutedPath(pathname: string): boolean {
  return routeFromPath(pathname) !== null;
}
