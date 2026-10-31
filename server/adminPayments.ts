// Page admin « Paiements » : remboursements à traiter, virements vendeurs en attente, export CSV, journal.
// Le virement MonCash d'un remboursement reste manuel : l'admin le fait, puis le marque « payé » avec la référence MonCash.
import type { Express, Request, Response } from 'express';
import { normalizeMoncashNumber } from './moncash';

export type AuthedUser = { id: string; email?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

/** Cellule CSV sûre : guillemets doublés, et neutralisation des formules Excel (= + - @) qui pourraient venir d'un nom saisi par un client. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], cols: { key: string; label: string }[]): string {
  const head = cols.map(c => csvCell(c.label)).join(',');
  const body = rows.map(r => cols.map(c => csvCell(r[c.key])).join(','));
  return '\uFEFF' + [head, ...body].join('\r\n') + '\r\n';
}

export type Decision = { note: string; reference: string };

/** « payé » exige la référence du virement MonCash (preuve) ; « refusé » exige un motif. */
export function parseDecision(kind: 'paid' | 'reject', body: any): { ok: true; value: Decision } | { ok: false; error: string } {
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
  if (note.length > 500) return { ok: false, error: 'La note est trop longue (500 caractères maximum).' };
  if (reference.length > 80) return { ok: false, error: 'La référence est trop longue (80 caractères maximum).' };
  if (kind === 'paid' && reference.length < 3) return { ok: false, error: 'Indiquez la référence de la transaction MonCash du remboursement.' };
  if (kind === 'reject' && note.length < 3) return { ok: false, error: 'Indiquez le motif du refus.' };
  return { ok: true, value: { note, reference } };
}

/** Réponse documentée de Bazik GET /balance : { available, reserved, currency, environment, last_updated }. On tolère aussi quelques noms voisins. */
const num = (c: any): number | null => { const n = typeof c === 'string' ? Number(c.replace(/[\s,]/g, '')) : c; return typeof n === 'number' && Number.isFinite(n) ? n : null; };
export function extractBalance(data: any): number | null {
  for (const c of [data?.available, data?.balance, data?.available_balance, data?.availableBalance, data?.data?.available, data?.data?.balance]) {
    const n = num(c); if (n !== null) return n;
  }
  return null;
}
export function extractBalanceInfo(data: any) {
  const env = typeof data?.environment === 'string' && /^(sandbox|production)$/i.test(data.environment) ? data.environment.toLowerCase() : null;
  return { balance: extractBalance(data), reserved: num(data?.reserved), environment: env, last_updated: typeof data?.last_updated === 'string' ? data.last_updated : null };
}

export type QueueInput = { refunds: any[]; orders: any[]; profiles: any[]; vendorPrivate: any[]; payouts: any[] };

/** Assemble les files « à rembourser » et « à verser » à partir des lignes brutes (fonction pure, testée). */
export function buildQueue(input: QueueInput) {
  const orderById = new Map(input.orders.map(o => [o.id, o]));
  const profileById = new Map(input.profiles.map(p => [p.id, p]));
  const privById = new Map(input.vendorPrivate.map(p => [p.user_id, p]));
  const payoutByRef = new Map(input.payouts.map(p => [p.reference, p]));
  const fullName = (p: any) => [p?.prenom, p?.nom].filter(Boolean).join(' ').trim();

  const refunds = input.refunds.map(r => {
    const o: any = orderById.get(r.order_id) || {};
    const b: any = profileById.get(r.buyer_id) || {};
    return {
      id: r.id, order_id: r.order_id, status: r.status, created_at: r.created_at, paid_at: r.paid_at || null, note: r.note || '',
      amount: Number(r.amount) || 0, fee: Number(r.fee) || 0,
      buyer_name: fullName(b) || o.client_name || '', buyer_moncash: b.numero_moncash || '', buyer_phone: b.telephone || o.client_tel || '',
      product_name: o.product_name || '', payment_method: o.payment_method || '', payment_reference: o.payment_reference || '',
    };
  });

  const payouts = input.orders
    .filter(o => o.status === 'completed' && o.vendor_credited !== true)
    .map(o => {
      const vid = o.vendor_id || o.seller_id || o.owner_id;
      const v: any = profileById.get(vid) || {};
      const pv: any = privById.get(vid) || {};
      const lock: any = payoutByRef.get(`PAY_VENDOR_${o.id}`);
      const moncash = pv.moncash || v.numero_moncash || '';
      return {
        order_id: o.id, vendor_id: vid || null, shop: v.boutique_nom || fullName(v) || o.vendor_name || '',
        moncash, moncash_name: pv.moncash_nom || v.moncash_nom || '',
        total_price: Number(o.total_price) || 0, payout_amount: lock ? Number(lock.amount) || 0 : null,
        state: lock ? 'en cours' : (!moncash ? 'n° MonCash manquant' : !normalizeMoncashNumber(moncash) ? 'n° MonCash invalide' : 'à relancer'),
        created_at: o.created_at || o.ceated_at || null, payment_method: o.payment_method || '',
      };
    });

  const pendingRefunds = refunds.filter(r => r.status === 'pending');
  return {
    refunds, payouts,
    totals: {
      refunds_pending_count: pendingRefunds.length,
      refunds_pending_amount: pendingRefunds.reduce((s, r) => s + r.amount, 0),
      payouts_open_count: payouts.length,
    },
  };
}

type Deps = {
  supabase: any;
  getAuthedUser: (req: Request) => Promise<AuthedUser | null>;
  /** Client Supabase portant le jeton de l'appelant : permet de poser la question à la base elle-même (public.is_admin()). */
  makeUserClient: (token: string) => any;
  /** Appel GET /balance de Bazik (lecture seule). */
  getBazikBalance?: () => Promise<{ ok: true; data: any } | { ok: false; status: number }>;
  /** Vérifie chez Bazik les paiements MonCash récents sans commande (notification perdue) et crée les commandes manquantes. */
  reconcilePayments?: () => Promise<Record<string, unknown> & { fulfilled: string[] }>;
  /** GET /transfers/{id} de Bazik (lecture seule). */
  getTransfer?: (transactionId: string) => Promise<{ ok: true; data: any } | { ok: false; status: number }>;
};

export function registerAdminPaymentsRoutes(app: Express, deps: Deps) {
  const { supabase, getAuthedUser, makeUserClient, getBazikBalance, reconcilePayments, getTransfer } = deps;
  const base = '/api/admin/payments';

  // Une seule source de vérité pour « qui est admin » : la fonction public.is_admin() de la base (la même que pour les règles RLS).
  const needAdmin = async (req: Request, res: Response): Promise<AuthedUser | null> => {
    const user = await getAuthedUser(req);
    if (!user) { res.status(401).json({ error: 'Authentification requise.' }); return null; }
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    try {
      const { data, error } = await makeUserClient(token).rpc('is_admin');
      if (error || data !== true) { res.status(403).json({ error: 'Accès réservé aux administrateurs.' }); return null; }
    } catch {
      res.status(403).json({ error: 'Accès réservé aux administrateurs.' }); return null;
    }
    res.set('Cache-Control', 'no-store');
    return user;
  };

  const loadQueue = async () => {
    const { data: refunds, error: e1 } = await supabase.from('refunds').select('*').order('created_at', { ascending: false }).limit(500);
    if (e1) throw new Error('refunds');
    const { data: toPay, error: e2 } = await supabase.from('orders').select('*')
      .eq('status', 'completed').or('vendor_credited.is.null,vendor_credited.eq.false').order('created_at', { ascending: false }).limit(500);
    if (e2) throw new Error('orders');
    const refundOrderIds = (refunds || []).map((r: any) => r.order_id).filter(Boolean);
    let refundOrders: any[] = [];
    if (refundOrderIds.length) {
      const { data } = await supabase.from('orders').select('*').in('id', refundOrderIds);
      refundOrders = data || [];
    }
    const orders = [...(toPay || []), ...refundOrders.filter(o => !(toPay || []).some((t: any) => t.id === o.id))];
    const userIds = Array.from(new Set([
      ...(refunds || []).map((r: any) => r.buyer_id),
      ...(toPay || []).map((o: any) => o.vendor_id || o.seller_id || o.owner_id),
    ].filter(Boolean)));
    let profiles: any[] = [], vendorPrivate: any[] = [];
    if (userIds.length) {
      profiles = (await supabase.from('profiles').select('id, prenom, nom, telephone, numero_moncash, moncash_nom, boutique_nom').in('id', userIds)).data || [];
      vendorPrivate = (await supabase.from('vendor_private').select('user_id, moncash, moncash_nom').in('user_id', userIds)).data || [];
    }
    const refs = (toPay || []).map((o: any) => `PAY_VENDOR_${o.id}`);
    const payouts = refs.length ? ((await supabase.from('payouts').select('reference, amount, status').in('reference', refs)).data || []) : [];
    return buildQueue({ refunds: refunds || [], orders, profiles, vendorPrivate, payouts });
  };

  app.get(`${base}/me`, async (req, res) => {
    const user = await needAdmin(req, res); if (!user) return;
    res.json({ isAdmin: true });
  });

  app.get(`${base}/queue`, async (req, res) => {
    const user = await needAdmin(req, res); if (!user) return;
    try { res.json(await loadQueue()); }
    catch { res.status(500).json({ error: 'Impossible de charger les paiements.' }); }
  });

  app.get(`${base}/bazik-balance`, async (req, res) => {
    const user = await needAdmin(req, res); if (!user) return;
    if (!getBazikBalance) return res.status(501).json({ error: 'Solde Bazik non disponible.' });
    const r = await getBazikBalance();
    if (r.ok === false) return res.status(502).json({ error: 'Bazik ne répond pas (clés ou service).' });
    const info = extractBalanceInfo(r.data);
    // Format inattendu : court extrait brut pour que l'admin voie ce que Bazik répond (lecture seule, aucune clé).
    res.json({ ...info, raw: info.balance === null ? JSON.stringify(r.data).slice(0, 300) : undefined });
  });

  app.post(`${base}/reconcile`, async (req, res) => {
    const admin = await needAdmin(req, res); if (!admin) return;
    if (!reconcilePayments) return res.status(501).json({ error: 'Rapprochement indisponible.' });
    try {
      const summary = await reconcilePayments();
      await supabase.from('admin_payment_log').insert({
        admin_id: admin.id, admin_email: admin.email || null, action: 'reconcile_payments',
        note: JSON.stringify(summary).slice(0, 500),
      });
      res.json(summary);
    } catch { res.status(500).json({ error: 'Vérification impossible (table bazik_payment_refs créée ?).' }); }
  });

  // Statut d'un virement vendeur chez Bazik (lecture seule) : dit si l'argent est vraiment parti quand la notification n'est pas arrivée.
  app.get(`${base}/payouts/:orderId/transfer-status`, async (req, res) => {
    const admin = await needAdmin(req, res); if (!admin) return;
    const orderId = String(req.params.orderId);
    if (!isUuid(orderId)) return res.status(400).json({ error: 'Identifiant invalide.' });
    if (!getTransfer) return res.status(501).json({ error: 'Vérification indisponible.' });
    const { data: row, error } = await supabase.from('payouts').select('bazik_transaction_id').eq('reference', `PAY_VENDOR_${orderId}`).maybeSingle();
    if (error) return res.status(500).json({ error: 'Lecture impossible (migration appliquée ?).' });
    if (!row?.bazik_transaction_id) return res.status(404).json({ error: "Aucun identifiant de virement Bazik enregistré pour cette commande." });
    const r = await getTransfer(String(row.bazik_transaction_id));
    if (r.ok === false) return res.status(r.status === 404 ? 404 : 502).json({ error: r.status === 404 ? 'Bazik ne connaît pas ce virement.' : 'Bazik ne répond pas.' });
    const d = r.data || {};
    res.json({
      transaction_id: row.bazik_transaction_id, status: typeof d.status === 'string' ? d.status : null,
      failure_reason: typeof d.failureReason === 'string' ? d.failureReason : null,
      amount: Number(d.amount) || null, fees: Number(d.fees) || null, total: Number(d.total) || null,
      provider: typeof d.provider === 'string' ? d.provider : null, environment: typeof d.environment === 'string' ? d.environment : null,
    });
  });

  app.get(`${base}/log`, async (req, res) => {
    const user = await needAdmin(req, res); if (!user) return;
    const { data, error } = await supabase.from('admin_payment_log').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) return res.status(500).json({ error: 'Journal indisponible (la migration admin_payment_log est-elle appliquée ?).' });
    res.json({ log: data || [] });
  });

  app.get(`${base}/export/:kind`, async (req, res) => {
    const user = await needAdmin(req, res); if (!user) return;
    const kind = String(req.params.kind);
    let csv = '';
    if (kind === 'log') {
      const { data, error } = await supabase.from('admin_payment_log').select('*').order('created_at', { ascending: false }).limit(5000);
      if (error) return res.status(500).json({ error: 'Journal indisponible.' });
      csv = toCsv(data || [], [
        { key: 'created_at', label: 'Date' }, { key: 'admin_email', label: 'Admin' }, { key: 'action', label: 'Action' },
        { key: 'order_id', label: 'Commande' }, { key: 'refund_id', label: 'Remboursement' }, { key: 'amount', label: 'Montant HTG' },
        { key: 'reference', label: 'Référence MonCash' }, { key: 'note', label: 'Note' },
      ]);
    } else if (kind === 'refunds' || kind === 'payouts') {
      let q;
      try { q = await loadQueue(); } catch { return res.status(500).json({ error: 'Export impossible.' }); }
      csv = kind === 'refunds'
        ? toCsv(q.refunds, [
            { key: 'created_at', label: 'Date' }, { key: 'status', label: 'Statut' }, { key: 'order_id', label: 'Commande' },
            { key: 'buyer_name', label: 'Acheteur' }, { key: 'buyer_moncash', label: 'MonCash acheteur' }, { key: 'buyer_phone', label: 'Téléphone' },
            { key: 'amount', label: 'Montant à rembourser HTG' }, { key: 'fee', label: 'Frais HTG' }, { key: 'payment_method', label: 'Moyen de paiement' },
            { key: 'payment_reference', label: 'Référence paiement' }, { key: 'paid_at', label: 'Payé le' }, { key: 'note', label: 'Note' },
          ])
        : toCsv(q.payouts, [
            { key: 'created_at', label: 'Date commande' }, { key: 'order_id', label: 'Commande' }, { key: 'shop', label: 'Vendeur' },
            { key: 'moncash', label: 'MonCash vendeur' }, { key: 'moncash_name', label: 'Nom MonCash' }, { key: 'total_price', label: 'Total commande HTG' },
            { key: 'payout_amount', label: 'Montant du virement HTG' }, { key: 'state', label: 'État' },
          ]);
    } else {
      return res.status(404).json({ error: 'Export inconnu.' });
    }
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="vendza-${kind}-${new Date().toISOString().slice(0, 10)}.csv"` });
    res.send(csv);
  });

  const decide = (kind: 'paid' | 'reject') => async (req: Request, res: Response) => {
    const admin = await needAdmin(req, res); if (!admin) return;
    const id = String(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: 'Identifiant invalide.' });
    const v = parseDecision(kind, req.body);
    if (v.ok === false) return res.status(400).json({ error: v.error });
    const patch: any = kind === 'paid'
      ? { status: 'paid', paid_at: new Date().toISOString(), note: [v.value.reference && `MonCash ${v.value.reference}`, v.value.note].filter(Boolean).join(' — ') }
      : { status: 'rejected', note: v.value.note };
    // Transition atomique : seule une demande encore « pending » peut être tranchée (deux clics, ou deux admins : un seul gagne).
    const { data: row, error } = await supabase.from('refunds').update(patch).eq('id', id).eq('status', 'pending').select('id, order_id, amount').maybeSingle();
    if (error) return res.status(500).json({ error: 'Mise à jour impossible.' });
    if (!row) return res.status(409).json({ error: 'Cette demande a déjà été traitée (ou n\'existe pas).' });
    const { error: logErr } = await supabase.from('admin_payment_log').insert({
      admin_id: admin.id, admin_email: admin.email || null, action: kind === 'paid' ? 'refund_paid' : 'refund_rejected',
      refund_id: row.id, order_id: row.order_id, amount: row.amount, reference: v.value.reference || null, note: v.value.note || null,
    });
    if (logErr) console.error('[AdminPayments] journal non écrit pour le remboursement', row.id, logErr.message);
    res.json({ ok: true, logged: !logErr });
  };
  app.post(`${base}/refunds/:id/paid`, decide('paid'));
  app.post(`${base}/refunds/:id/reject`, decide('reject'));
}
