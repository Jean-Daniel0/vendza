// Programme de parrainage Vendza (vendeurs seulement).
// Règles : le parrain gagne 15 % de la commission NETTE réellement encaissée par Vendza pendant 6 mois à partir de la 1re vente
// livrée du filleul, puis 1,5 % ensuite. Un gain n'existe qu'après libération du séquestre (vendeur crédité) ; un remboursement
// l'annule. Le registre `referral_earnings` est immuable : on ajoute des lignes, on ne modifie jamais.
import { BAZIK_FEE_SCENARIO } from './founderAdmin';

export type Db = any;

export const RATE_FIRST = 0.15;
export const RATE_AFTER = 0.015;
export const FIRST_PERIOD_MONTHS = 6;
export const INACTIVITY_DAYS = 90;
export const MIN_PAYOUT_HTG = 2500;
export const LINK_VALID_DAYS = 30;
export const NEW_ACCOUNT_MAX_DAYS = 7; // un compte ancien ne peut pas être rattaché après coup (pas de parrainage rétroactif)
const DAY = 86400000;

// ---------- Outils purs ----------
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I
export function generateReferralCode(rand: (n: number) => number = n => Math.floor(Math.random() * n), len = 8): string {
  let c = ''; for (let i = 0; i < len; i++) c += CODE_ALPHABET[rand(CODE_ALPHABET.length)]; return c;
}
export const normalizeReferralCode = (v: unknown): string => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

/** Numéro comparable : chiffres seulement, 8 derniers (numéros haïtiens, avec ou sans +509). */
export function phoneKey(v: unknown): string {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
}

export function addMonths(iso: string | Date, months: number): Date {
  const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() + months); return d;
}
export function rateAt(firstSaleAt: string | Date | null | undefined, now: Date): number {
  if (!firstSaleAt) return RATE_FIRST;
  return now.getTime() < addMonths(firstSaleAt, FIRST_PERIOD_MONTHS).getTime() ? RATE_FIRST : RATE_AFTER;
}
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Commission nette de Vendza sur une commande : commission moins les frais de paiement (0 pour la carte, frais payés par le client). */
export function netCommission(order: any, commissionHtg: number): number {
  const isCard = /stripe|carte|card/i.test(String(order?.payment_method || ''));
  const base = (Number(order?.total_price ?? order?.total ?? 0) || 0) + (Number(order?.shipping_subsidy) || 0);
  const fee = isCard ? 0 : base * BAZIK_FEE_SCENARIO;
  return Math.max(0, round2(commissionHtg - fee));
}

export type FraudCheck = { ok: true } | { ok: false; reason: 'auto_parrainage' | 'meme_telephone' | 'meme_moncash' };
/** Pas d'auto-parrainage ; même téléphone ou même numéro MonCash entre parrain et filleul : refusé. */
export function fraudCheck(a: { id: string; phones: unknown[]; moncash: unknown[] }, b: { id: string; phones: unknown[]; moncash: unknown[] }): FraudCheck {
  if (a.id === b.id) return { ok: false, reason: 'auto_parrainage' };
  const keys = (xs: unknown[]) => new Set(xs.map(phoneKey).filter(Boolean));
  const common = (x: Set<string>, y: Set<string>) => [...x].some(k => y.has(k));
  if (common(keys(a.moncash), keys(b.moncash))) return { ok: false, reason: 'meme_moncash' };
  if (common(keys([...a.phones, ...a.moncash]), keys([...b.phones, ...b.moncash]))) return { ok: false, reason: 'meme_telephone' };
  return { ok: true };
}

async function identityOf(db: Db, id: string) {
  const [{ data: p }, { data: v }, { data: s }] = await Promise.all([
    db.from('profiles').select('telephone, numero_moncash, type, created_at').eq('id', id).maybeSingle(),
    db.from('vendor_private').select('moncash').eq('user_id', id).maybeSingle(),
    db.from('shops').select('moncash').eq('vendor_id', id).maybeSingle(),
  ]);
  return { id, phones: [p?.telephone], moncash: [p?.numero_moncash, v?.moncash, s?.moncash], type: p?.type, createdAt: p?.created_at as string | undefined };
}

