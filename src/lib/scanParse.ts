import type { Order } from '../types';

export type ScanParsed = { id: string; code: string };

/** Lit le contenu d'un QR : lien ?confirm=<id>&code=<code> (ou ?order= / ?id=), ou identifiant brut. */
export function parseScan(text: string): ScanParsed {
  const raw = String(text || '').trim();
  const dec = (v: string) => { try { return decodeURIComponent(v); } catch { return v; } };
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const id = u.searchParams.get('confirm') || u.searchParams.get('order') || u.searchParams.get('id') || '';
      const code = u.searchParams.get('code') || '';
      if (id) return { id, code };
    }
  } catch { /* lien illisible : on retombe sur l'analyse du texte */ }
  const m = raw.match(/[?&](?:confirm|order|id)=([^&\s]+)(?:.*[?&]code=([^&\s]+))?/i);
  if (m) return { id: dec(m[1]), code: m[2] ? dec(m[2]) : '' };
  return { id: raw, code: '' };
}

/** Code de livraison : majuscules, lettres et chiffres seulement (le tiret d'affichage ABCD-EFGH est ignoré). */
export const cleanCode = (c: unknown): string => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export type Precheck = { ok: true; order: Order; code: string } | { ok: false; message: string };

/** Vérifications avant d'afficher la commande (le serveur refait toutes les siennes : ceci évite seulement des allers-retours inutiles). */
export function precheckScan(orders: Order[], userId: string | undefined, text: string, extraCode?: string): Precheck {
  const { id, code: urlCode } = parseScan(text);
  if (!id) return { ok: false, message: "QR illisible. Réessayez ou saisissez le code du vendeur." };
  const order = orders.find(o => o.id.toLowerCase() === id.toLowerCase());
  if (!order) return { ok: false, message: "Ce QR ne correspond à aucune de vos commandes." };
  if (userId && order.clientId !== userId) return { ok: false, message: "Cette commande appartient à un autre compte. Connectez-vous avec le compte de l'acheteur." };
  if (order.status === 'livree') return { ok: false, message: "Cette commande est déjà confirmée." };
  if (order.status === 'annulee') return { ok: false, message: "Cette commande a été annulée." };
  if (order.status !== 'payee') return { ok: false, message: "Cette commande n'est pas encore payée." };
  const code = cleanCode(extraCode || urlCode);
  if (code.length < 6) return { ok: false, message: "Ce QR ne contient pas le code de livraison. Demandez au vendeur d'afficher le QR de son ticket, ou saisissez son code." };
  return { ok: true, order, code };
}
