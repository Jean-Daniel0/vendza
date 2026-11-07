import type { Request, Response, NextFunction } from 'express';

export type AuthedUser = { id: string; email?: string };

// ---------- Adresse secrète ----------
// L'adresse de la page admin est « /gestion-<suite aléatoire> », définie dans la variable ADMIN_SECRET_PATH (jamais dans le code).
// Sans valeur valide, la page n'est servie nulle part.
export const ADMIN_PATH_PREFIX = 'gestion-';
export function isValidAdminSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && /^gestion-[a-z0-9]{16,64}$/.test(slug);
}
/** 'match' : page admin à servir ; 'hidden' : chemin qui doit sembler inexistant ; 'other' : chemin ordinaire du site. */
export function classifyAdminPath(pathname: string, slug: string | undefined): 'match' | 'hidden' | 'other' {
  const p = String(pathname || '').toLowerCase().replace(/\/{2,}/g, '/');
  const first = p.split('/').filter(Boolean)[0] || '';
  const looksAdmin = first === 'admin' || first.startsWith(ADMIN_PATH_PREFIX);
  if (!looksAdmin) return 'other';
  if (isValidAdminSlug(slug) && first === slug.toLowerCase()) return 'match';
  return 'hidden';
}

// ---------- En-têtes ----------
export function adminHeaders(res: Response) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// ---------- Jeton / double authentification ----------
export const bearerToken = (req: Request): string => {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};
/** Lit les informations du jeton (déjà vérifié par Supabase avant d'arriver ici). */
export function jwtClaims(token: string): Record<string, any> {
  try {
    const part = String(token).split('.')[1] || '';
    return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) || {};
  } catch { return {}; }
}
/** Vrai si la session a passé la double authentification (niveau aal2). */
export const hasSecondFactor = (token: string): boolean => jwtClaims(token).aal === 'aal2';

// ---------- Adresse IP ----------
// Derrière le proxy de l'hébergeur, la dernière entrée de X-Forwarded-For est celle ajoutée par le proxy lui-même (les précédentes peuvent être falsifiées).
export function clientIp(req: Request): string {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || req.socket?.remoteAddress || 'inconnue';
}

// ---------- Limite des tentatives ratées ----------
export class FailureTracker {
  private hits = new Map<string, number[]>();
  constructor(private max = 10, private windowMs = 15 * 60 * 1000) {}
  private recent(key: string, now: number) { return (this.hits.get(key) || []).filter(t => now - t < this.windowMs); }
  isBlocked(key: string, now = Date.now()): boolean { return this.recent(key, now).length >= this.max; }
  record(key: string, now = Date.now()) {
    const r = this.recent(key, now); r.push(now); this.hits.set(key, r);
    if (this.hits.size > 5000) for (const [k] of this.hits) if (!this.recent(k, now).length) this.hits.delete(k);
  }
}

// ---------- Gardien unique pour toutes les routes admin ----------
type GuardDeps = {
  getAuthedUser: (req: Request) => Promise<AuthedUser | null>;
  makeUserClient: (token: string) => any;
  requireMfa?: () => boolean;
  tracker?: FailureTracker;
};
export type AdminGuard = (req: Request, res: Response, opts?: { skipMfa?: boolean }) => Promise<AuthedUser | null>;

export function createAdminGuard(deps: GuardDeps): AdminGuard {
  const tracker = deps.tracker || new FailureTracker();
  const requireMfa = deps.requireMfa || (() => process.env.ADMIN_REQUIRE_MFA !== 'false');
  return async (req, res, opts) => {
    adminHeaders(res);
    const ip = clientIp(req);
    if (tracker.isBlocked(ip)) { res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' }); return null; }
    const token = bearerToken(req);
    const user = token ? await deps.getAuthedUser(req) : null;
    let isAdmin = false;
    if (user) {
      try { const { data, error } = await deps.makeUserClient(token).rpc('is_admin'); isAdmin = !error && data === true; } catch { isAdmin = false; }
    }
    // Pour tout le monde sauf l'admin : la route « n'existe pas ».
    if (!user || !isAdmin) { tracker.record(ip); res.status(404).json({ error: 'Introuvable.' }); return null; }
    if (!opts?.skipMfa && requireMfa() && !hasSecondFactor(token)) {
      res.status(401).json({ error: 'Code de vérification requis.', mfa: true }); return null;
    }
    res.locals.adminId = user.id; res.locals.adminEmail = user.email || null;
    return user;
  };
}

// ---------- Journal ----------
export type AuditRow = { user_id: string | null; email: string | null; action: string; method: string; path: string; status: number | null; ip: string; detail?: string | null };
export function auditMiddleware(insert: (row: AuditRow) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    adminHeaders(res);
    res.on('finish', () => {
      if (!res.locals.adminId) return;
      const path = String(req.originalUrl || req.url || '').split('?')[0].slice(0, 200);
      insert({ user_id: res.locals.adminId, email: res.locals.adminEmail || null, action: req.method === 'GET' ? 'consultation' : 'action',
        method: req.method, path, status: res.statusCode, ip: clientIp(req) }).catch(() => {});
    });
    next();
  };
}

// ---------- Aides pures pour les écrans admin ----------
export const maskIdNumber = (v: unknown): string => {
  const s = String(v || '').replace(/\s+/g, '');
  return s.length <= 4 ? (s ? '••••' : '') : `${'•'.repeat(Math.min(s.length - 4, 8))}${s.slice(-4)}`;
};
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validateVerification(body: any): { ok: true; decision: 'verifie' | 'non_verifie'; note: string } | { ok: false; error: string } {
  const d = String(body?.decision || '');
  if (d !== 'verifie' && d !== 'non_verifie') return { ok: false, error: 'Décision invalide.' };
  return { ok: true, decision: d, note: String(body?.note || '').slice(0, 300) };
}
export function summarizeOrders(rows: Array<{ status?: string | null; total_price?: number | string | null; created_at?: string | null }>, now = Date.now()) {
  const byStatus: Record<string, number> = {};
  let sales30 = 0, count30 = 0;
  const cutoff = now - 30 * 24 * 3600 * 1000;
  for (const r of rows) {
    const s = String(r.status || 'inconnu').replace(/'/g, '');
    byStatus[s] = (byStatus[s] || 0) + 1;
    const t = r.created_at ? Date.parse(r.created_at) : NaN;
    if (['payee', 'completed', 'livree'].includes(s) && Number.isFinite(t) && t >= cutoff) { sales30 += Number(r.total_price) || 0; count30++; }
  }
  return { byStatus, sales30, count30, total: rows.length };
}

/** Signaux d'alerte sur une promotion : remise très élevée, prix barré refusé, promotion de transition. */
export function promoFlags(r: { price?: number | string | null; old_price?: number | string | null; old_price_declared?: number | string | null; promo_status?: string | null }) {
  const price = Number(r.price) || 0;
  const ref = Number(r.old_price) || Number(r.old_price_declared) || 0;
  const discount = ref > price && ref > 0 ? Math.round((1 - price / ref) * 100) : 0;
  const flags: string[] = [];
  if (r.promo_status === 'refusee') flags.push('refusee');
  if (r.promo_status === 'transition') flags.push('transition');
  if (discount >= 60) flags.push('remise_elevee');
  return { discount, flags };
}