// ---------- Code du parrain ----------
export async function getOrCreateCode(db: Db, vendorId: string): Promise<string> {
  const { data } = await db.from('referral_codes').select('code').eq('vendor_id', vendorId).maybeSingle();
  if (data?.code) return data.code;
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    const { error } = await db.from('referral_codes').insert([{ vendor_id: vendorId, code }]);
    if (!error) return code;
    const again = await db.from('referral_codes').select('code').eq('vendor_id', vendorId).maybeSingle();
    if (again.data?.code) return again.data.code; // créé entre-temps
  }
  throw new Error('Impossible de créer le code de parrainage.');
}

// ---------- Rattachement du filleul ----------
export type AttachInput = { refereeId: string; code: unknown; clickedAt?: unknown; utmSource?: unknown; utmCampaign?: unknown };
export type AttachResult = { status: 'ok' | 'ignored'; reason?: string };

export async function attachReferral(db: Db, input: AttachInput, now: Date = new Date()): Promise<AttachResult> {
  const code = normalizeReferralCode(input.code);
  if (!code) return { status: 'ignored', reason: 'code_invalide' };
  const clicked = input.clickedAt ? new Date(String(input.clickedAt)) : null;
  if (clicked && !isNaN(clicked.getTime()) && now.getTime() - clicked.getTime() > LINK_VALID_DAYS * DAY) return { status: 'ignored', reason: 'lien_expire' };

  const { data: row } = await db.from('referral_codes').select('vendor_id').eq('code', code).maybeSingle();
  if (!row?.vendor_id) return { status: 'ignored', reason: 'code_inconnu' };
  const referrerId = String(row.vendor_id);
  if (referrerId === input.refereeId) return { status: 'ignored', reason: 'auto_parrainage' };

  // Premier lien gagnant : un filleul n'a qu'un seul parrain
  const { data: existing } = await db.from('referrals').select('id').eq('referee_id', input.refereeId).maybeSingle();
  if (existing) return { status: 'ignored', reason: 'deja_parraine' };

  const referee = await identityOf(db, input.refereeId);
  if (referee.createdAt && now.getTime() - new Date(referee.createdAt).getTime() > NEW_ACCOUNT_MAX_DAYS * DAY) return { status: 'ignored', reason: 'compte_existant' };

  const referrer = await identityOf(db, referrerId);
  const fc = fraudCheck(referrer, referee);
  const clip = (v: unknown) => String(v ?? '').trim().slice(0, 60) || null;
  const { error } = await db.from('referrals').insert([{
    referrer_id: referrerId, referee_id: input.refereeId, code,
    utm_source: clip(input.utmSource), utm_campaign: clip(input.utmCampaign),
    status: fc.ok === false ? 'rejected' : 'pending', reject_reason: fc.ok === false ? fc.reason : null,
  }]);
  if (error) return { status: 'ignored', reason: 'deja_parraine' };
  return { status: 'ok' };
}

// ---------- Gain à la libération du séquestre ----------
export type CreditDeps = { db: Db; commissionFor: (order: any) => Promise<number>; now?: () => Date };
export type CreditResult = { status: 'credited' | 'skipped'; reason?: string; amount?: number };

