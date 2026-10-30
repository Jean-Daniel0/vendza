// Logique pure de Sellerex (sans Express ni Supabase) : indicateur, nom d'hôte, validation, chiffrement des clés, limite de débit.
import crypto from 'node:crypto';

// ---------- Indicateur de fonctionnalité ----------
// Tant que SELLEREX_ENABLED n'est pas "true", aucune route /api/sellerex (hors /config) ne répond et le front affiche « bientôt ».
export const sellerexEnabled = (env: Record<string, string | undefined> = process.env) => env.SELLEREX_ENABLED === 'true';

// ---------- Nom d'hôte ----------
export function isSellerexHostname(host?: string | null): boolean {
  const h = String(host || '').split(':')[0].trim().toLowerCase();
  return h.startsWith('sellerex.');
}

// ---------- Validation de l'inscription grossiste ----------
export type WholesalerApplication = {
  business_name: string;
  contact_name: string;
  phone: string;
  whatsapp: string | null;
  nif: string | null;
  categories: string[];
  description: string;
  min_order_qty: number;
  min_order_amount_htg: number;
  delivery_zones: string[];
};

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const str = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

// Téléphone : chiffres uniquement (8 à 15), « + » initial conservé. Haïti : 8 chiffres, ou 509 + 8 chiffres.
export function cleanPhoneNumber(v: unknown): string | null {
  const raw = typeof v === 'string' ? v.trim() : '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return (raw.startsWith('+') ? '+' : '') + digits;
}

function cleanList(v: unknown, min: number, max: number, itemMin: number, itemMax: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const s = str(item);
    if (!s) continue;
    if (s.length < itemMin || s.length > itemMax) return null;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.length >= min && out.length <= max ? out : null;
}

export function validateWholesalerApplication(body: any): Validation<WholesalerApplication> {
  const errors: string[] = [];
  const b = body && typeof body === 'object' ? body : {};

  const business_name = str(b.business_name);
  if (business_name.length < 2 || business_name.length > 120) errors.push("Nom de l'entreprise : 2 à 120 caractères.");

  const contact_name = str(b.contact_name);
  if (contact_name.length < 2 || contact_name.length > 100) errors.push('Nom du contact : 2 à 100 caractères.');

  const phone = cleanPhoneNumber(b.phone);
  if (!phone) errors.push('Téléphone invalide (8 à 15 chiffres).');

  let whatsapp: string | null = null;
  if (str(b.whatsapp)) {
    whatsapp = cleanPhoneNumber(b.whatsapp);
    if (!whatsapp) errors.push('WhatsApp invalide (8 à 15 chiffres).');
  }

  let nif: string | null = null;
  if (str(b.nif)) {
    nif = str(b.nif);
    if (nif.length > 40 || !/^[A-Za-z0-9 .\-/]+$/.test(nif)) errors.push('NIF / patente invalide (40 caractères max, lettres, chiffres, - . /).');
  }

  const categories = cleanList(b.categories, 1, 10, 2, 40);
  if (!categories) errors.push('Catégories : 1 à 10, de 2 à 40 caractères chacune.');

  const description = str(b.description);
  if (description.length < 20 || description.length > 1000) errors.push('Description : 20 à 1000 caractères.');

  const min_order_qty = Number(b.min_order_qty);
  if (!Number.isInteger(min_order_qty) || min_order_qty < 1 || min_order_qty > 100000) errors.push('Quantité minimale : entier de 1 à 100 000.');

  const min_order_amount_htg = Number(b.min_order_amount_htg ?? 0);
  if (!Number.isFinite(min_order_amount_htg) || min_order_amount_htg < 0 || min_order_amount_htg > 100_000_000) errors.push('Montant minimal : de 0 à 100 000 000 Gdes.');

  const delivery_zones = cleanList(b.delivery_zones, 1, 15, 2, 60);
  if (!delivery_zones) errors.push('Zones de livraison : 1 à 15, de 2 à 60 caractères chacune.');

  if (b.accept_terms !== true) errors.push("Vous devez accepter les conditions d'utilisation.");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      business_name, contact_name, phone: phone!, whatsapp, nif,
      categories: categories!, description, min_order_qty,
      min_order_amount_htg: Math.round(min_order_amount_htg * 100) / 100,
      delivery_zones: delivery_zones!,
    },
  };
}

// ---------- Clés API des fournisseurs : format + chiffrement (AES-256-GCM) ----------
export function validateApiKeyFormat(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const k = v.trim();
  return k.length >= 16 && k.length <= 256 && /^[\x21-\x7E]+$/.test(k) ? k : null;
}

export function loadEncryptionKey(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.SELLEREX_ENCRYPTION_KEY || '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SELLEREX_ENCRYPTION_KEY doit être une clé de 32 octets encodée en base64.');
  return key;
}

// Format : v1.<iv>.<tag>.<texte chiffré>, chaque partie en base64url. Un IV aléatoire par chiffrement.
export function encryptSecret(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [v, iv, tag, ct] = String(payload).split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Secret chiffré invalide.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

// Indice affichable : jamais la clé, seulement ses 4 derniers caractères.
export const secretHint = (secret: string) => '••••' + secret.slice(-4);

// ---------- Limite de débit en mémoire ----------
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= max) { hits.set(key, recent); return true; }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
    return false;
  };
}

// ---------- Administration : validation des demandes grossistes ----------
// Les admins sont listés dans SELLEREX_ADMIN_EMAILS (séparés par des virgules). Aucun e-mail dans le code : vide = personne n'est admin.
export function isAdminEmail(email: unknown, env: Record<string, string | undefined> = process.env): boolean {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!e) return false;
  return String(env.SELLEREX_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).includes(e);
}

export type Review = { decision: 'approved' | 'rejected'; note: string | null };

export function validateReview(body: any): Validation<Review> {
  const b = body && typeof body === 'object' ? body : {};
  if (b.decision !== 'approved' && b.decision !== 'rejected') return { ok: false, errors: ['Décision invalide (approved ou rejected).'] };
  const note = str(b.note);
  if (note.length > 500) return { ok: false, errors: ['Note : 500 caractères maximum.'] };
  if (b.decision === 'rejected' && note.length < 5) return { ok: false, errors: ['Indiquez un motif de refus (5 caractères minimum).'] };
  return { ok: true, value: { decision: b.decision, note: note || null } };
}
