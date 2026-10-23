import { supabase, isSupabaseConfigured } from './supabaseClient';

const seen = new Set<string>();

// Enregistre l'intérêt du client pour la catégorie d'un produit (vue = 1, panier = 3).
// Silencieux : ne doit jamais gêner la navigation. Une seule vue par produit et par session.
export function trackProductInterest(productId: string | undefined, userId: string | undefined, weight = 1): void {
  if (!productId || !userId || !isSupabaseConfigured || !supabase) return;
  const key = `${productId}:${weight}`;
  if (seen.has(key)) return;
  seen.add(key);
  Promise.resolve(supabase.rpc('track_product_view', { p_product_id: productId, p_weight: weight })).catch(() => {});
}
