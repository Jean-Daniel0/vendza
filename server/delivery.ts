// Logique « eskrow » côté serveur : l'argent ne sort que si (1) il est entré (paiement vérifié par le serveur),
// (2) l'ACHETEUR confirme la réception (jeton Supabase), (3) la transition est atomique (une seule fois).
import crypto from 'crypto';

export type Db = any; // client Supabase (ou faux client dans les tests)
export type Result = { status: number; body: any };

const BUYER_KEYS = ['buyer_id', 'client_id', 'customer_id', 'user_id'];
const SELLER_KEYS = ['vendor_id', 'seller_id', 'owner_id'];

export const isBuyerOf = (order: any, uid: string): boolean => !!uid && BUYER_KEYS.some(k => order?.[k] === uid);
export const isSellerOf = (order: any, uid: string): boolean => !!uid && SELLER_KEYS.some(k => order?.[k] === uid);

// Référence de paiement commune à toutes les commandes d'un même panier (ex: MC-123_sub_1 -> MC-123)
export const rootReference = (ref: any): string => String(ref || '').split('_bz_')[0].split('_sub_')[0];

export const normalizeCode = (code: any): string => String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I
export function generateDeliveryCode(len = 8): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return s;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function extractItems(order: any): Array<{ productId: string; qty: number }> {
  let items = order?.items;
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
  if (!Array.isArray(items)) return [];
  return items
    .map((it: any) => ({
      productId: String(it?.productId || it?.product_id || it?.id || ''),
      qty: Math.max(1, Number(it?.qte ?? it?.quantity ?? it?.qty ?? 1) || 1)
    }))
    .filter(it => it.productId);
}

// Appelé UNIQUEMENT après un événement de paiement réussi vérifié (signature Bazik / session Stripe lue chez Stripe)
export async function recordVerifiedPayment(
  db: Db,
  p: { reference: string; method: string; transactionId?: string | null; amount?: number | null }
): Promise<void> {
  const reference = rootReference(p.reference);
  if (!reference) return;
  try {
    const { error } = await db.from('verified_payments').upsert(
      {
        reference,
        payment_method: p.method,
        transaction_id: p.transactionId ?? null,
        amount: p.amount != null && Number(p.amount) > 0 ? Number(p.amount) : null
      },
      { onConflict: 'reference' }
    );
    if (error) console.error('[Verified Payment] upsert failed:', error.message);
  } catch (e: any) {
    console.error('[Verified Payment] exception:', e?.message);
  }
}

// « Pas d'argent sorti sans argent entré » : le paiement doit avoir été vérifié par le serveur
// et, si le montant est connu, couvrir la somme des commandes du même paiement.
export async function assertPaymentVerified(db: Db, order: any): Promise<Result | null> {
  const ref = rootReference(order?.payment_reference || order?.qr_token);
  if (!ref) {
    return { status: 409, body: { error: 'Référence de paiement introuvable pour cette commande.' } };
  }
  const { data: vp } = await db.from('verified_payments').select('reference, amount').eq('reference', ref).maybeSingle();
  if (!vp) {
    return { status: 409, body: { error: 'Paiement non vérifié par le serveur pour cette commande : versement bloqué.' } };
  }
  const paid = Number(vp.amount) || 0;
  if (paid > 0) {
    const { data: siblings } = await db
      .from('orders')
      .select('id, total_price')
      .or(`qr_token.eq.${ref},qr_token.like.${ref}_sub_%,payment_reference.eq.${ref}`);
    const total = (siblings || []).reduce((s: number, o: any) => s + (Number(o.total_price) || 0), 0);
    // Tolérance réglable sans redéploiement de code : PAYOUT_AMOUNT_TOLERANCE_PCT (défaut 0,5 %) — à élargir si le fournisseur retient des frais
    const pct = Math.max(0, Number(process.env.PAYOUT_AMOUNT_TOLERANCE_PCT ?? 0.5)) / 100;
    const tolerance = Math.max(2, paid * pct);
    if (total > paid + tolerance) {
      return { status: 409, body: { error: 'Le montant payé est inférieur au total des commandes : versement bloqué.' } };
    }
  }
  return null;
}

