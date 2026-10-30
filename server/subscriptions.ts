// Abonnements vendeurs : la grille de prix est CÔTÉ SERVEUR. Le navigateur ne décide ni du prix, ni du forfait, ni de l'utilisateur.

export const PLAN_PRICES_HTG = {
  pro_local: { mensuel: 350, annuel: 3500 },
  pro_national: { mensuel: 499, annuel: 4990 },
} as const;
export type PlanCode = keyof typeof PLAN_PRICES_HTG;
export type Billing = 'mensuel' | 'annuel';

// « Pro Local », « pro-local », « PRO_LOCAL »… -> pro_local ; tout le reste (dont « gratuit ») est refusé
export function normalizePlan(v: unknown): PlanCode | null {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return s === 'pro_local' || s === 'pro_national' ? s : null;
}
export function normalizeBilling(v: unknown): Billing | null {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'mensuel' || s === 'annuel' ? s : null;
}
export const planPriceHtg = (plan: PlanCode, billing: Billing): number => PLAN_PRICES_HTG[plan][billing];

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Référence unique générée par le serveur (ne contient jamais « _bz_ », séparateur utilisé par Bazik)
export const newSubscriptionRef = (userId: string, now = Date.now()): string => `sub-${userId}-${now.toString(36)}`;
export const isSubscriptionRef = (ref: unknown): boolean => typeof ref === 'string' && ref.startsWith('sub-');

export type SubscriptionCheck =
  | { ok: true; plan: PlanCode; billing: Billing; expected: number }
  | { ok: false; reason: 'invalid_plan' | 'invalid_billing' | 'invalid_amount' | 'underpaid'; expected?: number };

// Le montant payé doit couvrir le prix du forfait (tolérance en % : 0 pour MonCash, quelques % pour Stripe à cause du taux de change)
export function checkSubscriptionPayment(a: { plan: unknown; billing: unknown; paidHtg: unknown; tolerancePct?: number }): SubscriptionCheck {
  const plan = normalizePlan(a.plan);
  if (!plan) return { ok: false, reason: 'invalid_plan' };
  const billing = normalizeBilling(a.billing);
  if (!billing) return { ok: false, reason: 'invalid_billing' };
  const expected = planPriceHtg(plan, billing);
  const paid = Number(a.paidHtg);
  if (!Number.isFinite(paid) || paid <= 0) return { ok: false, reason: 'invalid_amount', expected };
  const tol = Math.min(Math.max(Number(a.tolerancePct ?? 0), 0), 20);
  // 1 gourde de marge pour les arrondis
  if (paid + 1 < expected * (1 - tol / 100)) return { ok: false, reason: 'underpaid', expected };
  return { ok: true, plan, billing, expected };
}

// Montant Stripe (centimes de dollar) -> gourdes, avec le taux courant de la base
export const stripePaidHtg = (amountTotalCents: unknown, htgPerUsd: number): number =>
  Math.round((Number(amountTotalCents) || 0) / 100 * (Number(htgPerUsd) > 0 ? Number(htgPerUsd) : 130));

export type ActivationDecision =
  | { action: 'activate'; plan: PlanCode; billing: Billing }
  | { action: 'skip_duplicate' }
  | { action: 'set_aside'; reason: string; status: 'underpaid' | 'pending_untraceable'; expected?: number };

// Décision d'activer (ou non) un abonnement après un paiement confirmé. Pure : la base de données n'intervient que pour dire si ce paiement a déjà été traité.
export function decideActivation(a: { userId: unknown; planCode: unknown; billing: unknown; paidHtg: unknown; tolerancePct?: number; alreadyProcessed?: boolean }): ActivationDecision {
  if (!isUuid(a.userId)) return { action: 'set_aside', reason: 'invalid_user', status: 'pending_untraceable' };
  const check = checkSubscriptionPayment({ plan: a.planCode, billing: a.billing, paidHtg: a.paidHtg, tolerancePct: a.tolerancePct });
  if (check.ok === false) return { action: 'set_aside', reason: check.reason, status: check.reason === 'underpaid' ? 'underpaid' : 'pending_untraceable', expected: check.expected };
  if (a.alreadyProcessed) return { action: 'skip_duplicate' };
  return { action: 'activate', plan: check.plan, billing: check.billing };
}
