// Notifications supplémentaires : plafond quotidien, messages de la journée et événements (livraison, virement, remboursement, avis).
// Règles : contenu réel uniquement (rien n'est envoyé s'il n'y a rien de vrai à dire), un seul envoi par clé (idempotence
// via notification_log), préférences de l'utilisateur respectées, heures d'Haïti.
import { haitiClock } from './marketing';
import type { PushMany, CampaignResult } from './campaigns';

export const PROMO_DAILY_MAX = 4; // messages promotionnels par personne et par jour
const DAY = 86400000;
const claim = async (db: any, key: string) => !(await db.from('notification_log').insert({ key })).error;
const release = async (db: any, keys: string[]) => { try { await db.from('notification_log').delete().in('key', keys); } catch { /* journal seulement */ } };
const htg = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} HTG`;
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
const short = (id: unknown) => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
const clip = (s: unknown, n: number) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Réserve un créneau quotidien par personne (promo-<jour>-<id>-<n>). Renvoie seulement ceux qui n'ont pas atteint le plafond. */
export async function takePromoSlots(db: any, userIds: string[], dateKey: string, max = PROMO_DAILY_MAX): Promise<string[]> {
  const allowed: string[] = [];
  for (const id of userIds) {
    for (let slot = 1; slot <= max; slot++) {
      if (await claim(db, `promo-${dateKey}-${id}-${slot}`)) { allowed.push(id); break; }
    }
  }
  return allowed;
}

export type PrefColumn = 'notif_livraisons' | 'notif_avis';
/** Personnes qui n'ont pas coupé ce type de notification (une colonne absente ou nulle = activée). */
export async function allowedFor(db: any, ids: string[], column: PrefColumn): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await db.from('profiles').select(`id,${column}`).in('id', ids);
  if (error) throw new Error(`profiles: ${error.message}`);
  return new Set((data || []).filter((p: any) => p[column] !== false).map((p: any) => p.id));
}

async function promoAudience(db: any, limit = 1000): Promise<string[]> {
  const { data, error } = await db.from('profiles').select('id').eq('newsletter', true).limit(limit);
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data || []).map((r: any) => r.id);
}

const inWindow = (now: Date, from: number, to: number) => { const h = haitiClock(now).hour; return h >= from && h < to; };
const skipped = (reason: string): CampaignResult => ({ status: 'skipped', reason });

// ---------- Textes (fonctions pures : testables, jamais de chiffre inventé) ----------
export type NewProduct = { name: string; price?: number | null };
export function buildNewToday(products: NewProduct[]): { title: string; message: string } {
  const first = products[0];
  if (products.length === 1) return { title: 'Nouveau sur Vendza', message: `${clip(first.name, 60)} vient d'arriver${first.price ? ` à ${htg(first.price)}` : ''}. Découvrez-le avant les autres.` };
  return { title: 'Nouveautés du jour', message: `${products.length} nouveaux produits aujourd'hui sur Vendza, dont ${clip(first.name, 50)}.` };
}
export const buildPopular = (name: string, orders: number) => ({ title: 'Le plus commandé cette semaine', message: `${clip(name, 60)} : ${orders} commandes en 7 jours sur Vendza.` });
export const buildVendorSummary = (count: number, total: number, toDeliver: number) => ({
  title: 'Votre journée sur Vendza',
  message: `Aujourd'hui : ${count} ${plural(count, 'commande payée', 'commandes payées')} (${htg(total)}).${toDeliver > 0 ? ` ${toDeliver} à livrer.` : ''}`,
});
export const buildDeliveryReminder = (count: number) => ({
  title: 'Commandes à livrer',
  message: `${count} ${plural(count, 'commande payée attend', 'commandes payées attendent')} d'être livrée${count > 1 ? 's' : ''}. Vous êtes payé dès la confirmation de réception.`,
});

// ---------- Messages de la journée ----------
const SELLABLE = (p: any) => p.is_active !== false && (p.status ?? 'published') === 'published' && Number(p.stock ?? 0) > 0;

/** Matin : nouveaux produits des dernières 24 h, seulement s'il y en a. Une fois par jour, aux clients qui ont activé les promotions. */
export async function runNewToday(db: any, send: PushMany, now = new Date()): Promise<CampaignResult> {
  if (!inWindow(now, 9, 20)) return skipped("hors de 9h-20h (heure d'Haïti)");
  const { dateKey } = haitiClock(now);
  const since = new Date(now.getTime() - DAY).toISOString();
  const { data, error } = await db.from('products').select('id,name,price,stock,is_active,status,created_at').gte('created_at', since).limit(200);
  if (error) throw new Error(`products: ${error.message}`);
  const fresh = (data || []).filter(SELLABLE).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!fresh.length) return skipped('aucun nouveau produit en vente');
  if (!(await claim(db, `newtoday-${dateKey}`))) return skipped("déjà envoyé aujourd'hui");
  const ids = await takePromoSlots(db, await promoAudience(db), dateKey);
  if (!ids.length) return skipped("personne à notifier (promotions désactivées ou plafond atteint)");
  const { title, message } = buildNewToday(fresh.map((p: any) => ({ name: p.name, price: Number(p.price) || null })));
  for (let i = 0; i < ids.length; i += 1000) await send(ids.slice(i, i + 1000), title, message, 'promo');
  return { status: 'sent', recipients: ids.length, details: { products: fresh.length } };
}

