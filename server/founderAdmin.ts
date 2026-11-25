// Administration du programme fondateurs : places par catégorie, membres, coût réel estimé des remises,
// et envoi unique de l'invitation (notification push) aux vendeurs qui ne sont pas encore membres.
import type { Express } from 'express';
import { AdminGuard, AuditRow, clientIp } from './adminSecurity';
import { commissionRate } from '../src/lib/commission';
import { EmailDeps, sendFounderInvite } from './emailEvents';
import { unsubscribeUrl } from './unsubscribe';
import { FOUNDER_CATEGORIES, FOUNDER_PER_CATEGORY, FOUNDER_TOTAL, FOUNDER_DISCOUNT, FOUNDER_DAYS, FOUNDER_MIN_PRODUCTS } from '../src/lib/founder';

const DAY = 86400000;
export const PAID_STATUSES = ['payee', 'completed', 'livree'];
/** Hypothèse d'alerte : frais Bazik à 9 % (scénario, pas une mesure). */
export const BAZIK_FEE_SCENARIO = 0.09;
export const INVITE_KEY = (vendorId: string) => `founder-invite-${vendorId}`;
export const INVITE_TITLE = 'Programme fondateurs Vendza';
export const INVITE_MESSAGE = `Il reste des places : commission réduite de ${Math.round(FOUNDER_DISCOUNT * 100)} % pendant ${FOUNDER_DAYS} jours. Vérifiez votre identité et publiez ${FOUNDER_MIN_PRODUCTS} produits pour en profiter.`;

export type Member = { vendor_id: string; category: string; joined_at: string; expires_at: string };
export type CostOrder = { vendor_id?: string | null; total_price?: unknown; shipping_subsidy?: unknown; payment_method?: string | null; status?: string | null; created_at?: string | null };
export type PeriodKey = '7' | '30' | 'all';

export const parsePeriod = (v: unknown): PeriodKey => (v === '7' || v === '30' ? v : 'all');
export const periodStart = (p: PeriodKey, now = Date.now()): number | null => (p === 'all' ? null : now - Number(p) * DAY);

/**
 * Coût estimé des remises : commission évitée = (total payé + livraison offerte) x taux de base x 0,9,
 * sur les commandes payées passées pendant la période de 90 jours du vendeur et dans la période choisie.
 * `bazikScenario` : perte hypothétique si les frais Bazik montaient à 9 % (commissions de 1 à 2 % < 9 %), MonCash seulement.
 */
export function founderCost(orders: CostOrder[], members: Member[], plans: Record<string, string>, since: number | null) {
  const byMember = new Map(members.map(m => [m.vendor_id, m]));
  const byVendor: Record<string, { cost: number; orders: number; sales: number }> = {};
  let total = 0, count = 0, sales = 0, bazikScenario = 0;
  for (const o of orders) {
    const vid = String(o.vendor_id || '');
    const m = byMember.get(vid);
    if (!m || !PAID_STATUSES.includes(String(o.status || ''))) continue;
    const t = o.created_at ? Date.parse(o.created_at) : NaN;
    if (!Number.isFinite(t) || t < Date.parse(m.joined_at) || t >= Date.parse(m.expires_at)) continue;
    if (since !== null && t < since) continue;
    const paid = Number(o.total_price) || 0;
    const base = paid + (Number(o.shipping_subsidy) || 0);
    const rate = commissionRate(plans[vid] || 'gratuit', o.payment_method);
    const avoided = base * rate * FOUNDER_DISCOUNT;
    const isCard = /stripe|carte|card/i.test(String(o.payment_method || ''));
    if (!isCard) bazikScenario += Math.max(0, paid * (BAZIK_FEE_SCENARIO - rate * (1 - FOUNDER_DISCOUNT)));
    const row = (byVendor[vid] ||= { cost: 0, orders: 0, sales: 0 });
    row.cost += avoided; row.orders++; row.sales += paid;
    total += avoided; count++; sales += paid;
  }
  return { total: Math.round(total), orders: count, sales: Math.round(sales), bazikScenario: Math.round(bazikScenario), byVendor };
}

export const daysLeft = (expiresAt: string, now = Date.now()) => Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / DAY));

/** Vendeurs à inviter : propriétaires de boutique qui ne sont pas membres. */
export const inviteTargets = (shopOwnerIds: string[], memberIds: string[]): string[] => {
  const members = new Set(memberIds);
  return [...new Set(shopOwnerIds.filter(Boolean))].filter(id => !members.has(id));
};

export type PushMany = (userIds: string[], title: string, message: string, category: string) => Promise<unknown>;

