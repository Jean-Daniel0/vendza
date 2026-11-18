// Frais de livraison fixés par chaque vendeur (par boutique : tarif par défaut + tarifs par département ou commune).
export type ShippingConfig = { shipping_fee_default?: number | null; shipping_fees?: Record<string, unknown> | null };

export const MAX_SHIPPING_FEE = 100000;
const FREE_CAPITAL = ['Port-au-Prince', 'Pétion-Ville', 'Delmas', 'Carrefour'];

// Ancien tarif de la plateforme, appliqué tant que le vendeur n'a rien saisi
export const legacyShippingFee = (commune?: string): number => (!commune || FREE_CAPITAL.includes(commune) ? 0 : 200);

const clean = (n: unknown): number | null => {
  if (n === null || n === undefined || n === '') return null;
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 && v <= MAX_SHIPPING_FEE ? Math.round(v) : null;
};

// Priorité : tarif de la commune > tarif du département > tarif par défaut du vendeur > ancien tarif plateforme
export function resolveShippingFee(cfg: ShippingConfig | null | undefined, dept?: string, commune?: string): number {
  const fees = cfg?.shipping_fees && typeof cfg.shipping_fees === 'object' ? (cfg.shipping_fees as Record<string, unknown>) : {};
  const byCommune = commune ? clean(fees[commune]) : null;
  if (byCommune !== null) return byCommune;
  const byDept = dept ? clean(fees[dept]) : null;
  if (byDept !== null) return byDept;
  const def = clean(cfg?.shipping_fee_default);
  if (def !== null) return def;
  return legacyShippingFee(commune);
}

// Nettoie ce que le vendeur saisit avant l'enregistrement : ne garde que des montants valides
export function sanitizeFees(input: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(input || {}).slice(0, 60).forEach(([k, v]) => { const n = clean(v); if (n !== null && k.trim()) out[k.trim()] = n; });
  return out;
}

// Livraison offerte sur la 1re commande d'un client : Vendza prend en charge les 250 premières gourdes de livraison
// et la moitié du reste. Le vendeur reçoit toujours la livraison en entier ; seul le client paie moins.
export const FIRST_ORDER_FREE_SHIPPING = 250;
export const FIRST_ORDER_SHARE_ABOVE = 0.5;
export function firstOrderShippingSubsidy(fee: number): number {
  const f = Math.max(0, Math.round(Number(fee) || 0));
  if (f <= FIRST_ORDER_FREE_SHIPPING) return f;
  return Math.round(FIRST_ORDER_FREE_SHIPPING + (f - FIRST_ORDER_FREE_SHIPPING) * FIRST_ORDER_SHARE_ABOVE);
}
