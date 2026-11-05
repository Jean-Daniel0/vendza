// Commission Vendza selon le forfait du vendeur et le moyen de paiement du client.
// Carte bancaire : taux réduits, car les frais de carte sont payés par le client. MonCash : taux standard.
export type PlanKey = 'gratuit' | 'pro_local' | 'pro_national';

export const normalizePlanKey = (plan: unknown): PlanKey => {
  const p = String(plan || '').toLowerCase().trim().replace(/\s+/g, '_');
  return p === 'pro_national' ? 'pro_national' : p === 'pro_local' ? 'pro_local' : 'gratuit';
};

const STANDARD: Record<PlanKey, number> = { gratuit: 20, pro_local: 15, pro_national: 10 };
const CARD: Record<PlanKey, number> = { gratuit: 12, pro_local: 9.5, pro_national: 5 };

export const isCardMethod = (method: unknown): boolean => /stripe|carte|card/i.test(String(method || ''));

/** Commission en pourcentage (ex. 9.5). */
export const commissionPercent = (plan: unknown, method?: unknown): number =>
  (isCardMethod(method) ? CARD : STANDARD)[normalizePlanKey(plan)];

/** Commission en fraction (ex. 0.095). */
export const commissionRate = (plan: unknown, method?: unknown): number => commissionPercent(plan, method) / 100;
