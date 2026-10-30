// Routes Sellerex : fournisseurs POD (connexion par clé API chiffrée) et inscription grossiste.
// Même origine uniquement (aucun en-tête CORS). Tout est derrière SELLEREX_ENABLED, sauf /config.
import crypto from 'node:crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import {
  sellerexEnabled, isSellerexHostname, validateWholesalerApplication, validateApiKeyFormat, buildSellerexCsp,
  loadEncryptionKey, encryptSecret, secretHint, createRateLimiter, isAdminEmail, validateReview,
} from './sellerexCore';
import { getPodAdapter } from './pod/registry';
import { PodNotImplementedError } from './pod/types';

type AuthedUser = { id: string; email?: string };
type Deps = { supabase: any; getAuthedUser: (req: Request) => Promise<AuthedUser | null> };

const applyLimited = createRateLimiter(5, 60 * 60 * 1000);       // 5 inscriptions grossiste / heure / utilisateur
const connectLimited = createRateLimiter(10, 10 * 60 * 1000);    // 10 tentatives de connexion fournisseur / 10 min / utilisateur

// En-têtes de sécurité du sous-domaine Sellerex (à brancher tôt, avant les routes et les fichiers statiques).
// CSP complète volontairement non incluse ici : à tester contre Supabase, OneSignal et les polices avant de l'activer.
export function sellerexHostMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isSellerexHostname(req.hostname)) return next();
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    // CSP stricte (production seulement : le serveur de développement Vite a besoin de scripts en ligne).
    // Le nonce change à chaque réponse ; il est repris par sellerexHtml() pour les scripts de la page.
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;
    res.setHeader('Content-Security-Policy', buildSellerexCsp({ supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', nonce }));
  } else {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  }
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.path === '/robots.txt') {
    return res.status(200).type('text/plain; charset=utf-8').send('User-agent: *\nDisallow: /\n');
  }
  next();
}

