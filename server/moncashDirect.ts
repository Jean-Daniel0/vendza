// MonCash « direct » (sans intermédiaire Bazik) : API REST MonCash Business de Digicel.
// Ce module ne touche ni à la base ni à Express : tout est testable avec un faux `fetch`.
//
// Variables d'environnement (Render) :
//   MONCASH_PROVIDER       'bazik' (défaut) ou 'direct'  → qui sert le bouton « MonCash »
//   MONCASH_MODE           'sandbox' (défaut) ou 'live'
//   MONCASH_CLIENT_ID / MONCASH_CLIENT_SECRET   clés générées dans le portail MonCash Business
//
// Règle de sécurité : en sandbox, le paiement direct est réservé à l'admin ; les clients restent sur Bazik.

export type MoncashProvider = 'bazik' | 'direct';
export type MoncashMode = 'sandbox' | 'live';

export interface MoncashConfig {
  provider: MoncashProvider;
  mode: MoncashMode;
  apiBase: string;      // …/Api
  gatewayBase: string;  // …/Moncash-middleware
  clientId: string;
  clientSecret: string;
  configured: boolean;
  sandboxForAll: boolean; // MONCASH_SANDBOX_FOR_ALL : en sandbox, tout le monde passe par MonCash officiel (phase de test sans vrais clients)
}

type Env = Record<string, string | undefined>;

export function moncashConfig(env: Env = process.env): MoncashConfig {
  const provider: MoncashProvider = String(env.MONCASH_PROVIDER || 'bazik').trim().toLowerCase() === 'direct' ? 'direct' : 'bazik';
  const mode: MoncashMode = String(env.MONCASH_MODE || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
  const host = mode === 'live' ? 'https://moncashbutton.digicelgroup.com' : 'https://sandbox.moncashbutton.digicelgroup.com';
  const clientId = String(env.MONCASH_CLIENT_ID || '').trim();
  const clientSecret = String(env.MONCASH_CLIENT_SECRET || '').trim();
  const sandboxForAll = /^(1|true|oui|yes)$/i.test(String(env.MONCASH_SANDBOX_FOR_ALL || '').trim());
  return { provider, mode, apiBase: `${host}/Api`, gatewayBase: `${host}/Moncash-middleware`, clientId, clientSecret, configured: !!(clientId && clientSecret), sandboxForAll };
}

/**
 * Qui passe par MonCash direct ?
 *  - provider 'bazik'  → personne ;
 *  - sandbox           → l'admin seulement (un faux paiement ne doit jamais créer une vraie commande pour un client),
 *                        sauf si MONCASH_SANDBOX_FOR_ALL est activé (phase de test sans vrais clients : tout le monde, secours Bazik inclus) ;
 *  - live              → tout le monde ;
 *  - abonnements       → toujours Bazik pour l'instant.
 */
export function shouldUseDirect(p: { provider: MoncashProvider; mode: MoncashMode; isAdmin: boolean; isSubscription: boolean; sandboxForAll?: boolean }): boolean {
  if (p.provider !== 'direct' || p.isSubscription) return false;
  return p.mode === 'live' || p.isAdmin || p.sandboxForAll === true;
}

// ---------- Références ----------
// L'orderId envoyé à MonCash = référence interne + suffixe unique (comme `_bz_` chez Bazik) : un nouvel essai ne tombe pas sur « orderId déjà utilisé ».
const MC_MARK = '_mc_';
export function makeMoncashOrderId(orderId: string, now: number = Date.now()): string {
  return `${orderId}${MC_MARK}${now.toString(36)}`;
}
/** Référence interne de la commande, ou null si la référence ne vient pas de notre paiement direct. */
export function rootOrderId(moncashReference: unknown): string | null {
  const ref = String(moncashReference ?? '');
  const i = ref.indexOf(MC_MARK);
  if (i <= 0) return null;
  return ref.slice(0, i);
}

// ---------- Client REST ----------
type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; text: () => Promise<string>; json?: () => Promise<any> }>;

export interface MoncashPayment {
  reference?: string; transaction_id?: string | number; cost?: string | number; message?: string; payer?: string;
}

export class MoncashError extends Error {
  constructor(message: string, public status?: number) { super(message); this.name = 'MoncashError'; }
}

async function readJson(res: { text: () => Promise<string> }): Promise<any> {
  const t = await res.text();
  try { return t ? JSON.parse(t) : {}; } catch { return { raw: t }; }
}

