// Événements e-mail de la plateforme. Règle d'or : un e-mail ne doit JAMAIS faire échouer ni ralentir un paiement,
// une livraison ou un virement : tout est protégé par try/catch, rien n'est jamais « throw ».
import { EmailConfig, Rendered, SendResult, sendViaResend, normalizeItems, OrderMail, orderConfirmedBuyer, newOrderVendor, deliveryConfirmedBuyer, deliveryConfirmedVendor, payoutSentVendor, payoutFailedAdmin, refundPaidBuyer, welcome, founderInvite } from './email';

export type EmailDeps = {
  db: any;                       // client Supabase (clé service)
  cfg: EmailConfig | null;       // null = e-mails désactivés
  adminEmail?: string;           // alertes internes (ADMIN_NOTIFY_EMAIL)
  send?: (cfg: EmailConfig, msg: { to: string; rendered: Rendered; idempotencyKey?: string; headers?: Record<string, string> }) => Promise<SendResult>;
  spacingMs?: number;            // Resend limite le débit : on espace les envois (600 ms par défaut)
};

export type Outcome = 'sent' | 'duplicate' | 'disabled' | 'no-recipient' | 'failed';

// File d'envoi unique : un seul e-mail à la fois, espacés (limite de débit Resend)
let chain: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function enqueue<T>(fn: () => Promise<T>, spacing: number): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(() => sleep(spacing), () => sleep(spacing));
  return run;
}

async function recipient(db: any, userId: string): Promise<{ email: string; name: string } | null> {
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return null;
    let name = '';
    try {
      const { data: prof } = await db.from('profiles').select('prenom').eq('id', userId).maybeSingle();
      name = String(prof?.prenom || data?.user?.user_metadata?.prenom || '').trim();
    } catch { /* le prénom est facultatif */ }
    return { email, name };
  } catch { return null; }
}

async function deliver(deps: EmailDeps, event: string, dedupeKey: string, userId: string | null, to: string | null, render: (name: string) => Rendered, nameHint = '', headers?: Record<string, string>): Promise<Outcome> {
  try {
    if (!deps.cfg) return 'disabled';
    let address = to, name = nameHint;
    if (!address && userId) { const r = await recipient(deps.db, userId); if (r) { address = r.email; name = r.name || nameHint; } }
    if (!address) return 'no-recipient';

    // Anti-doublon : on réserve la clé AVANT d'envoyer. Si la table n'existe pas encore, on envoie quand même
    // (la clé d'idempotence de Resend protège alors contre un rejeu pendant 24 h).
    const ins = await deps.db.from('email_log').insert({ dedupe_key: dedupeKey, event, user_id: userId });
    if (ins?.error && (ins.error.code === '23505' || /duplicate key/i.test(ins.error.message || ''))) return 'duplicate';
    const reserved = !ins?.error;

    const send = deps.send || sendViaResend;
    const res = await enqueue(() => send(deps.cfg!, { to: address!, rendered: render(name), idempotencyKey: dedupeKey, ...(headers ? { headers } : {}) }), deps.spacingMs ?? 600);
    if (res.ok === false) {
      console.warn(`[Email] échec ${event} (${res.status}): ${res.error}`);
      if (reserved) { try { await deps.db.from('email_log').delete().eq('dedupe_key', dedupeKey); } catch { /* un rejeu pourra réessayer */ } }
      return 'failed';
    }
    if (reserved && res.id) { try { await deps.db.from('email_log').update({ provider_id: res.id }).eq('dedupe_key', dedupeKey); } catch { /* journal seulement */ } }
    return 'sent';
  } catch (e: any) {
    console.warn(`[Email] exception ${event}:`, e?.message);
    return 'failed';
  }
}

const orderMail = (cfg: EmailConfig, o: any, name = ''): OrderMail => ({
  siteUrl: cfg.siteUrl, orderId: String(o?.id || ''), items: normalizeItems(o?.items ?? o?.articles),
  total: Number(o?.total_price ?? o?.total) || 0, shipping: Number(o?.frais_livraison ?? o?.shipping_fee) || 0,
  commune: o?.delivery_commune || o?.commune || '', name, vendorName: o?.vendor_name || '',
});

