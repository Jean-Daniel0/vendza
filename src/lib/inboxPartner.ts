// Détermine l'interlocuteur d'une conversation, quel que soit le rôle de l'utilisateur.
export const SYSTEM_USER_ID = '99999999-9999-4999-9999-999999999999';

type Conv = { buyer_id?: string | null; vendor_id?: string | null; product_id?: string | null };
type Msg = { senderId: string; recipientId?: string; productId?: string };

export function derivePartner(conv: Conv, userId: string, messages: Msg[]): { partnerId: string; partnerIsVendor: boolean } {
  let partnerId = (conv.buyer_id === userId ? conv.vendor_id : conv.buyer_id) || '';
  // Conversation « avec soi-même » (ancien bug de rôle) : le vrai interlocuteur se lit dans les messages de ce produit
  if (!partnerId || partnerId === userId) {
    const pId = conv.product_id || '';
    const sameProduct = (m: Msg) => !pId || m.productId === pId;
    const incoming = messages.find(m => sameProduct(m) && m.senderId !== userId && m.recipientId === userId && m.senderId !== SYSTEM_USER_ID);
    const outgoing = messages.find(m => sameProduct(m) && m.senderId === userId && m.recipientId && m.recipientId !== userId);
    partnerId = incoming ? incoming.senderId : outgoing ? (outgoing.recipientId as string) : '';
  }
  return { partnerId, partnerIsVendor: !!partnerId && partnerId === conv.vendor_id };
}