/**
 * Invitation unique par vendeur : la clé est réservée dans notification_log AVANT l'envoi (idempotence).
 * Simulation : compte les destinataires sans rien réserver ni envoyer.
 */
export async function runFounderInvite(db: any, send: PushMany, opts: { simulate: boolean }) {
  const [{ data: shops, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    db.from('shops').select('vendor_id').limit(5000),
    db.from('founder_program').select('vendor_id').limit(1000),
  ]);
  if (e1 || e2) throw new Error('lecture impossible');
  const memberIds = (members || []).map((m: any) => m.vendor_id);
  if (memberIds.length >= FOUNDER_TOTAL) return { status: 'skipped' as const, reason: `Les ${FOUNDER_TOTAL} places sont prises`, recipients: 0, alreadyInvited: 0 };
  const targets = inviteTargets((shops || []).map((s: any) => s.vendor_id), memberIds);
  if (!targets.length) return { status: 'skipped' as const, reason: 'Aucun vendeur à inviter', recipients: 0, alreadyInvited: 0 };

  const { data: done } = await db.from('notification_log').select('key').in('key', targets.map(INVITE_KEY));
  const doneKeys = new Set((done || []).map((r: any) => r.key));
  const fresh = targets.filter(id => !doneKeys.has(INVITE_KEY(id)));
  const alreadyInvited = targets.length - fresh.length;
  if (opts.simulate) return { status: 'simulation' as const, recipients: fresh.length, alreadyInvited };

  const claimed: string[] = [];
  for (const id of fresh) {
    const { error } = await db.from('notification_log').insert({ key: INVITE_KEY(id) });
    if (!error) claimed.push(id);
  }
  try {
    for (let i = 0; i < claimed.length; i += 1000) await send(claimed.slice(i, i + 1000), INVITE_TITLE, INVITE_MESSAGE, 'promo');
  } catch (e) {
    // Échec d'envoi : on libère les clés pour qu'un nouvel essai soit possible
    try { await db.from('notification_log').delete().in('key', claimed.map(INVITE_KEY)); } catch { /* journal seulement */ }
    throw e;
  }
  return { status: 'sent' as const, recipients: claimed.length, alreadyInvited };
}

export const INVITE_EMAIL_BATCH = 50; // Resend limite le débit : on envoie par lots, un nouveau clic envoie la suite

/**
 * Invitation par e-mail : seulement les vendeurs non membres qui ont activé les promotions (profiles.newsletter = true),
 * une seule fois par vendeur (email_log). Simulation : compte sans rien envoyer.
 */
export async function runFounderInviteEmail(db: any, deps: EmailDeps, secret: string, opts: { simulate: boolean; batch?: number }) {
  const [{ data: shops, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    db.from('shops').select('vendor_id').limit(5000),
    db.from('founder_program').select('vendor_id').limit(1000),
  ]);
  if (e1 || e2) throw new Error('lecture impossible');
  const memberIds = (members || []).map((m: any) => m.vendor_id);
  if (memberIds.length >= FOUNDER_TOTAL) return { status: 'skipped' as const, reason: `Les ${FOUNDER_TOTAL} places sont prises`, recipients: 0, remaining: 0, optedOut: 0, alreadySent: 0, emailsEnabled: !!deps.cfg };
  const targets = inviteTargets((shops || []).map((x: any) => x.vendor_id), memberIds);
  if (!targets.length) return { status: 'skipped' as const, reason: 'Aucun vendeur à inviter', recipients: 0, remaining: 0, optedOut: 0, alreadySent: 0, emailsEnabled: !!deps.cfg };

  const [{ data: profs }, { data: logged }] = await Promise.all([
    db.from('profiles').select('id, newsletter').in('id', targets),
    db.from('email_log').select('dedupe_key').in('dedupe_key', targets.map(id => `founder_invite:${id}`)),
  ]);
  const consent = new Set((profs || []).filter((p: any) => p.newsletter === true).map((p: any) => p.id));
  const sentKeys = new Set((logged || []).map((r: any) => r.dedupe_key));
  const optedOut = targets.filter(id => !consent.has(id)).length;
  const alreadySent = targets.filter(id => consent.has(id) && sentKeys.has(`founder_invite:${id}`)).length;
  const todo = targets.filter(id => consent.has(id) && !sentKeys.has(`founder_invite:${id}`));
  const base = { optedOut, alreadySent, emailsEnabled: !!deps.cfg };
  if (opts.simulate) return { status: 'simulation' as const, recipients: todo.length, remaining: 0, ...base };
  if (!deps.cfg) return { status: 'skipped' as const, reason: 'E-mails désactivés (RESEND_API_KEY et EMAIL_FROM absents)', recipients: 0, remaining: todo.length, ...base };
  if (!secret) return { status: 'skipped' as const, reason: 'Secret de désinscription absent', recipients: 0, remaining: todo.length, ...base };

  const batch = todo.slice(0, opts.batch ?? INVITE_EMAIL_BATCH);
  const left = Math.max(0, FOUNDER_TOTAL - memberIds.length);
  let sent = 0, failed = 0;
  for (const id of batch) {
    const out = await sendFounderInvite(deps, id, left, unsubscribeUrl(deps.cfg.siteUrl, id, secret));
    if (out === 'sent') sent++; else if (out === 'failed') failed++;
  }
  return { status: 'sent' as const, recipients: sent, failed, remaining: todo.length - batch.length, ...base };
}