/** Midi : le produit le plus commandé des 7 derniers jours (au moins 2 commandes payées, encore en vente). */
export async function runPopular(db: any, send: PushMany, now = new Date()): Promise<CampaignResult> {
  if (!inWindow(now, 11, 17)) return skipped("hors de 11h-17h (heure d'Haïti)");
  const { dateKey } = haitiClock(now);
  const since = new Date(now.getTime() - 7 * DAY).toISOString();
  const { data, error } = await db.from('orders').select('product_id,status,created_at').in('status', ['payee', 'completed']).gte('created_at', since).limit(5000);
  if (error) throw new Error(`orders: ${error.message}`);
  const count = new Map<string, number>();
  for (const o of data || []) if (o.product_id) count.set(o.product_id, (count.get(o.product_id) || 0) + 1);
  const ranked = [...count.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return skipped('aucun produit commandé au moins 2 fois cette semaine');
  const { data: prods } = await db.from('products').select('id,name,stock,is_active,status').in('id', ranked.map(r => r[0]));
  const live = new Map<string, any>((prods || []).filter(SELLABLE).map((p: any) => [p.id, p]));
  const top = ranked.find(([id]) => live.has(id));
  if (!top) return skipped('le produit le plus commandé n\'est plus en vente');
  if (!(await claim(db, `popular-${dateKey}`))) return skipped("déjà envoyé aujourd'hui");
  const ids = await takePromoSlots(db, await promoAudience(db), dateKey);
  if (!ids.length) return skipped('personne à notifier (promotions désactivées ou plafond atteint)');
  const { title, message } = buildPopular(live.get(top[0]).name, top[1]);
  for (let i = 0; i < ids.length; i += 1000) await send(ids.slice(i, i + 1000), title, message, 'promo');
  return { status: 'sent', recipients: ids.length };
}

/** Soir, vendeurs : ventes payées du jour et commandes à livrer. Seulement s'il y a eu au moins une vente aujourd'hui. */
export async function runVendorSummary(db: any, send: PushMany, now = new Date()): Promise<CampaignResult> {
  if (!inWindow(now, 17, 21)) return skipped("hors de 17h-21h (heure d'Haïti)");
  const { dateKey } = haitiClock(now);
  const since = new Date(now.getTime() - 14 * DAY).toISOString();
  const { data, error } = await db.from('orders').select('vendor_id,total_price,status,created_at').in('status', ['payee', 'completed']).gte('created_at', since).limit(5000);
  if (error) throw new Error(`orders: ${error.message}`);
  const per = new Map<string, { count: number; total: number; toDeliver: number }>();
  for (const o of data || []) {
    if (!o.vendor_id) continue;
    const row = per.get(o.vendor_id) || { count: 0, total: 0, toDeliver: 0 };
    if (haitiClock(new Date(o.created_at)).dateKey === dateKey) { row.count++; row.total += Number(o.total_price) || 0; }
    if (o.status === 'payee') row.toDeliver++;
    per.set(o.vendor_id, row);
  }
  const todays = [...per.entries()].filter(([, r]) => r.count > 0);
  if (!todays.length) return skipped("aucune vente payée aujourd'hui");
  const ok = await allowedFor(db, todays.map(([id]) => id), 'notif_livraisons');
  let sent = 0;
  for (const [id, r] of todays) {
    if (!ok.has(id) || !(await claim(db, `vsum-${dateKey}-${id}`))) continue;
    const { title, message } = buildVendorSummary(r.count, r.total, r.toDeliver);
    await send([id], title, message, 'order');
    sent++;
  }
  return sent ? { status: 'sent', recipients: sent } : skipped('aucun vendeur à notifier');
}

/** Matin, vendeurs : commandes payées depuis plus de 24 h et pas encore livrées (14 jours maximum). */
export async function runDeliveryReminder(db: any, send: PushMany, now = new Date()): Promise<CampaignResult> {
  if (!inWindow(now, 8, 13)) return skipped("hors de 8h-13h (heure d'Haïti)");
  const { dateKey } = haitiClock(now);
  const { data, error } = await db.from('orders').select('vendor_id,status,created_at').eq('status', 'payee')
    .lte('created_at', new Date(now.getTime() - DAY).toISOString()).gte('created_at', new Date(now.getTime() - 14 * DAY).toISOString()).limit(5000);
  if (error) throw new Error(`orders: ${error.message}`);
  const per = new Map<string, number>();
  for (const o of data || []) if (o.vendor_id) per.set(o.vendor_id, (per.get(o.vendor_id) || 0) + 1);
  if (!per.size) return skipped('aucune commande en attente de livraison');
  const ok = await allowedFor(db, [...per.keys()], 'notif_livraisons');
  let sent = 0;
  for (const [id, n] of per) {
    if (!ok.has(id) || !(await claim(db, `deliv-${dateKey}-${id}`))) continue;
    const { title, message } = buildDeliveryReminder(n);
    await send([id], title, message, 'order');
    sent++;
  }
  return sent ? { status: 'sent', recipients: sent } : skipped('aucun vendeur à notifier');
}

// ---------- Événements ----------
export type EventResult = 'sent' | 'duplicate' | 'muted' | 'no-recipient' | 'failed';

/** Une notification à une personne : préférence respectée, une seule fois par clé, jamais d'exception vers l'appelant. */
export async function pushEvent(db: any, send: PushMany, e: { userId?: string | null; pref: PrefColumn; title: string; message: string; category: string; key: string }): Promise<EventResult> {
  try {
    if (!e.userId) return 'no-recipient';
    if (!(await allowedFor(db, [e.userId], e.pref)).has(e.userId)) return 'muted';
    if (!(await claim(db, e.key))) return 'duplicate';
    try { await send([e.userId], e.title, e.message, e.category); } catch { await release(db, [e.key]); return 'failed'; }
    return 'sent';
  } catch { return 'failed'; }
}

const buyerOf = (o: any) => o?.buyer_id || o?.client_id || o?.customer_id || o?.user_id || null;
const vendorOf = (o: any) => o?.vendor_id || o?.vendeur_id || o?.seller_id || o?.owner_id || null;

/** L'acheteur a scanné le QR : remerciement à l'acheteur, virement en cours pour le vendeur. */
export async function notifyDeliveredPush(db: any, send: PushMany, orderId: string) {
  try {
    const { data: o } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!o) return;
    const ref = short(o.id);
    await pushEvent(db, send, { userId: buyerOf(o), pref: 'notif_livraisons', category: 'order', key: `ev-delivered-buyer-${o.id}`, title: 'Réception confirmée', message: `Commande #${ref} : le vendeur est payé. Merci d'avoir acheté sur Vendza.` });
    await pushEvent(db, send, { userId: vendorOf(o), pref: 'notif_livraisons', category: 'order', key: `ev-delivered-vendor-${o.id}`, title: 'Livraison confirmée', message: `Commande #${ref} : l'acheteur a confirmé la réception. Votre virement MonCash est en cours.` });
  } catch { /* une notification ne bloque jamais une livraison */ }
}

