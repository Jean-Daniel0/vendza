// Référence courte d'un produit pour le tout premier message d'une conversation ouverte depuis sa page détail.
export interface ChatProductRef { id: string; nom: string }

export const productRefTag = (p: ChatProductRef): string =>
  `📦 ${String(p.nom || 'Produit').trim()} · Réf. #${String(p.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;

// Ajoute la référence (nom + id court) seulement au PREMIER message échangé à propos de ce produit.
export function withProductTagOnFirstMessage(args: {
  text: string;
  product?: ChatProductRef | null;
  hasHistory: boolean;   // un message existe déjà entre ces deux personnes pour ce produit
  orderId?: string;      // les messages liés à une commande ne sont pas modifiés
}): string {
  const { text, product, hasHistory, orderId } = args;
  if (!product || hasHistory || orderId || !String(text || '').trim()) return text;
  return `${productRefTag(product)}\n\n${text}`;
}
