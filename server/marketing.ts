// Ventes Flash + suggestions personnalisées : logique pure (testable), sans accès réseau.
export const HAITI_TZ = 'America/Port-au-Prince';

export function haitiClock(now: Date): { hour: number; minute: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HAITI_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '0';
  return { hour: Number(get('hour')), minute: Number(get('minute')), dateKey: `${get('year')}-${get('month')}-${get('day')}` };
}

// Même fenêtre que la bannière du site : tous les jours de 8h00 à 20h00 (heure d'Haïti)
export const isFlashWindow = (now: Date): boolean => {
  const { hour } = haitiClock(now);
  return hour >= 8 && hour < 20;
};

export type ProductLite = {
  id: string; name: string; price: number; old_price?: number | null; stock?: number | null;
  category?: string | null; vendor_id?: string | null; created_at?: string | null; is_active?: boolean | null; status?: string | null;
};

export const discountPct = (p: ProductLite): number =>
  p.old_price && Number(p.old_price) > Number(p.price) ? Math.round((1 - Number(p.price) / Number(p.old_price)) * 100) : 0;

const sellable = (p: ProductLite) =>
  p.is_active !== false && (p.status ?? 'published') === 'published' && (p.stock == null || Number(p.stock) > 0);

export function flashSummary(products: ProductLite[]): { count: number; maxPct: number } {
  const flash = products.filter(p => sellable(p) && discountPct(p) > 0);
  return { count: flash.length, maxPct: flash.reduce((m, p) => Math.max(m, discountPct(p)), 0) };
}

export function buildFlashMessage(s: { count: number; maxPct: number }): { title: string; message: string } {
  return {
    title: `🔥 Ventes Flash — jusqu'à -${s.maxPct}%`,
    message: `${s.count} produit${s.count > 1 ? 's' : ''} en promotion jusqu'à 20h00. Ne les laissez pas filer !`
  };
}

export type Interest = { category: string; score: number; last_viewed_at?: string | null; last_notified_at?: string | null };

export const HALF_LIFE_DAYS = 14;
export function effectiveScore(i: Interest, now: Date): number {
  const days = i.last_viewed_at ? Math.max(0, (now.getTime() - new Date(i.last_viewed_at).getTime()) / 86400000) : 0;
  return Number(i.score || 0) * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

export type Recommendation = { category: string; product: ProductLite; discount: number };

export function pickRecommendation(
  interests: Interest[], products: ProductLite[], opts: { userId: string; now: Date; minGapMs?: number; topN?: number }
): Recommendation | null {
  const gap = opts.minGapMs ?? 3 * 86400000;
  // Un seul message toutes les 72 h, toutes catégories confondues
  if (interests.some(i => i.last_notified_at && opts.now.getTime() - new Date(i.last_notified_at).getTime() < gap)) return null;
  const ranked = [...interests].filter(i => i.category).sort((a, b) => effectiveScore(b, opts.now) - effectiveScore(a, opts.now)).slice(0, opts.topN ?? 3);
  for (const it of ranked) {
    const pool = products.filter(p => p.category === it.category && p.vendor_id !== opts.userId && sellable(p));
    if (pool.length === 0) continue;
    const best = [...pool].sort((a, b) =>
      discountPct(b) - discountPct(a) || new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    return { category: it.category, product: best, discount: discountPct(best) };
  }
  return null;
}

export function buildRecommendationMessage(r: Recommendation): { title: string; message: string } {
  const name = String(r.product.name || 'ce produit').trim();
  return r.discount > 0
    ? { title: `🔥 Pour vous : -${r.discount}% sur ${name}`, message: `Vous aimez la catégorie ${r.category}. Profitez de cette promo avant qu'elle disparaisse !` }
    : { title: `✨ Nouveau en ${r.category}`, message: `${name} vous attend. Jetez-y un œil !` };
}