type Deps = { supabase: any; guard: AdminGuard; send: PushMany; emailDeps: () => EmailDeps; unsubscribeSecret: string };

export function registerFounderAdminRoutes(app: Express, { supabase, guard, send, emailDeps, unsubscribeSecret }: Deps) {
  const base = '/api/admin/founders';
  const audit = async (row: AuditRow) => { try { await supabase.from('admin_audit_log').insert([row]); } catch { /* journal seulement */ } };

  app.get(base, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    try {
      const period = parsePeriod(req.query.period);
      const { data: members, error } = await supabase.from('founder_program').select('vendor_id, category, joined_at, expires_at').order('joined_at', { ascending: true }).limit(1000);
      if (error) throw error;
      const list: Member[] = members || [];
      const ids = list.map(m => m.vendor_id);
      const plans: Record<string, string> = {}; const names: Record<string, string> = {};
      let orders: CostOrder[] = [];
      if (ids.length) {
        const [{ data: shops }, { data: os }] = await Promise.all([
          supabase.from('shops').select('vendor_id, shop_name, plan').in('vendor_id', ids),
          supabase.from('orders').select('vendor_id, total_price, shipping_subsidy, payment_method, status, created_at').in('vendor_id', ids).order('created_at', { ascending: false }).limit(5000),
        ]);
        (shops || []).forEach((s: any) => { plans[s.vendor_id] = String(s.plan || 'gratuit').toLowerCase(); names[s.vendor_id] = s.shop_name || ''; });
        orders = os || [];
      }
      const cost = founderCost(orders, list, plans, periodStart(period));
      const now = Date.now();
      const perCategory = FOUNDER_CATEGORIES.map(c => ({ category: c, quota: FOUNDER_PER_CATEGORY, taken: list.filter(m => m.category === c).length }));
      res.json({
        period, total: FOUNDER_TOTAL, taken: list.length, remaining: Math.max(0, FOUNDER_TOTAL - list.length), perCategory,
        members: list.map(m => ({ ...m, shop_name: names[m.vendor_id] || '', days_left: daysLeft(m.expires_at, now), active: Date.parse(m.expires_at) > now, ...(cost.byVendor[m.vendor_id] || { cost: 0, orders: 0, sales: 0 }) })),
        cost: { total: cost.total, orders: cost.orders, sales: cost.sales, bazik_scenario: cost.bazikScenario, bazik_fee: BAZIK_FEE_SCENARIO },
        truncated: orders.length >= 5000,
      });
    } catch { res.status(500).json({ error: 'Impossible de charger les données.' }); }
  });

  app.post(`${base}/invite`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    const simulate = req.body?.simulate !== false; // par défaut : simulation (aucun envoi sans demande explicite)
    try {
      const r = await runFounderInvite(supabase, send, { simulate });
      await audit({ user_id: user.id, email: user.email || null, action: simulate ? 'fondateurs_invitation_simulation' : 'fondateurs_invitation_envoyee', method: 'POST', path: `${base}/invite`, status: 200, ip: clientIp(req), detail: `${r.status} : ${r.recipients} destinataire(s)` });
      res.json(r);
    } catch { res.status(500).json({ error: "Envoi impossible pour le moment." }); }
  });

  app.post(`${base}/invite-email`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    const simulate = req.body?.simulate !== false;
    try {
      const r = await runFounderInviteEmail(supabase, emailDeps(), unsubscribeSecret, { simulate });
      await audit({ user_id: user.id, email: user.email || null, action: simulate ? 'fondateurs_email_simulation' : 'fondateurs_email_envoye', method: 'POST', path: `${base}/invite-email`, status: 200, ip: clientIp(req), detail: `${r.status} : ${r.recipients} destinataire(s)` });
      res.json(r);
    } catch { res.status(500).json({ error: 'Envoi impossible pour le moment.' }); }
  });
}
