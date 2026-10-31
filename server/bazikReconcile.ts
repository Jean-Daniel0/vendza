// Vérification directe des paiements MonCash chez Bazik (GET /order/{orderId}) quand la notification (webhook) n'est pas arrivée.
// Garde-fous : seul un paiement « successful » chez Bazik déclenche la création de commande, et la création est idempotente
// (creerCommandeApresPaiement ne crée jamais de doublon).
export type BazikOrderLite = { status?: unknown; amount?: unknown } | null;
export type Decision = 'fulfill' | 'wait' | 'ignore' | 'unknown';

export function decideReconcile(o: BazikOrderLite): Decision {
  const st = typeof o?.status === 'string' ? o.status.toLowerCase() : '';
  if (st === 'successful') return 'fulfill';
  if (st === 'pending') return 'wait';
  if (st === 'failed' || st === 'cancelled') return 'ignore';
  return 'unknown';
}

export type Ref = { reference_id: string; order_ref: string; bazik_order_id: string; amount?: number | null };
export type ReconcileDeps = {
  listRefs: () => Promise<Ref[]>;
  isSubscription: (orderRef: string) => boolean;
  isProcessed: (orderRef: string) => Promise<boolean>;
  fetchOrder: (bazikOrderId: string) => Promise<BazikOrderLite | 'error'>;
  fulfill: (orderRef: string, bazikOrderId: string, paidAmount: number | null) => Promise<void>;
};
export type ReconcileSummary = { checked: number; already: number; fulfilled: string[]; waiting: number; ignored: number; unknown: number; errors: number; skipped_subscriptions: number };

export async function reconcileMoncashPayments(d: ReconcileDeps): Promise<ReconcileSummary> {
  const sum: ReconcileSummary = { checked: 0, already: 0, fulfilled: [], waiting: 0, ignored: 0, unknown: 0, errors: 0, skipped_subscriptions: 0 };
  const seen = new Set<string>();
  for (const ref of await d.listRefs()) {
    if (seen.has(ref.order_ref)) continue; // plusieurs tentatives de paiement pour la même commande : un seul passage
    if (d.isSubscription(ref.order_ref)) { sum.skipped_subscriptions++; continue; }
    sum.checked++;
    try {
      if (await d.isProcessed(ref.order_ref)) { sum.already++; seen.add(ref.order_ref); continue; }
      const o = await d.fetchOrder(ref.bazik_order_id);
      if (o === 'error') { sum.errors++; continue; }
      const dec = decideReconcile(o);
      if (dec === 'fulfill') {
        const amt = Number((o as any)?.amount);
        await d.fulfill(ref.order_ref, ref.bazik_order_id, Number.isFinite(amt) ? amt : null);
        sum.fulfilled.push(ref.order_ref); seen.add(ref.order_ref);
      } else if (dec === 'wait') sum.waiting++;
      else if (dec === 'ignore') sum.ignored++;
      else sum.unknown++;
    } catch { sum.errors++; }
  }
  return sum;
}