export function createMoncashClient(cfg: MoncashConfig, fetchImpl: FetchLike = fetch as any, nowFn: () => number = Date.now) {
  let cached: { token: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (!cfg.configured) throw new MoncashError('MonCash direct : MONCASH_CLIENT_ID / MONCASH_CLIENT_SECRET manquants.');
    if (cached && cached.expiresAt - nowFn() > 5000) return cached.token;
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    const res = await fetchImpl(`${cfg.apiBase}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'scope=read,write&grant_type=client_credentials',
    });
    const j = await readJson(res);
    if (!res.ok || !j.access_token) throw new MoncashError(`MonCash : jeton refusé (HTTP ${res.status}). Vérifiez les clés et le mode (${cfg.mode}).`, res.status);
    // `expires_in` est en secondes ; l'exemple de la documentation est très court : on ne garde jamais un jeton périmé.
    const ttl = Math.max(0, Number(j.expires_in) || 0) * 1000;
    cached = { token: String(j.access_token), expiresAt: nowFn() + ttl };
    return cached.token;
  }

  async function call(path: string, body: unknown): Promise<any> {
    const token = await getToken();
    const res = await fetchImpl(`${cfg.apiBase}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await readJson(res);
    if (!res.ok) {
      // 404 sur les routes de consultation = paiement introuvable, pas une panne
      if (res.status === 404) return null;
      throw new MoncashError(`MonCash ${path} : HTTP ${res.status}`, res.status);
    }
    return j;
  }

  /** Crée le paiement et renvoie l'adresse où envoyer le client. */
  async function createPayment(p: { amount: number; orderId: string }): Promise<{ redirectUrl: string }> {
    const amount = Math.round(Number(p.amount));
    if (!Number.isFinite(amount) || amount < 1) throw new MoncashError('MonCash : montant invalide.');
    const j = await call('/v1/CreatePayment', { amount, orderId: p.orderId });
    const token = j?.payment_token?.token;
    if (!token) throw new MoncashError('MonCash : aucun jeton de paiement reçu.');
    return { redirectUrl: `${cfg.gatewayBase}/Payment/Redirect?token=${encodeURIComponent(String(token))}` };
  }

  async function retrieveOrderPayment(orderId: string): Promise<MoncashPayment | null> {
    const j = await call('/v1/RetrieveOrderPayment', { orderId });
    return j?.payment && typeof j.payment === 'object' ? j.payment : null;
  }
  async function retrieveTransactionPayment(transactionId: string): Promise<MoncashPayment | null> {
    const j = await call('/v1/RetrieveTransactionPayment', { transactionId });
    return j?.payment && typeof j.payment === 'object' ? j.payment : null;
  }

  return { getToken, createPayment, retrieveOrderPayment, retrieveTransactionPayment };
}

export type MoncashClient = ReturnType<typeof createMoncashClient>;

// ---------- Confirmation ----------
/** « successful » chez MonCash. À confirmer avec un vrai paiement sandbox : tant que le message n'est pas reconnu, rien n'est validé. */
export function isPaymentSuccessful(payment: MoncashPayment | null | undefined): boolean {
  return String(payment?.message ?? '').trim().toLowerCase().startsWith('success');
}

export type Confirmation =
  | { status: 'paid'; rootOrderId: string; moncashReference: string; transactionId: string; amount: number }
  | { status: 'unpaid' }       // MonCash ne connaît pas (encore) ce paiement, ou il n'est pas réussi
  | { status: 'invalid' };     // la référence n'est pas une des nôtres

/**
 * Ne croit JAMAIS ce que l'appelant raconte : on redemande à MonCash, puis on lit la commande
 * dans la RÉPONSE de MonCash (payment.reference), pas dans la requête reçue.
 */
export async function confirmMoncashPayment(
  client: Pick<MoncashClient, 'retrieveOrderPayment' | 'retrieveTransactionPayment'>,
  input: { transactionId?: string | null; orderRef?: string | null }
): Promise<Confirmation> {
  const tx = String(input.transactionId ?? '').trim();
  const ref = String(input.orderRef ?? '').trim();
  let payment: MoncashPayment | null = null;
  if (tx) payment = await client.retrieveTransactionPayment(tx);
  else if (ref) {
    if (!rootOrderId(ref)) return { status: 'invalid' };
    payment = await client.retrieveOrderPayment(ref);
  } else return { status: 'invalid' };

  if (!payment || !isPaymentSuccessful(payment)) return { status: 'unpaid' };
  const moncashReference = String(payment.reference ?? '');
  const root = rootOrderId(moncashReference);
  if (!root) return { status: 'invalid' };
  const amount = Number(payment.cost);
  if (!Number.isFinite(amount) || amount <= 0) return { status: 'unpaid' };
  return { status: 'paid', rootOrderId: root, moncashReference, transactionId: String(payment.transaction_id ?? tx), amount };
}

/**
 * Essaie MonCash direct sans jamais lever d'exception : en cas d'échec (clés refusées, MonCash indisponible, délai dépassé),
 * l'appelant retombe sur Bazik, qui reste le moyen de paiement de secours. Le client ne voit qu'un seul bouton « MonCash ».
 */
export async function tryDirectPayment(
  client: Pick<MoncashClient, 'createPayment'>,
  p: { amount: number; orderId: string }
): Promise<{ ok: true; redirectUrl: string } | { ok: false; reason: string }> {
  try {
    const { redirectUrl } = await client.createPayment(p);
    return { ok: true, redirectUrl };
  } catch (err: any) {
    return { ok: false, reason: String(err?.message || 'erreur inconnue').slice(0, 200) };
  }
}