export const notifyPayoutPush = (db: any, send: PushMany, orderId: string, vendorId: string | null | undefined, amount: number) =>
  pushEvent(db, send, { userId: vendorId, pref: 'notif_livraisons', category: 'order', key: `ev-payout-${orderId}`, title: 'Paiement envoyé', message: `${htg(amount)} envoyés sur votre MonCash pour la commande #${short(orderId)}.` });

export const notifyRefundPush = (db: any, send: PushMany, refundId: string, buyerId: string | null | undefined, amount: number) =>
  pushEvent(db, send, { userId: buyerId, pref: 'notif_livraisons', category: 'order', key: `ev-refund-${refundId}`, title: 'Remboursement envoyé', message: `Nous vous avons remboursé ${htg(amount)}.` });

/** Nouvel avis : le serveur relit l'avis en base (l'auteur doit être l'appelant) avant de prévenir le vendeur du produit. */
export async function notifyReviewPush(db: any, send: PushMany, callerId: string, reviewId: string): Promise<EventResult> {
  try {
    const { data: r } = await db.from('reviews').select('id,user_id,product_id,rating,comment').eq('id', reviewId).maybeSingle();
    if (!r || r.user_id !== callerId || !r.product_id) return 'no-recipient';
    const { data: p } = await db.from('products').select('name,vendor_id').eq('id', r.product_id).maybeSingle();
    if (!p?.vendor_id || p.vendor_id === callerId) return 'no-recipient';
    const stars = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
    const comment = clip(r.comment, 80);
    return pushEvent(db, send, { userId: p.vendor_id, pref: 'notif_avis', category: 'message', key: `ev-review-${r.id}`, title: `Nouvel avis ${stars}/5`, message: `${clip(p.name, 50)}${comment ? ` : « ${comment} »` : ''}` });
  } catch { return 'failed'; }
}