export function registerSellerexRoutes(app: Express, { supabase, getAuthedUser }: Deps) {
  const base = '/api/sellerex';

  // Lu par le front pour savoir s'il affiche l'écran ou « bientôt disponible ».
  app.get(`${base}/config`, (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ enabled: sellerexEnabled() });
  });

  // Tout le reste : 404 tant que l'indicateur est éteint.
  app.use(base, (_req, res, next) => {
    if (!sellerexEnabled()) return res.status(404).json({ error: 'Non disponible.' });
    next();
  });

  const needUser = async (req: Request, res: Response): Promise<AuthedUser | null> => {
    const user = await getAuthedUser(req);
    if (!user) res.status(401).json({ error: 'Connexion requise.' });
    return user;
  };

  // ---------- Fournisseurs POD ----------
  app.get(`${base}/providers`, async (req, res) => {
    if (!(await needUser(req, res))) return;
    const { data, error } = await supabase
      .from('pod_providers').select('id, slug, name, description, auth_type, status')
      .neq('status', 'disabled').order('name');
    if (error) return res.status(500).json({ error: 'Impossible de charger les fournisseurs.' });
    res.json({ providers: data || [] });
  });

  app.get(`${base}/connections`, async (req, res) => {
    const user = await needUser(req, res); if (!user) return;
    const { data, error } = await supabase
      .from('pod_connections').select('id, status, secret_hint, created_at, updated_at, provider:pod_providers(slug, name)')
      .eq('vendor_id', user.id);
    if (error) return res.status(500).json({ error: 'Impossible de charger vos connexions.' });
    res.json({ connections: data || [] }); // jamais secret_enc
  });

  app.post(`${base}/connections`, async (req, res) => {
    const user = await needUser(req, res); if (!user) return;
    if (connectLimited(user.id)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });

    const slug = String(req.body?.provider || '').toLowerCase();
    const apiKey = validateApiKeyFormat(req.body?.api_key);
    if (!slug) return res.status(400).json({ error: 'Fournisseur manquant.' });
    if (!apiKey) return res.status(400).json({ error: 'Clé API invalide (16 à 256 caractères, sans espace).' });

    // Accès : tous les vendeurs dont l'identité est vérifiée, quel que soit le forfait.
    const { data: profile } = await supabase.from('profiles').select('statut_verification').eq('id', user.id).maybeSingle();
    if (profile?.statut_verification !== 'verifie') {
      return res.status(403).json({ error: "Votre identité doit être vérifiée avant de connecter un fournisseur." });
    }

    const { data: provider } = await supabase.from('pod_providers').select('id, slug, auth_type, status').eq('slug', slug).maybeSingle();
    if (!provider) return res.status(404).json({ error: 'Fournisseur inconnu.' });
    if (provider.status !== 'active' || provider.auth_type !== 'api_key') {
      return res.status(409).json({ error: "Ce fournisseur n'est pas encore ouvert à la connexion." });
    }

    const adapter = getPodAdapter(provider.slug);
    if (!adapter) return res.status(501).json({ error: "L'intégration de ce fournisseur n'est pas encore disponible." });

    let key: Buffer;
    try { key = loadEncryptionKey(); }
    catch { console.error('[Sellerex] SELLEREX_ENCRYPTION_KEY manquante ou invalide.'); return res.status(503).json({ error: 'Service momentanément indisponible.' }); }

    try {
      const valid = await adapter.verifyCredentials({ apiKey });
      if (!valid) return res.status(400).json({ error: 'Clé refusée par le fournisseur.' });
    } catch (e: any) {
      if (e instanceof PodNotImplementedError) return res.status(501).json({ error: e.message });
      console.error('[Sellerex] Vérification fournisseur impossible :', e?.message); // jamais la clé dans les journaux
      return res.status(502).json({ error: 'Le fournisseur ne répond pas. Réessayez plus tard.' });
    }

    const { error } = await supabase.from('pod_connections').upsert({
      vendor_id: user.id,
      provider_id: provider.id,
      status: 'active',
      secret_enc: encryptSecret(apiKey, key),
      secret_hint: secretHint(apiKey),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'vendor_id,provider_id' });
    if (error) return res.status(500).json({ error: "Impossible d'enregistrer la connexion." });
    res.status(201).json({ ok: true, hint: secretHint(apiKey) });
  });

  app.delete(`${base}/connections/:slug`, async (req, res) => {
    const user = await needUser(req, res); if (!user) return;
    const { data: provider } = await supabase.from('pod_providers').select('id').eq('slug', String(req.params.slug).toLowerCase()).maybeSingle();
    if (!provider) return res.status(404).json({ error: 'Fournisseur inconnu.' });
    const { error } = await supabase.from('pod_connections').delete().eq('vendor_id', user.id).eq('provider_id', provider.id);
    if (error) return res.status(500).json({ error: 'Impossible de déconnecter le fournisseur.' });
    res.json({ ok: true });
  });

  // ---------- Administration (e-mails de SELLEREX_ADMIN_EMAILS uniquement) ----------
  const needAdmin = async (req: Request, res: Response): Promise<AuthedUser | null> => {
    const user = await needUser(req, res); if (!user) return null;
    if (!isAdminEmail(user.email)) { res.status(403).json({ error: 'Accès réservé aux administrateurs.' }); return null; }
    return user;
  };

  app.get(`${base}/me`, async (req, res) => {
    const user = await needUser(req, res); if (!user) return;
    res.json({ isAdmin: isAdminEmail(user.email) });
  });

  app.get(`${base}/admin/wholesalers`, async (req, res) => {
    if (!(await needAdmin(req, res))) return;
    const status = ['pending', 'approved', 'rejected'].includes(String(req.query.status)) ? String(req.query.status) : 'pending';
    const { data, error } = await supabase.from('wholesaler_applications')
      .select('id, user_id, business_name, contact_name, phone, whatsapp, nif, categories, description, min_order_qty, min_order_amount_htg, delivery_zones, status, review_note, created_at')
      .eq('status', status).order('created_at', { ascending: true }).limit(100);
    if (error) return res.status(500).json({ error: 'Impossible de charger les demandes.' });
    res.json({ applications: data || [] });
  });

  app.post(`${base}/admin/wholesalers/:id/review`, async (req, res) => {
    const admin = await needAdmin(req, res); if (!admin) return;
    const id = String(req.params.id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ error: 'Identifiant invalide.' });
    const v = validateReview(req.body);
    if (v.ok === false) return res.status(400).json({ error: v.errors[0] });
    // Seule une demande encore « pending » peut être tranchée (deux admins en même temps : un seul gagne).
    const { data, error } = await supabase.from('wholesaler_applications')
      .update({ status: v.value.decision, review_note: v.value.note, reviewed_by: admin.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'pending').select('id');
    if (error) return res.status(500).json({ error: "Impossible d'enregistrer la décision." });
    if (!data || data.length === 0) return res.status(409).json({ error: 'Cette demande a déjà été traitée ou n\'existe plus.' });
    res.json({ ok: true, status: v.value.decision });
  });

  // ---------- Inscription grossiste ----------
  app.get(`${base}/wholesaler/me`, async (req, res) => {
    const user = await needUser(req, res); if (!user) return;
    const { data, error } = await supabase
      .from('wholesaler_applications').select('id, business_name, status, review_note, created_at').eq('user_id', user.id).maybeSingle();
    if (error) return res.status(500).json({ error: 'Impossible de charger votre demande.' });
    res.json({ application: data || null });
  });

  app.post(`${base}/wholesaler/apply`, async (req, res) => {
    const user = await needUser(req, res); if (!user) return;
    if (applyLimited(user.id)) return res.status(429).json({ error: 'Trop de demandes. Réessayez plus tard.' });

    const v = validateWholesalerApplication(req.body);
    if (v.ok === false) return res.status(400).json({ error: 'Formulaire incomplet ou invalide.', details: v.errors });

    const { data: existing } = await supabase.from('wholesaler_applications').select('id, status').eq('user_id', user.id).maybeSingle();
    if (existing && existing.status !== 'rejected') {
      return res.status(409).json({ error: existing.status === 'approved' ? 'Vous êtes déjà grossiste.' : 'Votre demande est déjà en cours de vérification.', status: existing.status });
    }

    // user_id vient du jeton, jamais du corps de la requête ; le statut est toujours « pending » à la création.
    const row = { ...v.value, user_id: user.id, status: 'pending', review_note: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() };
    const { error } = existing
      ? await supabase.from('wholesaler_applications').update(row).eq('id', existing.id).eq('user_id', user.id)
      : await supabase.from('wholesaler_applications').insert(row);
    if (error) { console.error('[Sellerex] Inscription grossiste :', error.message); return res.status(500).json({ error: "Impossible d'enregistrer votre demande." }); }
    res.status(201).json({ ok: true, status: 'pending' });
  });
}
