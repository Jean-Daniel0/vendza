// Notes et popularité des produits.
// Une note n'existe que s'il y a de vrais avis : un produit sans avis est « pas encore noté », jamais 0 ni 5 par défaut.
export const POPULAR_MIN_REVIEWS = 10;
export const POPULAR_MIN_RATING = 4.5;

export type RatingInfo = { avg: number | null; count: number };

export function ratingInfo(reviews: Array<{ productId?: string; note?: number }>, productId: string): RatingInfo {
  const notes = (reviews || []).filter(r => r.productId === productId && Number.isFinite(Number(r.note)));
  if (!notes.length) return { avg: null, count: 0 };
  const sum = notes.reduce((t, r) => t + Number(r.note), 0);
  return { avg: Math.round((sum / notes.length) * 10) / 10, count: notes.length };
}

/** Vendeur vérifié : identité validée par l'administration, ou forfait Pro. */
export function isVerifiedVendor(p: { vendeurVerifie?: boolean; vendeurPlan?: string }): boolean {
  return p.vendeurVerifie === true || /pro/i.test(String(p.vendeurPlan || ''));
}

/** « Populaires & Vérifiés » : vendeur vérifié, au moins 10 avis et une note moyenne d'au moins 4,5. */
export function isPopularVerified(info: RatingInfo, p: { vendeurVerifie?: boolean; vendeurPlan?: string }): boolean {
  return isVerifiedVendor(p) && info.avg !== null && info.count >= POPULAR_MIN_REVIEWS && info.avg >= POPULAR_MIN_RATING;
}

/** Tri : plus d'avis d'abord, puis meilleure note. */
export const byPopularity = (a: RatingInfo, b: RatingInfo): number => (b.count - a.count) || ((b.avg ?? 0) - (a.avg ?? 0));
