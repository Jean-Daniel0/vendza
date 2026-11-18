// Programme fondateurs : 50 places réparties à parts égales entre les catégories, -90 % sur la commission Vendza pendant 90 jours.
import { commissionRate } from './commission';

export const FOUNDER_TOTAL = 50;
export const FOUNDER_DAYS = 90;
export const FOUNDER_DISCOUNT = 0.9;
export const FOUNDER_MIN_PRODUCTS = 5;
export const FOUNDER_CATEGORIES = ['Mode', 'Électronique', 'Maison', 'Beauté', 'Alimentation', 'Sport', 'Audio', 'Photo', 'Gaming', 'Autre'];
export const FOUNDER_PER_CATEGORY = Math.floor(FOUNDER_TOTAL / FOUNDER_CATEGORIES.length);

export const isFounderActive = (expiresAt: unknown, now: Date = new Date()): boolean => {
  const t = expiresAt ? new Date(String(expiresAt)).getTime() : NaN;
  return Number.isFinite(t) && t > now.getTime();
};

/** Commission en fraction : la remise s'applique à la commission Vendza (20 % -> 2 %). */
export const effectiveCommissionRate = (plan: unknown, method: unknown, founderActive: boolean): number => {
  const base = commissionRate(plan, method);
  return founderActive ? base * (1 - FOUNDER_DISCOUNT) : base;
};

/** Catégorie de quota d'une boutique : la première de ses catégories connues, sinon « Autre ». */
export const founderCategory = (categories: unknown): string => {
  const list = Array.isArray(categories) ? categories : [];
  const hit = list.find(c => FOUNDER_CATEGORIES.includes(String(c)));
  return hit ? String(hit) : 'Autre';
};

export const FOUNDER_MESSAGES: Record<string, string> = {
  deja_inscrit: 'Tu fais déjà partie du programme fondateurs.',
  identite_non_verifiee: "Ton identité doit d'abord être vérifiée.",
  produits_insuffisants: `Il faut au moins ${FOUNDER_MIN_PRODUCTS} produits en ligne.`,
  complet: 'Les 50 places sont toutes prises.',
  categorie_complete: 'Les places de ta catégorie sont toutes prises.',
};
