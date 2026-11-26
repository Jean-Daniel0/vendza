// Logique pure de la page Paramètres (testable sans navigateur).

export const MIN_PASSWORD = 6;

export type PwdCheck = { ok: true } | { ok: false; error: string };

export function validatePasswordChange(current: string, next: string, confirm: string): PwdCheck {
  if (!current) return { ok: false, error: 'Saisissez votre mot de passe actuel.' };
  if (next.length < MIN_PASSWORD) return { ok: false, error: `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.` };
  if (next !== confirm) return { ok: false, error: 'Les deux mots de passe ne correspondent pas.' };
  if (next === current) return { ok: false, error: 'Le nouveau mot de passe doit être différent de l\'actuel.' };
  return { ok: true };
}

/** Un compte créé uniquement avec Google n'a pas de mot de passe Vendza à changer. */
export function hasPasswordLogin(identities: Array<{ provider?: string }> | null | undefined, provider?: string | null): boolean {
  if (Array.isArray(identities) && identities.length) return identities.some(i => i?.provider === 'email');
  return !provider || provider === 'email';
}

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied';
export const pushState = (perm: unknown): PushState => (perm === 'default' || perm === 'granted' || perm === 'denied' ? perm : 'unsupported');

export const PREF_COLUMNS = { promotions: 'newsletter', cart: 'notif_commandes', orders: 'notif_livraisons', messages: 'notif_avis' } as const;
/** Nom du champ correspondant dans le profil gardé par l'application. */
export const PROFILE_FIELD: Record<(typeof PREF_COLUMNS)[keyof typeof PREF_COLUMNS], string> = { newsletter: 'newsletter', notif_commandes: 'notifCommandes', notif_livraisons: 'notifLivraisons', notif_avis: 'notifAvis' };
export type PrefKey = keyof typeof PREF_COLUMNS;

/** Valeur lue en base : une colonne absente ou nulle prend la valeur par défaut de la base (promotions : non, rappels : oui). */
export function readPrefs(row: Record<string, unknown> | null | undefined): Record<PrefKey, boolean> {
  return { promotions: row?.newsletter === true, cart: row?.notif_commandes !== false, orders: row?.notif_livraisons !== false, messages: row?.notif_avis !== false };
}
