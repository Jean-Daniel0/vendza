// Routes du parrainage : espace du parrain (« Mes filleuls »), rattachement du filleul et administration.
import type { Express } from 'express';
import { AdminGuard, AuditRow, clientIp } from './adminSecurity';
import { attachReferral, getOrCreateCode, ledgerTotals, rateAt, netCommission, canWithdraw, MIN_PAYOUT_HTG, RATE_FIRST, RATE_AFTER, FIRST_PERIOD_MONTHS, addMonths, round2 } from './referral';

type Deps = {
  supabase: any;
  getAuthedUser: (req: any) => Promise<{ id: string; email?: string } | null>;
  guard: AdminGuard;
  commissionFor: (order: any) => Promise<number>;
  siteUrl?: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PENDING_STATUSES = ['payee', 'completed', 'livree'];

export function registerReferralRoutes(app: Express, { supabase, getAuthedUser, guard, commissionFor, siteUrl = 'https://www.vendza.store' }: Deps) {
  const audit = async (row: AuditRow) => { try { await supabase.from('admin_audit_log').insert([row]); } catch { /* journal seulement */ } };

  // ----- Filleul : rattachement du parrain (appelé après l'inscription, avec le lien mémorisé sur l'appareil) -----
  app.post('/api/referral/attach', async (req, res) => {
    const user = await getAuthedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification requise.' });
    try {
      const b = req.body || {};
      const r = await attachReferral(supabase, { refereeId: user.id, code: b.code, clickedAt: b.clickedAt, utmSource: b.utmSource, utmCampaign: b.utmCampaign });
      res.json({ ok: r.status === 'ok' }); // on ne dit jamais pourquoi (pas d'indice pour contourner les contrôles)
    } catch { res.json({ ok: false }); }
  });

  // ----- Parrain : « Mes filleuls » -----
  app.get('/api/referral/me', async (req, res) => {
    const user = await getAuthedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification requise.' });
    try {
      const { data: prof } = await supabase.from('profiles').select('type').eq('id', user.id).maybeSingle();
      if (prof?.type !== 'vendeur') return res.status(403).json({ error: 'Le parrainage est réservé aux vendeurs.' });
      const code = await getOrCreateCode(supabase, user.id);
      const [{ data: refs }, { data: ledger }] = await Promise.all([
        supabase.from('referrals').select('id, referee_id, status, first_sale_at, last_sale_at, created_at').eq('referrer_id', user.id).order('created_at', { ascending: false }).limit(500),
        supabase.from('referral_earnings').select('referral_id, kind, amount').eq('referrer_id', user.id).limit(5000),
      ]);
      const ids = (refs || []).map((r: any) => r.referee_id);
      const shopName: Record<string, string> = {};
      let owed: any[] = [];
      if (ids.length) {
        const [{ data: shops }, { data: os }] = await Promise.all([
          supabase.from('shops').select('vendor_id, shop_name').in('vendor_id', ids),
          supabase.from('orders').select('*').in('vendor_id', ids).in('status', PENDING_STATUSES).limit(1000),
        ]);
        (shops || []).forEach((s: any) => { shopName[s.vendor_id] = s.shop_name || ''; });
        owed = (os || []).filter((o: any) => o.vendor_credited !== true && !/sandbox/i.test(String(o.payment_method || '')));
      }
      const byRef: Record<string, any[]> = {};
      (ledger || []).forEach((l: any) => { (byRef[l.referral_id] ||= []).push(l); });
      // « En attente » = commandes des filleuls payées mais pas encore libérées (estimation, au taux du moment)
      const now = new Date(); const pendingBy: Record<string, number> = {};
      const refByVendor: Record<string, any> = {}; (refs || []).forEach((r: any) => { refByVendor[r.referee_id] = r; });
      for (const o of owed) {
        const r = refByVendor[String(o.vendor_id)]; if (!r || r.status === 'blocked' || r.status === 'rejected') continue;
        const est = netCommission(o, await commissionFor(o)) * rateAt(r.first_sale_at, now);
        pendingBy[r.id] = round2((pendingBy[r.id] || 0) + est);
      }
      const rows = (refs || []).map((r: any) => {
        const t = ledgerTotals(byRef[r.id] || []);
        return { id: r.id, shop: shopName[r.referee_id] || 'Boutique en préparation', status: r.status, since: r.created_at,
          first_sale_at: r.first_sale_at, sales: (byRef[r.id] || []).filter((l: any) => l.kind === 'earn').length,
          earned: t.earned - t.reversed, cancelled: t.reversed, pending: pendingBy[r.id] || 0,
          rate: r.first_sale_at ? rateAt(r.first_sale_at, now) : RATE_FIRST, first_period_ends: r.first_sale_at ? addMonths(r.first_sale_at, FIRST_PERIOD_MONTHS).toISOString() : null };
      });
      const totals = ledgerTotals(ledger || []);
      res.json({ code, link: `${siteUrl}/?ref=${code}`, referrals: rows,
        totals: { earned: totals.earned - totals.reversed, cancelled: totals.reversed, paid: totals.paid, balance: totals.balance, pending: round2(Object.values(pendingBy).reduce((s, v) => s + v, 0)) },
        min_payout: MIN_PAYOUT_HTG, can_withdraw: canWithdraw(totals.balance), rate_first: RATE_FIRST, rate_after: RATE_AFTER });
    } catch { res.status(500).json({ error: 'Impossible de charger vos filleuls pour le moment.' }); }
  });

  // ----- Administration -----
  const base = '/api/admin/referrals';
  app.get(base, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    try {
      const [{ data: refs }, { data: ledger }] = await Promise.all([
        supabase.from('referrals').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('referral_earnings').select('referral_id, referrer_id, kind, amount, created_at').limit(10000),
      ]);
      const people = Array.from(new Set((refs || []).flatMap((r: any) => [r.referrer_id, r.referee_id])));
      const name: Record<string, string> = {};
      if (people.length) {
        const { data: ps } = await supabase.from('profiles').select('id, prenom, nom, boutique_nom, email').in('id', people);
        (ps || []).forEach((p: any) => { name[p.id] = p.boutique_nom || [p.prenom, p.nom].filter(Boolean).join(' ') || p.email || 'Vendeur'; });
      }
      const byRef: Record<string, any[]> = {}; const byReferrer: Record<string, any[]> = {};
      (ledger || []).forEach((l: any) => { (byRef[l.referral_id] ||= []).push(l); (byReferrer[l.referrer_id] ||= []).push(l); });
      const rows = (refs || []).map((r: any) => ({ id: r.id, referrer_id: r.referrer_id, referrer: name[r.referrer_id] || '—', referee: name[r.referee_id] || '—', status: r.status, reject_reason: r.reject_reason,
        utm_source: r.utm_source, utm_campaign: r.utm_campaign, created_at: r.created_at, first_sale_at: r.first_sale_at, ...(() => { const t = ledgerTotals(byRef[r.id] || []); return { earned: t.earned - t.reversed, cancelled: t.reversed }; })() }));
      const referrers = Object.entries(byReferrer).map(([id, ls]) => ({ id, name: name[id] || '—', ...ledgerTotals(ls) })).filter(x => x.earned > 0 || x.paid > 0);
      const all = ledgerTotals(ledger || []);
      res.json({ referrals: rows, referrers, totals: { cost: all.earned - all.reversed, owed: all.balance, paid: all.paid }, min_payout: MIN_PAYOUT_HTG });
    } catch { res.status(500).json({ error: 'Impossible de charger le parrainage.' }); }
  });

  for (const action of ['block', 'unblock'] as const) {
    app.post(`${base}/:id/${action}`, async (req, res) => {
      const user = await guard(req, res); if (!user) return;
      const id = String(req.params.id); if (!UUID.test(id)) return res.status(400).json({ error: 'Identifiant invalide.' });
      try {
        const blocked = action === 'block';
        const { data, error } = await supabase.from('referrals').update(blocked ? { status: 'blocked', reject_reason: 'admin' } : { status: 'active', reject_reason: null }).eq('id', id).select('id');
        if (error) throw error;
        if (!data?.length) return res.status(404).json({ error: 'Parrainage introuvable.' });
        await audit({ user_id: user.id, email: user.email || null, action: `parrainage_${action}`, method: 'POST', path: `${base}/${id}/${action}`, status: 200, ip: clientIp(req), detail: id });
        res.json({ ok: true });
      } catch { res.status(500).json({ error: 'Action impossible pour le moment.' }); }
    });
  }

  // L'admin enregistre un retrait après avoir envoyé l'argent par MonCash (ligne négative dans le registre, seuil vérifié)
  app.post(`${base}/payout`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    const referrerId = String(req.body?.referrerId || ''); const amount = Math.round(Number(req.body?.amount) * 100) / 100;
    const reference = String(req.body?.reference || '').trim().slice(0, 80);
    if (!UUID.test(referrerId) || !(amount > 0) || !reference) return res.status(400).json({ error: 'Parrain, montant et référence MonCash sont requis.' });
    try {
      const { data: ledger } = await supabase.from('referral_earnings').select('referral_id, kind, amount').eq('referrer_id', referrerId).limit(10000);
      const t = ledgerTotals(ledger || []);
      if (!canWithdraw(t.balance)) return res.status(409).json({ error: `Solde insuffisant : seuil de ${MIN_PAYOUT_HTG} Gdes non atteint.` });
      if (amount > t.balance) return res.status(409).json({ error: 'Le montant dépasse le solde du parrain.' });
      const { data: anyRef } = await supabase.from('referrals').select('id').eq('referrer_id', referrerId).limit(1);
      if (!anyRef?.length) return res.status(404).json({ error: 'Parrain introuvable.' });
      const { error } = await supabase.from('referral_earnings').insert([{ referral_id: anyRef[0].id, referrer_id: referrerId, kind: 'payout', amount: -amount, reference, note: 'retrait MonCash' }]);
      if (error) throw error;
      await audit({ user_id: user.id, email: user.email || null, action: 'parrainage_retrait', method: 'POST', path: `${base}/payout`, status: 200, ip: clientIp(req), detail: `${referrerId} ${amount} ${reference}` });
      res.json({ ok: true, balance: round2(t.balance - amount) });
    } catch { res.status(500).json({ error: 'Enregistrement impossible pour le moment.' }); }
  });
}
