import type { Express, Request, Response } from 'express';
import { AdminGuard, isUuid, maskIdNumber, validateVerification, summarizeOrders, promoFlags, hasSecondFactor, AuditRow, clientIp } from './adminSecurity';

type Deps = { supabase: any; guard: AdminGuard };

// Écrans de l'administration (une seule page). Tout passe par le gardien : admin + double authentification.
export function registerAdminRoutes(app: Express, { supabase, guard }: Deps) {
  const base = '/api/admin';

  const audit = async (row: AuditRow) => { try { await supabase.from('admin_audit_log').insert([row]); } catch {} };
  const fail = (res: Response, msg = 'Impossible de charger les données.') => res.status(500).json({ error: msg });

  // État de la session : l'admin sans double authentification reçoit « mfa » (c'est le seul cas où cette route répond autre chose que 404).
  app.get(`${base}/session`, async (req, res) => {
    const user = await guard(req, res, { skipMfa: true }); if (!user) return;
    const token = String(req.headers.authorization || '').slice(7);
    const mfaRequired = process.env.ADMIN_REQUIRE_MFA !== 'false';
    const ok = !mfaRequired || hasSecondFactor(token);
    res.json({ state: ok ? 'ok' : 'mfa', email: user.email || null });
  });

  app.get(`${base}/overview`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    try {
      const { data: orders } = await supabase.from('orders').select('status, total_price, created_at').order('created_at', { ascending: false }).limit(5000);
      const [users, clients, vendeurs, shops, openDisputes, pendingIds] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('type', 'client'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('type', 'vendeur'),
        supabase.from('shops').select('id', { count: 'exact', head: true }),
        supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('statut_verification', 'en_verification'),
      ]);
      // Boutiques tenues par un compte qui n'est pas de type « vendeur » (explique l'écart entre vendeurs et boutiques)
      const { data: shopRows } = await supabase.from('shops').select('vendor_id').limit(2000);
      const shopOwners = Array.from(new Set((shopRows || []).map((r: any) => r.vendor_id).filter(Boolean)));
      let ownersNotVendor = 0;
      if (shopOwners.length) {
        const { data: ps } = await supabase.from('profiles').select('id, type').in('id', shopOwners);
        ownersNotVendor = (ps || []).filter((p: any) => p.type !== 'vendeur').length;
      }
      const o = summarizeOrders(orders || []);
      res.json({ orders: o, users: users.count ?? 0, shops_by_non_vendor: ownersNotVendor, clients: clients.count ?? 0, vendors: vendeurs.count ?? 0, shops: shops.count ?? 0,
        open_disputes: openDisputes.count ?? 0, pending_identities: pendingIds.count ?? 0, truncated: (orders || []).length >= 5000 });
    } catch { fail(res); }
  });

  // Litiges : lecture seule (la décision sur les fonds en séquestre reste une action volontaire hors de cette page).
  app.get(`${base}/disputes`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    const status = ['open', 'resolved'].includes(String(req.query.status)) ? String(req.query.status) : 'open';
    try {
      const { data, error } = await supabase.from('disputes').select('id, order_id, buyer_id, vendor_id, reason, status, resolution_note, resolved_at, created_at')
        .eq('status', status).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const ids = (data || []).map((d: any) => d.order_id).filter(Boolean);
      const orders: Record<string, any> = {};
      if (ids.length) {
        const { data: os } = await supabase.from('orders').select('id, total_price, payment_method, product_name, vendor_name, client_name, status').in('id', ids);
        (os || []).forEach((o: any) => { orders[o.id] = o; });
      }
      res.json({ disputes: (data || []).map((d: any) => ({ ...d, order: orders[d.order_id] || null })) });
    } catch { fail(res); }
  });

  // Vérification des boutiques : pièces d'identité en attente
  app.get(`${base}/identities`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    try {
      const { data: shops, error } = await supabase.from('shops').select('vendor_id, shop_name, statut_verification, plan, created_at')
        .eq('statut_verification', 'en_verification').order('created_at', { ascending: true }).limit(100);
      if (error) throw error;
      const ids = (shops || []).map((s: any) => s.vendor_id).filter(Boolean);
      const priv: Record<string, any> = {};
      if (ids.length) {
        const { data: ps } = await supabase.from('vendor_private').select('user_id, id_type, id_number, id_document_url').in('user_id', ids);
        (ps || []).forEach((p: any) => { priv[p.user_id] = p; });
      }
      res.json({ identities: (shops || []).map((s: any) => ({
        vendor_id: s.vendor_id, shop_name: s.shop_name, plan: s.plan, created_at: s.created_at,
        id_type: priv[s.vendor_id]?.id_type || '', id_number: maskIdNumber(priv[s.vendor_id]?.id_number), has_document: !!priv[s.vendor_id]?.id_document_url,
      })) });
    } catch { fail(res); }
  });

  // La pièce n'est jamais exposée durablement : lien temporaire de 60 secondes, et chaque ouverture est journalisée.
  app.post(`${base}/identities/:vendorId/document-link`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    const vendorId = String(req.params.vendorId);
    if (!isUuid(vendorId)) return res.status(400).json({ error: 'Identifiant invalide.' });
    try {
      const { data } = await supabase.from('vendor_private').select('id_document_url').eq('user_id', vendorId).maybeSingle();
      const doc = String(data?.id_document_url || '');
      if (!doc) return res.status(404).json({ error: 'Aucune pièce enregistrée.' });
      if (/^https?:\/\//i.test(doc)) return res.status(409).json({ error: 'Pièce enregistrée dans l’ancien format public. Demandez au vendeur de la renvoyer.' });
      const { data: signed, error } = await supabase.storage.from('identity').createSignedUrl(doc.replace(/^identity\//, ''), 60);
      if (error || !signed?.signedUrl) return res.status(404).json({ error: 'Pièce introuvable.' });
      await audit({ user_id: user.id, email: user.email || null, action: 'identite_ouverte', method: 'POST', path: `${base}/identities/${vendorId}/document-link`, status: 200, ip: clientIp(req), detail: vendorId });
      res.json({ url: signed.signedUrl, expires_in: 60 });
    } catch { fail(res, 'Impossible d’ouvrir la pièce.'); }
  });

  app.post(`${base}/identities/:vendorId/decision`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    const vendorId = String(req.params.vendorId);
    if (!isUuid(vendorId)) return res.status(400).json({ error: 'Identifiant invalide.' });
    const v = validateVerification(req.body);
    if (v.ok === false) return res.status(400).json({ error: v.error });
    try {
      // Seule une boutique encore « en_verification » peut être tranchée
      const { data, error } = await supabase.from('shops').update({ statut_verification: v.decision, updated_at: new Date().toISOString() })
        .eq('vendor_id', vendorId).eq('statut_verification', 'en_verification').select('vendor_id');
      if (error) throw error;
      if (!data || !data.length) return res.status(409).json({ error: 'Cette demande a déjà été traitée.' });
      await supabase.from('profiles').update({ statut_verification: v.decision, updated_at: new Date().toISOString() }).eq('id', vendorId);
      await audit({ user_id: user.id, email: user.email || null, action: `verification_${v.decision}`, method: 'POST', path: `${base}/identities/${vendorId}/decision`, status: 200, ip: clientIp(req), detail: v.note || vendorId });
      res.json({ ok: true, status: v.decision });
    } catch { fail(res, 'Décision impossible pour le moment.'); }
  });

  // Promotions : prix barrés déclarés, validés, refusés ou en transition
  app.get(`${base}/promos`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    try {
      const { data, error } = await supabase.from('products').select('id, name, price, old_price, old_price_declared, promo_status, promo_expires_at, vendor_id')
        .or('old_price.not.is.null,old_price_declared.not.is.null').limit(500);
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({ ...r, ...promoFlags(r) })).sort((a: any, b: any) => (b.flags.length - a.flags.length) || (b.discount - a.discount));
      res.json({ promos: rows.slice(0, 200) });
    } catch { res.json({ promos: [], unavailable: true }); }
  });

  app.post(`${base}/promos/:id/remove`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    const id = String(req.params.id);
    if (!isUuid(id)) return res.status(400).json({ error: 'Identifiant invalide.' });
    try {
      const { error } = await supabase.from('products').update({ old_price: null }).eq('id', id);
      if (error) throw error;
      await audit({ user_id: user.id, email: user.email || null, action: 'promo_retiree', method: 'POST', path: `${base}/promos/${id}/remove`, status: 200, ip: clientIp(req), detail: id });
      res.json({ ok: true });
    } catch { fail(res, 'Retrait impossible pour le moment.'); }
  });

  app.get(`${base}/audit`, async (req, res) => {
    const user = await guard(req, res); if (!user) return;
    try {
      const { data, error } = await supabase.from('admin_audit_log').select('id, created_at, email, action, method, path, status, ip, detail').order('created_at', { ascending: false }).limit(150);
      if (error) throw error;
      res.json({ log: data || [] });
    } catch { res.json({ log: [], unavailable: true }); }
  });
}
