// Libération automatique de l'escrow : si l'acheteur ne confirme pas, les fonds sont libérés N jours (7 par défaut) après
// que le VENDEUR a affiché son code de livraison (preuve qu'il a tenté de livrer). Jamais depuis le simple paiement :
// un vendeur qui ne livre pas ne doit pas être payé. Le paiement doit être vérifié, la commande encore « payee »
// (annulée, en litige ou déjà terminée = exclue). L'acheteur est prévenu 2 jours avant.
import { assertPaymentVerified, extractItems, type Db, type Result } from './delivery';
import type { PushMany } from './campaigns';

const DAY = 86400000;
export const DEFAULT_ESCROW_DAYS = 7;
export const REMINDER_DAYS_BEFORE = 2;

// Délai réglable (ESCROW_AUTO_RELEASE_DAYS) entre 3 et 30 jours ; toute autre valeur retombe sur 7
export function escrowDays(raw?: unknown): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 3 && n <= 30 ? n : DEFAULT_ESCROW_DAYS;
}

export type EscrowStage = 'wait' | 'remind' | 'release';
export function escrowStage(codeShownAt: string | Date, now: Date, days: number): EscrowStage {
  const shown = new Date(codeShownAt).getTime();
  if (!Number.isFinite(shown)) return 'wait';
  const age = now.getTime() - shown;
  if (age >= days * DAY) return 'release';
  if (age >= (days - REMINDER_DAYS_BEFORE) * DAY) return 'remind';
  return 'wait';
}
export const releaseDate = (codeShownAt: string | Date, days: number): Date => new Date(new Date(codeShownAt).getTime() + days * DAY);

export type ReleaseDeps = { db: Db; payout: (order: any) => Promise<Result> };

// Même transition que la confirmation de l'acheteur, mais déclenchée par le système (jamais par le vendeur)
export async function autoReleaseDelivery(deps: ReleaseDeps, orderId: string): Promise<Result> {
  const { db, payout } = deps;
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { status: 404, body: { error: 'Commande introuvable.' } };
  if (order.vendor_credited === true) return { status: 409, body: { error: 'Cette commande est déjà réglée au vendeur.' } };
  if (order.status !== 'payee') return { status: 409, body: { error: `Commande non libérable (statut : ${order.status}).` } };

  const unverified = await assertPaymentVerified(db, order); // « pas d'argent sorti sans argent entré »
  if (unverified) return unverified;

  const nowIso = new Date().toISOString();
  const { data: updated } = await db.from('orders')
    .update({ status: 'completed', reception_confirmed: true, is_validated: true, auto_released_at: nowIso, updated_at: nowIso })
    .eq('id', orderId).eq('status', 'payee').select().maybeSingle(); // une seule requête peut passer de payee à completed
  if (!updated) return { status: 409, body: { error: 'Cette commande vient déjà d\'être traitée.' } };

  for (const it of (updated as any).stock_reserved ? [] : extractItems(updated)) {
    try { await db.rpc('decrement_product_stock', { p_product_id: it.productId, p_qty: it.qty }); } catch (_) {}
  }
  const pay = await payout(updated);
  const ok = pay.status >= 200 && pay.status < 300;
  return { status: 200, body: { success: true, delivery: 'auto_released', payout: ok ? { ok: true } : { ok: false, error: pay.body?.error || 'Virement en attente' } } };
}

export type EscrowRunResult = { status: 'done' | 'skipped'; reminded: number; released: number; payoutRetried: number; failed: number; reason?: string };

const claim = async (db: Db, key: string) => !(await db.from('notification_log').insert({ key })).error;
const tell = async (db: Db, send: PushMany, userId: string | null | undefined, title: string, message: string) => {
  if (!userId) return;
  try { await send([userId], title, message, 'order'); } catch (_) {}
  try { await db.from('platform_messages').insert({ title, message, audience: userId, is_active: true }); } catch (_) {}
};
const shortId = (id: string) => String(id).slice(0, 8).toUpperCase();
const buyerOf = (o: any) => o.buyer_id || o.client_id || null;
const frDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Port-au-Prince' });

export async function runEscrowAutoRelease(
  deps: ReleaseDeps & { send: PushMany },
  now = new Date(),
  days = escrowDays(process.env.ESCROW_AUTO_RELEASE_DAYS),
  maxReleases = 50
): Promise<EscrowRunResult> {
  const { db, send } = deps;
  const out: EscrowRunResult = { status: 'skipped', reminded: 0, released: 0, payoutRetried: 0, failed: 0 };

  // 1) Commandes dont le vendeur a affiché le code il y a assez longtemps pour un rappel ou une libération
  const cutoff = new Date(now.getTime() - (days - REMINDER_DAYS_BEFORE) * DAY).toISOString();
  const { data: codes, error } = await db.from('order_delivery_codes').select('order_id, created_at').lte('created_at', cutoff).limit(1000);
  if (error) throw new Error(`order_delivery_codes: ${error.message}`);
  const shownAt = new Map<string, string>((codes || []).map((c: any) => [String(c.order_id), c.created_at]));

  if (shownAt.size) {
    const { data: orders, error: e2 } = await db.from('orders').select('*').in('id', [...shownAt.keys()]).eq('status', 'payee');
    if (e2) throw new Error(`orders: ${e2.message}`);
    for (const order of (orders || []) as any[]) {
      if (order.vendor_credited === true) continue;
      const at = shownAt.get(String(order.id))!;
      const stage = escrowStage(at, now, days);
      if (stage === 'remind') {
        if (!(await claim(db, `escrow-remind-${order.id}`))) continue;
        await tell(db, send, buyerOf(order), '⏳ Confirmez la réception de votre commande',
          `Commande #${shortId(order.id)} : confirmez la réception ou signalez un problème avant le ${frDate(releaseDate(at, days))}. Passé cette date, les fonds seront libérés automatiquement au vendeur.`);
        out.reminded++;
      } else if (stage === 'release') {
        if (out.released >= maxReleases) break;
        const res = await autoReleaseDelivery(deps, String(order.id));
        if (res.status >= 200 && res.status < 300) {
          out.released++;
          if (await claim(db, `escrow-released-${order.id}`)) {
            await tell(db, send, buyerOf(order), '✅ Commande réglée automatiquement', `Commande #${shortId(order.id)} : le délai de ${days} jours est écoulé, les fonds ont été libérés au vendeur.`);
            await tell(db, send, order.vendor_id, '💰 Fonds libérés', `Commande #${shortId(order.id)} : l'acheteur n'a pas répondu sous ${days} jours, vos fonds sont libérés.`);
          }
        } else {
          out.failed++;
          console.warn(`[Escrow auto-release] Commande ${order.id} non libérée (${res.status}) : ${res.body?.error}`);
        }
      }
    }
  }

  // 2) Virements restés en attente après une libération automatique (le verrou payouts.reference empêche tout double virement)
  const { data: pendingPayout } = await db.from('orders').select('*').eq('status', 'completed').eq('vendor_credited', false).limit(200);
  for (const order of ((pendingPayout || []) as any[]).filter(o => o.auto_released_at).slice(0, 20)) {
    const unverified = await assertPaymentVerified(db, order);
    if (unverified) continue;
    const pay = await deps.payout(order);
    out.payoutRetried++;
    if (!(pay.status >= 200 && pay.status < 300)) out.failed++;
  }

  out.status = out.reminded || out.released || out.payoutRetried || out.failed ? 'done' : 'skipped';
  if (out.status === 'skipped') out.reason = 'aucune commande à rappeler ou libérer';
  return out;
}