export async function creditReferralForOrder({ db, commissionFor, now = () => new Date() }: CreditDeps, order: any): Promise<CreditResult> {
  const orderId = String(order?.id ?? '');
  const vendorId = String(order?.vendor_id || order?.vendeur_id || order?.seller_id || '');
  if (!orderId || !vendorId) return { status: 'skipped', reason: 'commande_incomplete' };
  if (order.vendor_credited !== true) return { status: 'skipped', reason: 'sequestre_non_libere' };
  if (/sandbox/i.test(String(order.payment_method || ''))) return { status: 'skipped', reason: 'paiement_test' };

  const { data: ref } = await db.from('referrals').select('*').eq('referee_id', vendorId).maybeSingle();
  if (!ref) return { status: 'skipped', reason: 'pas_de_parrain' };
  if (ref.status === 'blocked' || ref.status === 'rejected') return { status: 'skipped', reason: 'parrainage_' + ref.status };

  const { data: done } = await db.from('referral_earnings').select('id').eq('order_id', orderId).eq('kind', 'earn').maybeSingle();
  if (done) return { status: 'skipped', reason: 'deja_compte' };

  const t = now();
  // Contrôle anti-fraude au moment où les numéros du vendeur sont connus
  if (ref.status === 'pending') {
    const [a, b] = await Promise.all([identityOf(db, ref.referrer_id), identityOf(db, ref.referee_id)]);
    const fc = fraudCheck(a, b);
    if (fc.ok === false) { await db.from('referrals').update({ status: 'rejected', reject_reason: fc.reason }).eq('id', ref.id); return { status: 'skipped', reason: fc.reason }; }
  }

  const rate = rateAt(ref.first_sale_at, t);
  // Après les 6 mois, le gain s'arrête si le filleul est resté 90 jours sans vente
  if (rate === RATE_AFTER && ref.last_sale_at && t.getTime() - new Date(ref.last_sale_at).getTime() > INACTIVITY_DAYS * DAY) {
    await db.from('referrals').update({ status: 'blocked', reject_reason: 'inactivite_90_jours' }).eq('id', ref.id);
    return { status: 'skipped', reason: 'inactivite_90_jours' };
  }

  const base = netCommission(order, await commissionFor(order));
  const amount = round2(base * rate);
  const iso = t.toISOString();
  const patch: any = { last_sale_at: iso, status: 'active' };
  if (!ref.first_sale_at) patch.first_sale_at = iso;
  if (amount <= 0) { await db.from('referrals').update(patch).eq('id', ref.id); return { status: 'skipped', reason: 'commission_nette_nulle' }; }

  const { error } = await db.from('referral_earnings').insert([{ referral_id: ref.id, referrer_id: ref.referrer_id, order_id: orderId, kind: 'earn', rate, commission_base: base, amount }]);
  if (error) return { status: 'skipped', reason: 'deja_compte' }; // index unique : un seul gain par commande
  await db.from('referrals').update(patch).eq('id', ref.id);
  return { status: 'credited', amount };
}

/** Remboursement ou litige : annule le gain de la commande (ligne négative, une seule fois). */
export async function reverseReferralForOrder(db: Db, orderId: string, note = 'remboursement'): Promise<{ status: 'reversed' | 'skipped'; amount?: number }> {
  const { data: earn } = await db.from('referral_earnings').select('*').eq('order_id', orderId).eq('kind', 'earn').maybeSingle();
  if (!earn) return { status: 'skipped' };
  const { data: rev } = await db.from('referral_earnings').select('id').eq('order_id', orderId).eq('kind', 'reversal').maybeSingle();
  if (rev) return { status: 'skipped' };
  const amount = -Math.abs(Number(earn.amount));
  const { error } = await db.from('referral_earnings').insert([{ referral_id: earn.referral_id, referrer_id: earn.referrer_id, order_id: orderId, kind: 'reversal', rate: earn.rate, commission_base: earn.commission_base, amount, note }]);
  return error ? { status: 'skipped' } : { status: 'reversed', amount };
}

/** Rattrape les commandes déjà versées dont le gain n'a pas été enregistré (idempotent). */
export async function sweepReferralEarnings(deps: CreditDeps, limit = 200): Promise<{ credited: number; checked: number }> {
  const { db } = deps;
  const { data: refs } = await db.from('referrals').select('referee_id').in('status', ['pending', 'active']).limit(1000);
  const ids = (refs || []).map((r: any) => r.referee_id);
  if (!ids.length) return { credited: 0, checked: 0 };
  const { data: orders } = await db.from('orders').select('*').in('vendor_id', ids).eq('vendor_credited', true).order('vendor_credited_at', { ascending: true }).limit(limit);
  let credited = 0;
  for (const o of orders || []) { const r = await creditReferralForOrder(deps, o); if (r.status === 'credited') credited++; }
  return { credited, checked: (orders || []).length };
}

// ---------- Soldes ----------
export type EarningRow = { referral_id?: string; kind: string; amount: number | string };
export function ledgerTotals(rows: EarningRow[]) {
  let earned = 0, reversed = 0, paid = 0;
  for (const r of rows) {
    const a = Number(r.amount) || 0;
    if (r.kind === 'earn') earned += a; else if (r.kind === 'reversal') reversed += -a; else if (r.kind === 'payout') paid += -a;
  }
  return { earned: round2(earned), reversed: round2(reversed), paid: round2(paid), balance: round2(earned - reversed - paid) };
}
export const canWithdraw = (balance: number): boolean => balance >= MIN_PAYOUT_HTG;
