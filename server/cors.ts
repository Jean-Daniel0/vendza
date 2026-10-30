// CORS : liste d'origines autorisées (jamais de joker « * »). Un appel de la même origine n'a pas besoin de CORS.
const DEFAULT_ORIGINS = ['https://www.vendza.store', 'https://vendza.store', 'https://sellerex.vendza.store'];

const originOf = (v: string): string | null => {
  try { const u = new URL(v.trim()); return u.protocol + '//' + u.host.toLowerCase(); } catch { return null; }
};

export function allowedOrigins(env: Record<string, string | undefined> = process.env): Set<string> {
  const set = new Set(DEFAULT_ORIGINS);
  for (const v of [env.BASE_URL, env.SITE_URL, ...String(env.ALLOWED_ORIGINS || '').split(',')]) {
    const o = v ? originOf(v) : null;
    if (o) set.add(o);
  }
  return set;
}

// Renvoie l'origine à renvoyer dans Access-Control-Allow-Origin, ou null (aucun en-tête CORS : le navigateur bloque).
export function corsOriginFor(origin: unknown, env: Record<string, string | undefined> = process.env): string | null {
  if (typeof origin !== 'string' || !origin) return null;
  const o = originOf(origin);
  if (!o) return null;
  if (allowedOrigins(env).has(o)) return o;
  // En développement seulement : localhost sur n'importe quel port
  if (env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost)(:\d+)?$/.test(o)) return o;
  return null;
}
