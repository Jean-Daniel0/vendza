// Coordonnées des utilisateurs : e-mail et téléphone ne sont plus lisibles publiquement.
// Les tickets passent par la fonction SQL get_order_contacts (acheteur et vendeur de la commande seulement),
// la fiche vendeur par get_vendor_contact (utilisateur connecté, vendeur uniquement, téléphone seulement).

export type TicketParty = { prenom?: string; nom?: string; telephone?: string; avatar_url?: string };
export type TicketContacts = { buyer: TicketParty | null; vendor: TicketParty | null };

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

// Réponse de get_order_contacts -> objets propres (jamais d'exception si la réponse est vide ou mal formée)
export function parseOrderContacts(data: unknown): TicketContacts {
  if (!isObj(data)) return { buyer: null, vendor: null };
  const clean = (p: unknown): TicketParty | null => {
    if (!isObj(p)) return null;
    const out: TicketParty = {};
    if (typeof p.prenom === 'string') out.prenom = p.prenom;
    if (typeof p.nom === 'string') out.nom = p.nom;
    if (typeof p.telephone === 'string' && p.telephone.trim()) out.telephone = p.telephone.trim();
    if (typeof p.avatar_url === 'string') out.avatar_url = p.avatar_url;
    return out;
  };
  return { buyer: clean(data.buyer), vendor: clean(data.vendor) };
}

// Nom affiché d'un interlocuteur : jamais son e-mail comme nom de repli
export function displayName(prenom?: string | null, nom?: string | null, fallback = 'Utilisateur Vendza'): string {
  const full = [prenom, nom].map(s => String(s || '').trim()).filter(Boolean).join(' ');
  return full || fallback;
}

// Téléphone renvoyé par get_vendor_contact : texte non vide ou rien
export function cleanPhone(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
