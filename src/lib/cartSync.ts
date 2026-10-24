import type { CartItem, Product } from '../types';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LOW_STOCK_THRESHOLD = 3;
export type CartRow = { product_id: string; color: string; size: string; quantity: number };

const clamp = (n: number) => Math.max(1, Math.min(99, Math.floor(Number(n) || 1)));
export const rowKey = (r: { product_id: string; color: string; size: string }) => `${r.product_id}|${r.color}|${r.size}`;
export const itemKey = (i: CartItem) => `${i.product.id}|${i.selectedColor || ''}|${i.selectedSize || ''}`;
export const isLowStock = (p: { stock?: number }) => Number(p.stock) > 0 && Number(p.stock) <= LOW_STOCK_THRESHOLD;

// Le panier est enregistré sous forme compacte (ids + quantités) : seuls les vrais produits (UUID) sont conservés côté base
export const toRows = (cart: CartItem[]): CartRow[] =>
  cart.filter(i => UUID_RE.test(i.product.id)).map(i => ({ product_id: i.product.id, color: i.selectedColor || '', size: i.selectedSize || '', quantity: clamp(i.quantity) }));

export function mergeRows(a: CartRow[], b: CartRow[]): CartRow[] {
  const m = new Map<string, CartRow>();
  [...a, ...b].forEach(r => { const k = rowKey(r); const cur = m.get(k); m.set(k, cur ? { ...cur, quantity: Math.max(cur.quantity, r.quantity) } : { ...r }); });
  return [...m.values()];
}

// Retrouve les produits actuels (prix/stock à jour). Un produit supprimé du catalogue disparaît ; un produit épuisé reste dans le panier.
export function hydrate(rows: CartRow[], products: Product[]): CartItem[] {
  const byId = new Map(products.map(p => [p.id, p]));
  const out: CartItem[] = [];
  rows.forEach(r => {
    const p = byId.get(r.product_id); if (!p) return;
    const qty = p.stock > 0 ? Math.min(clamp(r.quantity), p.stock) : clamp(r.quantity);
    out.push({ product: p, quantity: qty, selectedColor: r.color || undefined, selectedSize: r.size || undefined });
  });
  return out;
}

export function mergeCartItems(a: CartItem[], b: CartItem[]): CartItem[] {
  const m = new Map<string, CartItem>();
  [...a, ...b].forEach(i => {
    const k = itemKey(i); const cur = m.get(k);
    if (!cur) { m.set(k, { ...i }); return; }
    const qty = Math.max(cur.quantity, i.quantity);
    m.set(k, { ...cur, quantity: cur.product.stock > 0 ? Math.min(qty, cur.product.stock) : qty });
  });
  return [...m.values()];
}

export function diffRows(prev: CartRow[], next: CartRow[]) {
  const p = new Map(prev.map(r => [rowKey(r), r])), n = new Map(next.map(r => [rowKey(r), r]));
  return {
    inserts: next.filter(r => !p.has(rowKey(r))),
    updates: next.filter(r => p.has(rowKey(r)) && p.get(rowKey(r))!.quantity !== r.quantity),
    deletes: prev.filter(r => !n.has(rowKey(r))),
  };
}

// Après un paiement : on retire seulement ce qui a été payé. Le reste du panier est conservé.
export type PaidItem = { productId: string; couleur?: string; taille?: string; qte?: number };
export function removePaid(cart: CartItem[], paid: PaidItem[]): CartItem[] {
  if (!paid.length) return cart;
  return cart.flatMap(item => {
    const match = paid.find(p => p.productId === item.product.id && (p.couleur || '') === (item.selectedColor || '') && (p.taille || '') === (item.selectedSize || ''));
    if (!match) return [item];
    const left = item.quantity - (match.qte ?? item.quantity);
    return left > 0 ? [{ ...item, quantity: left }] : [];
  });
}

export const localCartKey = (owner: string) => `vendza_cart_v2:${owner}`;
export function readLocalRows(owner: string, storage: Pick<Storage, 'getItem'> = localStorage): CartRow[] {
  try { const v = JSON.parse(storage.getItem(localCartKey(owner)) || '[]'); return Array.isArray(v) ? v.filter(r => r && typeof r.product_id === 'string').map(r => ({ product_id: r.product_id, color: r.color || '', size: r.size || '', quantity: clamp(r.quantity) })) : []; } catch { return []; }
}
