// Envoi des campagnes : annonce Ventes Flash quotidienne + suggestions personnalisées.
// Uniquement vers les clients qui ont activé « Promotions & ventes flash » (profiles.newsletter = true).
import { flashSummary, buildFlashMessage, pickRecommendation, buildRecommendationMessage, haitiClock, isFlashWindow, ProductLite, Interest } from './marketing';

export type PushMany = (userIds: string[], title: string, message: string, category: string) => Promise<unknown>;
export type CampaignResult = { status: 'sent' | 'skipped'; reason?: string; recipients?: number; details?: Record<string, unknown> };

const PRODUCT_COLS = 'id,name,price,old_price,stock,category,vendor_id,created_at,is_active,status';

async function loadProducts(db: any): Promise<ProductLite[]> {
  const { data, error } = await db.from('products').select(PRODUCT_COLS).limit(2000);
  if (error) throw new Error(`products: ${error.message}`);
  return data || [];
}

async function optedInUserIds(db: any, limit = 1000): Promise<string[]> {
  const { data, error } = await db.from('profiles').select('id').eq('newsletter', true).limit(limit);
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data || []).map((r: any) => r.id);
}

// Réserve une clé : renvoie false si elle existe déjà (une autre instance / un autre appel a déjà envoyé)
async function claim(db: any, key: string): Promise<boolean> {
  const { error } = await db.from('notification_log').insert({ key });
  return !error;
}

export async function runFlashSale(db: any, send: PushMany, now = new Date()): Promise<CampaignResult> {
  if (!isFlashWindow(now)) return { status: 'skipped', reason: 'hors de la fenêtre 8h-20h (heure d\'Haïti)' };
  const summary = flashSummary(await loadProducts(db));
  if (summary.count === 0) return { status: 'skipped', reason: 'aucun produit en promotion' };
  if (!(await claim(db, `flash-${haitiClock(now).dateKey}`))) return { status: 'skipped', reason: 'annonce déjà envoyée aujourd\'hui' };

  const { title, message } = buildFlashMessage(summary);
  await db.from('platform_messages').insert({ title, message, audience: 'all', is_active: true });
  const ids = await optedInUserIds(db);
  for (let i = 0; i < ids.length; i += 1000) await send(ids.slice(i, i + 1000), title, message, 'promo');
  return { status: 'sent', recipients: ids.length, details: { ...summary } };
}

export async function runRecommendations(db: any, send: PushMany, now = new Date(), maxUsers = 200): Promise<CampaignResult> {
  const hour = haitiClock(now).hour;
  if (hour < 9 || hour >= 20) return { status: 'skipped', reason: 'hors de 9h-20h (heure d\'Haïti)' };
  const ids = await optedInUserIds(db, maxUsers);
  if (ids.length === 0) return { status: 'skipped', reason: 'aucun client n\'a activé les promotions' };

  const { data: rows, error } = await db.from('user_interests').select('user_id,category,score,last_viewed_at,last_notified_at').in('user_id', ids);
  if (error) throw new Error(`user_interests: ${error.message}`);
  const byUser = new Map<string, Interest[]>();
  for (const r of rows || []) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r]);
  if (byUser.size === 0) return { status: 'skipped', reason: 'aucun centre d\'intérêt enregistré' };

  const products = await loadProducts(db);
  const dateKey = haitiClock(now).dateKey;
  let sent = 0;
  for (const [userId, interests] of byUser) {
    const rec = pickRecommendation(interests, products, { userId, now });
    if (!rec) continue;
    if (!(await claim(db, `reco-${userId}-${dateKey}`))) continue;
    const { title, message } = buildRecommendationMessage(rec);
    await send([userId], title, message, 'promo');
    await db.from('platform_messages').insert({ title, message, audience: userId, is_active: true });
    await db.from('user_interests').update({ last_notified_at: now.toISOString() }).eq('user_id', userId).eq('category', rec.category);
    sent++;
  }
  return sent > 0 ? { status: 'sent', recipients: sent } : { status: 'skipped', reason: 'rien à recommander pour le moment' };
}
