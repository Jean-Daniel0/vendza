// Notifications liées au panier : « votre panier a du contenu » et « stock presque épuisé ».
// Envoyées aux clients dont l'option « notifications de commandes » est active (profiles.notif_commandes, activée par défaut).
import { haitiClock } from './marketing';
import type { PushMany, CampaignResult } from './campaigns';

export const LOW_STOCK_THRESHOLD = 3;
const DAY = 86400000;

type Row = { id: string; user_id: string; product_id: string; quantity: number; updated_at: string; stock_alert_at?: string | null };
type Prod = { id: string; name: string; stock: number | null; is_active?: boolean | null; status?: string | null };
const sellable = (p?: Prod) => !!p && p.is_active !== false && (p.status ?? 'published') === 'published' && Number(p.stock ?? 0) > 0;

async function allowedUsers(db: any, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await db.from('profiles').select('id,notif_commandes').in('id', ids);
  if (error) throw new Error(`profiles: ${error.message}`);
  return new Set((data || []).filter((p: any) => p.notif_commandes !== false).map((p: any) => p.id));
}
const claim = async (db: any, key: string) => !(await db.from('notification_log').insert({ key })).error;
const inbox = (db: any, userId: string, title: string, message: string) => db.from('platform_messages').insert({ title, message, audience: userId, is_active: true });

// Un rappel au maximum tous les 3 jours, seulement si le panier est inactif depuis 2 h et modifié il y a moins de 14 jours
export async function runCartReminders(db: any, send: PushMany, now = new Date(), idleMs = 2 * 3600e3): Promise<CampaignResult> {
  const hour = haitiClock(now).hour;
  if (hour < 9 || hour >= 20) return { status: 'skipped', reason: 'hors de 9h-20h (heure d\'Haïti)' };
  const { data: rows, error } = await db.from('cart_items').select('id,user_id,product_id,quantity,updated_at').limit(5000);
  if (error) throw new Error(`cart_items: ${error.message}`);
  const byUser = new Map<string, Row[]>();
  for (const r of (rows || []) as Row[]) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r]);
  if (!byUser.size) return { status: 'skipped', reason: 'aucun panier enregistré' };

  const { data: prods } = await db.from('products').select('id,name,stock,is_active,status').in('id', [...new Set((rows as Row[]).map(r => r.product_id))]);
  const prodById = new Map<string, Prod>((prods || []).map((p: Prod) => [p.id, p]));
  const allowed = await allowedUsers(db, [...byUser.keys()]);
  const bucket = Math.floor(now.getTime() / (3 * DAY));
  let sent = 0;
  for (const [userId, items] of byUser) {
    if (!allowed.has(userId)) continue;
    const newest = Math.max(...items.map(i => new Date(i.updated_at).getTime()));
    if (now.getTime() - newest < idleMs || now.getTime() - newest > 14 * DAY) continue;
    const live = items.filter(i => sellable(prodById.get(i.product_id)));
    if (!live.length) continue;
    if (!(await claim(db, `cart-${userId}-${bucket}`))) continue;
    const first = prodById.get(live[0].product_id)!.name;
    const title = '🛒 Votre panier vous attend';
    const message = `${live.length} article${live.length > 1 ? 's' : ''} : ${first}${live.length > 1 ? ` et ${live.length - 1} autre${live.length > 2 ? 's' : ''}` : ''}. Finalisez votre commande avant qu'il ne soit épuisé.`;
    await send([userId], title, message, 'cart');
    await inbox(db, userId, title, message);
    sent++;
  }
  return sent ? { status: 'sent', recipients: sent } : { status: 'skipped', reason: 'aucun panier à rappeler' };
}

// Alerte quand un article du panier tombe à 3 exemplaires ou moins (une fois par article ; réarmée si la quantité change ou après 3 jours)
export async function runLowStockAlerts(db: any, send: PushMany, now = new Date()): Promise<CampaignResult> {
  const hour = haitiClock(now).hour;
  if (hour < 8 || hour >= 21) return { status: 'skipped', reason: 'hors de 8h-21h (heure d\'Haïti)' };
  const { data: low, error } = await db.from('products').select('id,name,stock,is_active,status').gt('stock', 0).lte('stock', LOW_STOCK_THRESHOLD);
  if (error) throw new Error(`products: ${error.message}`);
  const lowById = new Map<string, Prod>((low || []).filter(sellable).map((p: Prod) => [p.id, p]));
  if (!lowById.size) return { status: 'skipped', reason: 'aucun produit en stock bas' };

  const { data: rows, error: e2 } = await db.from('cart_items').select('id,user_id,product_id,quantity,updated_at,stock_alert_at').in('product_id', [...lowById.keys()]);
  if (e2) throw new Error(`cart_items: ${e2.message}`);
  const due = ((rows || []) as Row[]).filter(r => !r.stock_alert_at || now.getTime() - new Date(r.stock_alert_at).getTime() > 3 * DAY);
  if (!due.length) return { status: 'skipped', reason: 'alertes déjà envoyées' };
  const byUser = new Map<string, Row[]>();
  for (const r of due) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r]);
  const allowed = await allowedUsers(db, [...byUser.keys()]);
  let sent = 0;
  for (const [userId, items] of byUser) {
    if (!allowed.has(userId)) continue;
    const p0 = lowById.get(items[0].product_id)!;
    const title = '⚠️ Stock presque épuisé';
    const message = items.length === 1
      ? `Plus que ${p0.stock} « ${p0.name} » en stock. Commandez avant qu'il ne soit épuisé !`
      : `${items.length} articles de votre panier bientôt épuisés (par exemple « ${p0.name} » : plus que ${p0.stock}). Commandez maintenant !`;
    await send([userId], title, message, 'low-stock');
    await inbox(db, userId, title, message);
    await db.from('cart_items').update({ stock_alert_at: now.toISOString() }).in('id', items.map(i => i.id));
    sent++;
  }
  return sent ? { status: 'sent', recipients: sent } : { status: 'skipped', reason: 'aucun client concerné' };
}