/** Paiement confirmé : l'acheteur reçoit son reçu, le vendeur sa nouvelle commande. */
export async function notifyOrderConfirmed(deps: EmailDeps, order: any, buyerId?: string | null, vendorId?: string | null) {
  const cfg = deps.cfg; if (!cfg || !order?.id) return;
  if (buyerId) await deliver(deps, 'order_confirmed_buyer', `order_confirmed_buyer:${order.id}`, buyerId, null, n => orderConfirmedBuyer(orderMail(cfg, order, n)));
  if (vendorId) await deliver(deps, 'order_new_vendor', `order_new_vendor:${order.id}`, vendorId, null, n => newOrderVendor(orderMail(cfg, order, n)));
}

/** L'acheteur a scanné le QR : remerciement à l'acheteur, virement en cours pour le vendeur. */
export async function notifyDeliveryConfirmed(deps: EmailDeps, orderId: string) {
  try {
    const cfg = deps.cfg; if (!cfg) return;
    const { data: o } = await deps.db.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!o) return;
    const buyer = o.buyer_id || o.client_id || o.customer_id || o.user_id;
    const vendor = o.vendor_id || o.vendeur_id || o.seller_id || o.owner_id;
    if (buyer) await deliver(deps, 'delivery_buyer', `delivery_buyer:${o.id}`, buyer, null, n => deliveryConfirmedBuyer(orderMail(cfg, o, n)));
    if (vendor) await deliver(deps, 'delivery_vendor', `delivery_vendor:${o.id}`, vendor, null, n => deliveryConfirmedVendor(orderMail(cfg, o, n)));
  } catch (e: any) { console.warn('[Email] delivery:', e?.message); }
}

export async function notifyPayoutSent(deps: EmailDeps, orderId: string, vendorId: string | null | undefined, amount: number) {
  const cfg = deps.cfg; if (!cfg || !vendorId) return;
  await deliver(deps, 'payout_sent_vendor', `payout_sent_vendor:${orderId}`, vendorId, null, n => payoutSentVendor({ siteUrl: cfg.siteUrl, orderId, amount, name: n }));
}

export async function notifyPayoutFailed(deps: EmailDeps, orderId: string, reason?: string) {
  const cfg = deps.cfg; if (!cfg || !deps.adminEmail) return;
  // une alerte par tentative échouée (l'horodatage à la minute évite un déluge si Bazik renvoie plusieurs notifications)
  await deliver(deps, 'payout_failed_admin', `payout_failed_admin:${orderId}:${new Date().toISOString().slice(0, 16)}`, null, deps.adminEmail, () => payoutFailedAdmin({ siteUrl: cfg.siteUrl, orderId, reason }));
}

export async function notifyRefundPaid(deps: EmailDeps, refundId: string, buyerId: string | null | undefined, amount: number, reference?: string, method: 'moncash' | 'card' = 'moncash') {
  const cfg = deps.cfg; if (!cfg || !buyerId) return;
  await deliver(deps, 'refund_paid_buyer', `refund_paid_buyer:${refundId}`, buyerId, null, n => refundPaidBuyer({ siteUrl: cfg.siteUrl, amount, reference, name: n, method }));
}

/** Une seule fois par compte, à la première session authentifiée. */
export async function notifyWelcome(deps: EmailDeps, userId: string, vendor: boolean): Promise<Outcome> {
  const cfg = deps.cfg; if (!cfg) return 'disabled';
  return deliver(deps, 'welcome', `welcome:${userId}`, userId, null, n => welcome({ siteUrl: cfg.siteUrl, name: n, vendor }));
}

/** Invitation fondateurs : un seul e-mail par vendeur, avec lien et en-têtes de désinscription. */
export async function sendFounderInvite(deps: EmailDeps, userId: string, remaining: number, unsubscribeUrl: string): Promise<Outcome> {
  const cfg = deps.cfg; if (!cfg) return 'disabled';
  return deliver(deps, 'founder_invite', `founder_invite:${userId}`, userId, null, n => founderInvite({ siteUrl: cfg.siteUrl, name: n, remaining, unsubscribeUrl }), '',
    { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
}