// Le VENDEUR affiche ce code (QR) ; l'acheteur le scanne. Le code n'est lisible que par le serveur.
export async function getOrCreateDeliveryCode(db: Db, orderId: string, callerId: string): Promise<Result> {
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { status: 404, body: { error: 'Commande introuvable.' } };
  if (!isSellerOf(order, callerId)) return { status: 403, body: { error: 'Seul le vendeur de la commande peut afficher ce code.' } };
  if (order.status !== 'payee') return { status: 409, body: { error: "La commande n'est pas en attente de livraison." } };

  const read = async () => (await db.from('order_delivery_codes').select('code').eq('order_id', orderId).maybeSingle()).data;
  let row = await read();
  if (!row) {
    await db.from('order_delivery_codes').insert({ order_id: orderId, code: generateDeliveryCode() });
    row = await read(); // relit (gère une course entre deux créations)
  }
  if (!row?.code) return { status: 500, body: { error: 'Impossible de générer le code de livraison.' } };
  return { status: 200, body: { code: row.code } };
}

export type ConfirmDeps = {
  db: Db;
  // lance le virement MonCash (déjà sécurisé : montant et portefeuille lus en base, verrou anti double virement)
  payout: (order: any) => Promise<Result>;
};

export async function confirmDelivery(
  deps: ConfirmDeps,
  input: { orderId: string; callerId: string; code?: string | null }
): Promise<Result> {
  const { db, payout } = deps;
  const { orderId, callerId } = input;

  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { status: 404, body: { error: 'Commande introuvable.' } };

  // 1) SEUL L'ACHETEUR confirme (le vendeur ne peut jamais libérer ses propres fonds)
  if (!isBuyerOf(order, callerId)) {
    return { status: 403, body: { error: "Seul l'acheteur de cette commande peut confirmer la réception." } };
  }

  // 2) Déjà versé -> rien à faire ; confirmée mais virement échoué -> on peut réessayer le virement
  if (order.vendor_credited === true) {
    return { status: 409, body: { error: 'Cette commande est déjà réglée au vendeur.' } };
  }
  if (order.status === 'completed' || order.status === 'livree') {
    const unverified = await assertPaymentVerified(db, order);
    if (unverified) return unverified;
    const retry = await payout(order);
    return { status: retry.status, body: { ...retry.body, retried: true } };
  }
  if (order.status !== 'payee') {
    return { status: 409, body: { error: `Cette commande n'est pas en attente de livraison (statut : ${order.status}).` } };
  }

  // 3) Code du vendeur (preuve de présence à la livraison) : facultatif pour le bouton, vérifié s'il est fourni
  if (input.code != null && String(input.code).trim() !== '') {
    const { data: codeRow } = await db.from('order_delivery_codes').select('code').eq('order_id', orderId).maybeSingle();
    if (!codeRow?.code) {
      return { status: 409, body: { error: "Le vendeur n'a pas encore affiché son code de livraison." } };
    }
    if (!safeEqual(normalizeCode(codeRow.code), normalizeCode(input.code))) {
      return { status: 403, body: { error: 'Code de livraison invalide.' } };
    }
  }

  // 4) L'argent doit être réellement entré
  const unverified = await assertPaymentVerified(db, order);
  if (unverified) return unverified;

  // 5) Transition atomique : une seule requête peut passer de 'payee' à 'completed'
  const nowIso = new Date().toISOString();
  const { data: updated } = await db
    .from('orders')
    .update({
      status: 'completed',
      reception_confirmed: true,
      buyer_confirmed: true,
      buyer_confirmed_at: nowIso,
      is_validated: true,
      updated_at: nowIso
    })
    .eq('id', orderId)
    .eq('status', 'payee')
    .select()
    .maybeSingle();
  if (!updated) {
    return { status: 409, body: { error: 'Cette commande vient déjà d\'être confirmée.' } };
  }

  // 6) Stock : décrémenté une seule fois, par le serveur (opération atomique côté base).
  //    Si le stock a déjà été réservé au paiement, rien à faire ici.
  for (const it of (updated as any).stock_reserved ? [] : extractItems(updated)) {
    try {
      const { error } = await db.rpc('decrement_product_stock', { p_product_id: it.productId, p_qty: it.qty });
      if (error) console.warn('[Confirm Delivery] stock decrement failed:', it.productId, error.message);
    } catch (e: any) {
      console.warn('[Confirm Delivery] stock decrement exception:', e?.message);
    }
  }

  // 7) Virement au vendeur
  const pay = await payout(updated);
  const ok = pay.status >= 200 && pay.status < 300;
  return {
    status: 200,
    body: {
      success: true,
      delivery: 'confirmed',
      payout: ok ? { ok: true, simulated: !!pay.body?.is_simulated } : { ok: false, error: pay.body?.error || 'Virement en attente' }
    }
  };
}
