// Le serveur fixe lui-même les montants : prix en base, frais du vendeur, promotion validée. Rien n'est pris tel quel du navigateur.
export const PROMO_CODES: Record<string, number> = { VENDZA10: 10, BIENVENUE: 15, HAITI20: 20 };
export const promoPercent = (code?: unknown): number => PROMO_CODES[String(code || '').trim().toUpperCase()] || 0;

export type DbProduct = { id: string; name?: string | null; price: number; stock?: number | null; vendor_id?: string | null; is_active?: boolean | null; status?: string | null };
export type PricedItem = { productId: string; qte: number; prix: number; nom: string; [k: string]: unknown };
export type Priced = { ok: true; items: PricedItem[]; subtotal: number; discount: number; shipping: number; total: number } | { ok: false; error: string };

const idOf = (it: any) => String(it?.productId || it?.product_id || it?.id || '');
const qtyOf = (it: any) => Math.max(1, Math.min(99, Math.floor(Number(it?.qte ?? it?.quantity ?? it?.qty ?? 1) || 1)));

export function priceVendorOrder(a: { items: any[]; products: Map<string, DbProduct>; vendorId: string; shippingFee: number; promoPct: number }): Priced {
  if (!Array.isArray(a.items) || a.items.length === 0) return { ok: false, error: 'Panier vide.' };
  const wanted = new Map<string, number>();
  const out: PricedItem[] = [];
  for (const it of a.items) {
    const id = idOf(it); const p = a.products.get(id);
    if (!p) return { ok: false, error: 'Un produit de votre panier est introuvable. Rechargez la page.' };
    if (a.vendorId && p.vendor_id && String(p.vendor_id) !== String(a.vendorId)) return { ok: false, error: `« ${p.name || 'Produit'} » n'appartient pas à ce vendeur.` };
    if (p.is_active === false || (p.status ?? 'published') !== 'published') return { ok: false, error: `« ${p.name || 'Produit'} » n'est plus disponible.` };
    const qte = qtyOf(it);
    wanted.set(id, (wanted.get(id) || 0) + qte);
    out.push({ ...it, productId: id, qte, prix: Number(p.price) || 0, nom: String(p.name || it?.nom || 'Produit') });
  }
  for (const [id, qty] of wanted) {
    const p = a.products.get(id)!;
    if (p.stock != null && Number(p.stock) < qty) {
      return { ok: false, error: Number(p.stock) <= 0 ? `« ${p.name || 'Produit'} » est épuisé.` : `Stock insuffisant pour « ${p.name || 'Produit'} » : il n'en reste que ${p.stock}.` };
    }
  }
  const subtotal = out.reduce((s, i) => s + i.prix * i.qte, 0);
  const discount = Math.round((subtotal * Math.max(0, Math.min(100, a.promoPct))) / 100);
  const shipping = Math.max(0, Math.round(a.shippingFee || 0));
  return { ok: true, items: out, subtotal, discount, shipping, total: subtotal - discount + shipping };
}

// Garde-fou : refuse de créer des commandes « payées » si le paiement reçu est nettement inférieur à ce qui était dû.
// 10 % de marge par défaut pour absorber d'éventuels frais du fournisseur (réglable : UNDERPAID_BLOCK_PCT).
export const isUnderpaid = (paid: number | null | undefined, expected: number, blockPct = 10): boolean =>
  Number(paid) > 0 && expected > 0 && Number(paid) < expected * (1 - Math.max(0, blockPct) / 100) - 1;

export const usdCents = (totalHtg: number, htgPerUsd: number): number => Math.max(50, Math.round((totalHtg / (htgPerUsd || 130)) * 100));
