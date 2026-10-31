import express from 'express';
import { assertPaymentVerified, confirmDelivery, getOrCreateDeliveryCode, recordVerifiedPayment } from './server/delivery';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import crypto from 'crypto';
import { runFlashSale, runRecommendations } from './server/campaigns';
import { haitiClock } from './server/marketing';
import { runCartReminders, runLowStockAlerts } from './server/cartAlerts';
import { priceVendorOrder, promoPercent, isUnderpaid, usdCents, DbProduct } from './server/pricing';
import { normalizePlan, normalizeBilling, planPriceHtg, decideActivation, stripePaidHtg, newSubscriptionRef, isUuid, isSubscriptionRef } from './server/subscriptions';
import { resolveShippingFee } from './src/lib/shipping';
import { registerSeoRoutes, runIndexNow } from './server/seoRoutes';
import { registerSellerexRoutes, sellerexHostMiddleware } from './server/sellerexRoutes';
import { registerAdminPaymentsRoutes } from './server/adminPayments';
import { isSellerexHostname, sellerexHtml } from './server/sellerexCore';
import { corsOriginFor } from './server/cors';
import { runEscrowAutoRelease } from './server/escrowRelease';
import { productPath, cleanCategory } from './server/seo';

// Icônes des notifications push : badge monochrome (barre d'état Android) + logo couleur (à côté du texte)
const NOTIF_BADGE_URL = 'https://www.vendza.store/badge.png';
const NOTIF_ICON_URL = 'https://www.vendza.store/pwa-icon-192.png';

// Load environmental variables
dotenv.config();

function isValidUuid(id: any): boolean {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable JSON and URL-encoded body parsing middlewares (excluding Stripe & Bazik webhooks)
app.use((req, res, next) => {
  const isWebhook = req.originalUrl.includes('/api/stripe/webhook') || 
                    req.originalUrl.includes('/api/bazik/webhook') || 
                    req.path.includes('/api/stripe/webhook') || 
                    req.path.includes('/api/bazik/webhook');
  if (isWebhook) {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Sous-domaine Sellerex : en-têtes de sécurité, noindex, robots.txt fermé (sans effet sur les autres noms d'hôte)
app.use(sellerexHostMiddleware);

// Initialize Supabase Client on Server Side securely
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
// On the server, we want to favor the Service Role Key (secret) if configured to automatically bypass Row Level Security (RLS) constraints
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

// Route de santé pour la surveillance externe : 200 si le serveur et la base répondent, 503 sinon. Aucune donnée sensible.
app.get('/healthz', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!supabase) return res.status(503).json({ ok: false, db: 'non configurée' });
  try {
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), 4000));
    const { error } = await Promise.race([supabase.from('profiles').select('id', { head: true, count: 'estimated' }).limit(1), timeout]) as any;
    if (error) return res.status(503).json({ ok: false, db: 'erreur' });
    res.json({ ok: true, db: 'ok', uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ ok: false, db: 'injoignable' });
  }
});

// Seed system profile if missing to prevent foreign key errors and support messaging UI
if (isSupabaseConfigured && supabase) {
  (async () => {
    try {
      const systemId = '99999999-9999-4999-9999-999999999999';
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', systemId)
        .maybeSingle();

      if (!existing) {
        console.log("[Server Init] Seeding Vendza system profile in Supabase database...");
        const systemProfile = {
          id: systemId,
          prenom: "Vendza",
          nom: "Sécurité",
          full_name: "Vendza Sécurité",
          first_name: "Vendza",
          last_name: "Sécurité",
          email: "security@vendza.store",
          user_type: "client",
          plan: "Pro National"
        };
        const { error } = await supabase.from('profiles').insert([systemProfile]);
        if (error) {
          console.error("[Server Init] Failed to seed Vendza system profile:", error.message);
        } else {
          console.log("[Server Init] Vendza system profile seeded successfully.");
        }
      } else {
        console.log("[Server Init] Vendza system profile already exists in database.");
      }
    } catch (e: any) {
      console.warn("[Server Init] Exception during system profile seeding check:", e.message);
    }
  })();
}

// ====================================================================
// REAL-TIME MESSAGE LISTENER FOR SECURE ONESIGNAL PUSH NOTIFICATIONS
// ====================================================================
if (isSupabaseConfigured && supabase) {
  console.log("[Server Realtime Push] Initializing message database listener...");
  supabase
    .channel('server-messages-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
        try {
          const m = payload.new;
          if (!m || !m.recipient_id) return;

          console.log(`[Server Realtime Push] Detected new message in DB (ID: ${m.id}). Preparing push...`);

          // Fetch sender name from profiles
          let senderName = "Un utilisateur";
          if (m.sender_id === '99999999-9999-4999-9999-999999999999') {
            senderName = "Vendza";
          } else if (m.sender_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('prenom')
              .eq('id', m.sender_id)
              .maybeSingle();
            if (profile && profile.prenom) {
              senderName = profile.prenom;
            }
          }
          if (senderName === "Un utilisateur" && (m.sender_nom || m.senderNom)) {
            senderName = m.sender_nom || m.senderNom;
          }

          const title = `💬 Message de ${senderName}`;
          const text = m.text || "Vous avez reçu un nouveau message.";
          const apiAppId = '75a4d965-5500-4694-abfa-69b8a88c9d1d';
          const apiKey = process.env.ONESIGNAL_REST_API_KEY;

          if (!apiKey) {
            console.warn("[Server Realtime Push] ONESIGNAL_REST_API_KEY is not configured, skipping OneSignal dispatch.");
            return;
          }

          const cleanUrl = supabaseUrl ? supabaseUrl.replace(/\/$/, '') : 'https://giakjeanwekipnvyhlxm.supabase.co';
          const badgeUrl = NOTIF_BADGE_URL;

          const pushPayload = {
            app_id: apiAppId,
            contents: {
              fr: text,
              en: text
            },
            headings: {
              fr: title,
              en: title
            },
            chrome_web_badge: badgeUrl,
            chrome_web_icon: NOTIF_ICON_URL,
            target_channel: "push",
            data: {
              category: "message"
            },
            include_external_user_ids: [m.recipient_id],
            include_aliases: {
              external_id: [m.recipient_id]
            }
          };

          console.log(`[Server Realtime Push] Transmitting push request to OneSignal for recipient ${m.recipient_id}...`);
          const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Key ${apiKey}`
            },
            body: JSON.stringify(pushPayload)
          });

          const data = await response.json();
          console.log("[Server Realtime Push] OneSignal Response:", data);
        } catch (err: any) {
          console.error("[Server Realtime Push] Failed executing database-triggered push notification:", err.message);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Server Realtime Push] Real-time message channel subscription status: ${status}`);
    });
}

// Keep-alive endpoint for UptimeRobot monitoring
app.get('/ping', (_req, res) => {
  res.status(200).json({ 
    status: 'alive', 
    ts: Date.now(),
    service: 'Vendza API'
  });
});

// Endpoint public pour récupérer la configuration non-sensible (Supabase anon key, etc.)
app.get('/api/config', (req, res) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  console.log("[Server Config API] Checked keys:", {
    hasViteUrl: !!process.env.VITE_SUPABASE_URL,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasViteKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
    urlValueLength: url.length,
    keyValueLength: anonKey.length
  });
  res.json({
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
  });
});

// Bazik API Token Manager with in-memory caching and auto-renewal before expiration
let cachedBazikToken: { token: string; expiresAt: number } | null = null;

async function getBazikToken(): Promise<string> {
  const userID = process.env.BAZIK_USER_ID;
  const secretKey = process.env.BAZIK_SECRET_KEY;

  if (!userID || !secretKey) {
    throw new Error("Configuration Bazik manquante : BAZIK_USER_ID ou BAZIK_SECRET_KEY.");
  }

  const now = Date.now();
  if (cachedBazikToken && cachedBazikToken.expiresAt > now + 300000) { // 5 minutes buffer
    return cachedBazikToken.token;
  }

  console.log('[Bazik API] Fetching new access token...');
  try {
    const response = await fetch('https://api.bazik.io/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userID, secretKey })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Bazik API Error] Token retrieval failed:', response.status, errorText);
      throw new Error(`Bazik auth failed: ${response.status} ${errorText}`);
    }

    const data: any = await response.json();
    const token = data.token || data.access_token || data.accessToken;
    if (!token) {
      console.error('[Bazik API Error] No token found in response payload:', data);
      throw new Error('Aucun token d\'accès reçu de Bazik');
    }

    const expiresIn = Number(data.expires_in || data.expiresIn) || 3600;
    const expiresAt = now + (expiresIn * 1000);

    cachedBazikToken = {
      token,
      expiresAt
    };

    console.log('[Bazik API] Token successfully obtained and cached.');
    return token;
  } catch (err: any) {
    console.error('[Bazik API Exception] Failed to get token:', err.message);
    throw err;
  }
}

// Bazik Webhook Signature verification helper
// SÉCURITÉ : en production, un webhook sans secret configuré est REFUSÉ (fail closed).
// Pour un contournement temporaire et explicite : ALLOW_UNSIGNED_WEBHOOKS=true (déconseillé).
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || !!process.env.RENDER;
}
function allowUnsignedWebhooks(): boolean {
  return process.env.ALLOW_UNSIGNED_WEBHOOKS === 'true';
}

// Authentifie l'appelant via le jeton Supabase (Authorization: Bearer <access_token>)
async function getAuthedUser(req: express.Request): Promise<{ id: string; email?: string } | null> {
  try {
    if (!supabase) return null;
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email || undefined };
  } catch {
    return null;
  }
}

// Libère le verrou anti double-virement si l'appel Bazik échoue (permet de réessayer)
async function releasePayoutLock(reference: string | null) {
  try {
    if (!reference || !supabase) return;
    await supabase.from('payouts').delete().eq('reference', reference).eq('status', 'pending');
  } catch (e: any) {
    console.warn('[Payout Lock] release failed:', e?.message);
  }
}

function verifyBazikSignature(rawBody: string, signature: string, timestamp: string, eventId: string): boolean {
  const webhookSecret = process.env.BAZIK_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    if (isProduction() && !allowUnsignedWebhooks()) {
      console.error('[Bazik Webhook] BAZIK_WEBHOOK_SECRET is not configured in production. Rejecting unsigned webhook (set BAZIK_WEBHOOK_SECRET; ALLOW_UNSIGNED_WEBHOOKS=true bypasses temporarily).');
      return false;
    }
    console.warn('[Bazik Webhook Warning] BAZIK_WEBHOOK_SECRET is not configured. Trusting incoming webhook (non-production or explicitly allowed).');
    return true;
  }
  const signPayload = `${timestamp}.${eventId}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const expectedSig = hmac.update(signPayload).digest('hex');
  const expectedSigHeader = `v1=${expectedSig}`;
  const a = Buffer.from(String(signature || ''));
  const b = Buffer.from(expectedSigHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Helper to dynamically get the correct base URL
const getBaseUrl = (req: express.Request) => {
  if (process.env.BASE_URL && process.env.BASE_URL.startsWith('http')) {
    return process.env.BASE_URL;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  
  // Force HTTPS if not running on localhost to prevent issues with strict HTTPS gates like MonCash
  const secureProtocol = (String(host).includes('localhost') || String(host).includes('127.0.0.1')) ? protocol : 'https';
  return `${secureProtocol}://${host}`;
};

// ============================================
// AUTOMATED EXCHANGE RATE SYNCHRONIZER
// ============================================

const updateTaux = async () => {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('[Exchange Rates] Supabase not configured on server. Skipping exchange rate update.');
    return;
  }

  try {
    console.log('[Exchange Rates] Checking and updating exchange rate...');
    // Retrieve current rate record from Supabase table exchange_rates
    const { data: current, error: selectError } = await supabase
      .from('exchange_rates')
      .select('id, usd_to_htg, updated_at')
      .maybeSingle();

    if (selectError) {
      console.warn('[Exchange Rates] Error fetching current exchange rate from DB:', selectError.message);
    }

    const now = new Date();
    let shouldUpdate = !current;
    if (current && current.updated_at) {
      const lastUpdate = new Date(current.updated_at);
      const diffHeures = (now.getTime() - lastUpdate.getTime()) / 1000 / 3600;
      if (diffHeures >= 24) {
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      let nouveauTaux = 130; // default backup rate
      let fetchedSuccessfully = false;

      // 1. Try ExchangeRate API with API key from environment variable if present
      if (process.env.EXCHANGE_RATE_API_KEY) {
        try {
          console.log('[Exchange Rates] Fetching rate using EXCHANGE_RATE_API_KEY...');
          const response = await fetch(
            `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`
          );
          const data: any = await response.json();
          if (data && data.conversion_rates && data.conversion_rates.HTG) {
            nouveauTaux = Number(data.conversion_rates.HTG);
            fetchedSuccessfully = true;
          }
        } catch (apiError: any) {
          console.warn('[Exchange Rates] V6 API key call failed:', apiError.message);
        }
      }

      // 2. Fallback to free API (no key required) if first didn't succeed
      if (!fetchedSuccessfully) {
        try {
          console.log('[Exchange Rates] Fetching rate using free exchangerate-api... (no key required)');
          const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
          const data: any = await response.json();
          if (data && data.rates && data.rates.HTG) {
            nouveauTaux = Number(data.rates.HTG);
            fetchedSuccessfully = true;
          }
        } catch (apiError: any) {
          console.warn('[Exchange Rates] Free API call failed:', apiError.message);
        }
      }

      if (fetchedSuccessfully) {
        if (current) {
          // Update existing
          const { error: updateError } = await supabase
            .from('exchange_rates')
            .update({
              usd_to_htg: nouveauTaux,
              updated_at: now.toISOString()
            })
            .eq('id', current.id);
          
          if (updateError) {
            console.error('[Exchange Rates] Error updating exchange rate row:', updateError.message);
          } else {
            console.log('[Exchange Rates] Exchange rate updated in Supabase successfully:', nouveauTaux);
          }
        } else {
          // Insert a new row
          const { error: insertError } = await supabase
            .from('exchange_rates')
            .insert([{
              usd_to_htg: nouveauTaux,
              updated_at: now.toISOString()
            }]);
          
          if (insertError) {
            console.error('[Exchange Rates] Error inserting exchange rate row:', insertError.message);
          } else {
            console.log('[Exchange Rates] Exchange rate inserted in Supabase successfully:', nouveauTaux);
          }
        }
      } else {
        console.warn('[Exchange Rates] Unable to fetch exchange rates from external APIs. Keeping existing / backup rate of 130.');
      }
    } else if (current) {
      console.log('[Exchange Rates] Supabase rate is fresh (less than 24 hours old):', current.usd_to_htg);
    }
  } catch (err: any) {
    console.error('[Exchange Rates] Unexpected error in updateTaux:', err.message);
  }
};

// Initial run and interval only in non-Netlify environments (e.g. local dev)
if (process.env.NETLIFY !== 'true') {
  updateTaux();
  setInterval(updateTaux, 60 * 60 * 1000);
}

// Initial products fallback list in case Supabase is not connected or empty
const FALLBACK_PRODUCTS: any[] = [];

// ============================================
// STRIPE & MONCASH COMMON ORDER CREATION FUNCTION
// ============================================

// --- VENDOR SUBSCRIPTION HELPERS ---

const getPendingOrderSubscriptionInfo = async (referenceId: string) => {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data: pending } = await supabase
      .from('pending_orders')
      .select('*')
      .eq('reference_id', referenceId)
      .maybeSingle();

    if (!pending) return null;

    if (pending.metadata && pending.metadata.type === 'subscription') {
      return pending.metadata;
    }

    if (Array.isArray(pending.items)) {
      const firstItem = pending.items[0];
      if (firstItem && firstItem.subscriptionMeta) {
        return firstItem.subscriptionMeta;
      }
    }
    
    if (pending.delivery_address && pending.delivery_address.startsWith('SUB_META:')) {
      try {
        return JSON.parse(pending.delivery_address.substring(9));
      } catch (e) {}
    }
  } catch (err: any) {
    console.error('[Subscription Meta Check Error]', err.message);
  }
  return null;
};

const setPendingSubscriptionMeta = async (referenceId: string, amount: number, metadata: any) => {
  if (!isSupabaseConfigured || !supabase) return;
  
  const payloadsToTry = [
    {
      reference_id: referenceId,
      buyer_id: metadata.userId,
      vendor_id: metadata.userId,
      total_price: Number(amount),
      metadata: metadata,
      created_at: new Date().toISOString()
    },
    {
      reference_id: referenceId,
      buyer_id: metadata.userId,
      vendor_id: metadata.userId,
      total_price: Number(amount),
      items: [{ name: `Abonnement ${metadata.planCode}`, price: amount, quantity: 1, subscriptionMeta: metadata }],
      created_at: new Date().toISOString()
    },
    {
      reference_id: referenceId,
      buyer_id: metadata.userId,
      vendor_id: metadata.userId,
      total_price: Number(amount),
      delivery_address: 'SUB_META:' + JSON.stringify(metadata),
      created_at: new Date().toISOString()
    }
  ];

  try {
    await supabase.from('pending_orders').delete().eq('reference_id', referenceId);
  } catch (err) {}

  for (const payload of payloadsToTry) {
    try {
      const { error } = await supabase.from('pending_orders').insert([payload]);
      if (!error) {
        console.log(`[Subscription DB Success] Stored pending metadata successfully for subscription reference: ${referenceId}`);
        return;
      }
      console.warn(`[Subscription DB Warn] Tried payload failed:`, error.message, `trying next level.`);
    } catch (e: any) {
      console.warn(`[Subscription DB Exception] Exception trying payload:`, e.message);
    }
  }
};

const activerAbonnement = async (
  userId: string, 
  planCode: string, 
  billing: string, 
  paymentMethod: string, 
  montant: number,
  paymentReference?: string
) => {
  if (!isSupabaseConfigured || !supabase) {
    console.error('[Abonnement] Database not configured for activation.');
    return;
  }
  const maintenant = new Date();
  
  const expiresAt = new Date(maintenant);
  if (billing === 'annuel') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  const planCodeLower = String(planCode).toLowerCase(); // 'gratuit', 'pro_local', 'pro_national'

  try {
    // 1. Désactiver l'ancien abonnement
    await supabase
      .from('vendor_subscriptions')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'active');
  } catch (err: any) {
    console.error('Error cancelling old subscription:', err.message);
  }

  try {
    // 2. Créer le nouvel abonnement
    const { error: subInsErr } = await supabase
      .from('vendor_subscriptions')
      .insert({
        user_id:        userId,
        plan_code:      planCodeLower,
        status:         'active',
        billing:        billing,
        payment_method: paymentMethod,
        total_paid:     Number(montant) || 0,
        payment_reference: paymentReference || null,
        started_at:     maintenant.toISOString(),
        expires_at:     expiresAt.toISOString(),
        created_at:     maintenant.toISOString(),
        updated_at:     maintenant.toISOString()
      });
    if (subInsErr) console.error('[Abonnement] Insertion vendor_subscriptions refusée :', subInsErr.message);
  } catch (err: any) {
    console.error('Error inserting new subscription:', err.message);
  }

  try {
    // 3. Mettre à jour profiles
    await supabase
      .from('profiles')
      .update({
        plan:             planCodeLower,
        plan_expires_at:  expiresAt.toISOString(),
        updated_at:       new Date().toISOString()
      })
      .eq('id', userId);
  } catch (err: any) {
    console.error('Error updating profiles state:', err.message);
  }

  try {
    // 4. Mettre à jour shops (boost_score)
    const boostScores: Record<string, number> = {
      'gratuit':      0,
      'pro_local':    50,
      'pro_national': 100
    };

    await supabase
      .from('shops')
      .update({
        plan:        planCodeLower,
        boost_score: boostScores[planCodeLower] !== undefined ? boostScores[planCodeLower] : 0,
        is_featured: planCodeLower === 'pro_national',
        updated_at:  new Date().toISOString()
      })
      .eq('vendor_id', userId);
  } catch (err: any) {
    console.error('Error updating shops boost score:', err.message);
  }

  try {
    // 5. Notifier le vendeur
    await supabase
      .from('platform_messages')
      .insert({
        title:     `✅ Abonnement ${planCodeLower === 'pro_national' ? 'Pro National ⭐' : 'Pro Local'} activé !`,
        message:   `Votre abonnement ${planCodeLower} est actif jusqu'au ${expiresAt.toLocaleDateString('fr-FR')}. Profitez de votre commission de ${planCodeLower === 'pro_national' ? '10%' : planCodeLower === 'pro_local' ? '15%' : '20%'}.`,
        audience:  userId,
        is_active: true
      });
  } catch (err: any) {
    console.error('Error inserting platform messages check:', err.message);
  }

  console.log('Abonnement activé avec succès:', planCodeLower, 'pour', userId);
};


// Taux courant USD -> HTG (même source que la création de session Stripe)
const getUsdRate = async (): Promise<number> => {
  let rate = 130;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('exchange_rates').select('usd_to_htg').maybeSingle();
      if (data && Number(data.usd_to_htg) > 0) rate = Number(data.usd_to_htg);
    } catch (_) {}
  }
  return rate;
};

// Active un abonnement APRÈS un paiement confirmé : le montant payé doit couvrir le prix du forfait,
// l'utilisateur doit être un vrai identifiant, et un même paiement n'active qu'une seule fois.
const activateSubscriptionFromPayment = async (a: {
  userId: unknown; planCode: unknown; billing: unknown; method: 'moncash' | 'stripe';
  paidHtg: number; tolerancePct: number; reference: string;
}): Promise<{ activated: boolean; reason?: string }> => {
  if (!isSupabaseConfigured || !supabase) return { activated: false, reason: 'db_unavailable' };
  const userId = String(a.userId || '');

  const setAside = async (reason: string, status: string, expected?: number) => {
    console.error(`[SÉCURITÉ] Abonnement NON activé (${reason}) : réf ${a.reference}, payé ${a.paidHtg} HTG, forfait ${String(a.planCode)}/${String(a.billing)}, utilisateur ${userId || '?'}`);
    const row = { id: `orph-sub-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, order_id: a.reference, buyer_id: isUuid(userId) ? userId : null,
      amount: Number(a.paidHtg) || 0, payment_method: a.method, transaction_id: a.reference, status,
      payload_details: JSON.stringify({ subscription: true, reason, plan: a.planCode, billing: a.billing, expected: expected ?? null, paid: a.paidHtg }),
      created_at: new Date().toISOString() };
    try { await supabase!.from('orphaned_payments').insert([row]); } catch (_) { saveOrphanedPayment(row); }
    return { activated: false, reason };
  };

  // Ce paiement a-t-il déjà activé l'abonnement (webhook + vérification de session) ?
  let alreadyProcessed = false;
  try {
    const { data: already } = await supabase.from('vendor_subscriptions').select('id').eq('payment_reference', a.reference).limit(1);
    alreadyProcessed = !!(already && already.length);
  } catch (_) {}

  const decision = decideActivation({ userId, planCode: a.planCode, billing: a.billing, paidHtg: a.paidHtg, tolerancePct: a.tolerancePct, alreadyProcessed });
  if (decision.action === 'set_aside') return setAside(decision.reason, decision.status, decision.expected);
  if (decision.action === 'skip_duplicate') { console.log(`[Abonnement] Paiement ${a.reference} déjà traité, ignoré.`); return { activated: true, reason: 'already_active' }; }

  await activerAbonnement(userId, decision.plan, decision.billing, a.method, a.paidHtg, a.reference);
  return { activated: true };
};

const verifierExpirationsAbonnements = async () => {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    console.log('[Subscription Checker] Running automated subscriptions expiration scan...');
    const nowIso = new Date().toISOString();
    const { data: expires, error } = await supabase
      .from('vendor_subscriptions')
      .select('user_id, plan_code')
      .eq('status', 'active')
      .lt('expires_at', nowIso);

    if (error) {
       console.error('[Subscription Checker] Could not fetch expired subscriptions:', error.message);
       return;
    }

    for (const sub of expires || []) {
      console.log(`[Subscription Checker] Plan expired for seller: ${sub.user_id}. Downgrading to package gratuit...`);
      await supabase
        .from('vendor_subscriptions')
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', sub.user_id)
        .eq('status', 'active');

      await activerAbonnement(
        sub.user_id,
        'gratuit',
        'mensuel',
        'system',
        0
      );
    }
  } catch (err: any) {
    console.error('[Subscription Checker] Exception in verifierExpirationsAbonnements:', err.message);
  }
};

// Start daily check and run on startup only in non-Netlify environments (e.g. local dev)
if (process.env.NETLIFY !== 'true') {
  setInterval(verifierExpirationsAbonnements, 24 * 60 * 60 * 1000);
  setTimeout(verifierExpirationsAbonnements, 5000); // 5 sec after booting
}

// Send push notifications direct from server using OneSignal REST API key
const sendPushNotificationBackend = async (recipientId: string, title: string, message: string, category: 'order' | 'message' | 'promo' = 'order') => {
  try {
    const apiAppId = '75a4d965-5500-4694-abfa-69b8a88c9d1d';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!apiKey) {
      console.error("[OneSignal Backend Helper Error] API key ONESIGNAL_REST_API_KEY is not configured.");
      return;
    }

    const cleanUrl = supabaseUrl ? supabaseUrl.replace(/\/$/, '') : 'https://giakjeanwekipnvyhlxm.supabase.co';
    const badgeUrl = NOTIF_BADGE_URL;

    const payload = {
      app_id: apiAppId,
      contents: {
        fr: message,
        en: message
      },
      headings: {
        fr: title,
        en: title
      },
      chrome_web_badge: badgeUrl,
            chrome_web_icon: NOTIF_ICON_URL,
      target_channel: "push",
      data: {
        category: category
      },
      include_aliases: {
        external_id: [recipientId]
      }
    };

    console.log("[OneSignal Backend Helper] Transmitting notification:", JSON.stringify(payload));
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("[OneSignal Backend Helper] Response:", data);
  } catch (err: any) {
    console.error("[OneOneSignal Backend Helper] Failed sending notification:", err.message);
  }
};

const LOCAL_PENDING_PATH = path.join(process.cwd(), 'local_pending_orders.json');
const ORPHANED_PATH = path.join(process.cwd(), 'orphaned_payments.json');

// Helper to save to local cache
function saveLocalPendingOrder(order: any) {
  try {
    let list: any[] = [];
    if (fs.existsSync(LOCAL_PENDING_PATH)) {
      const content = fs.readFileSync(LOCAL_PENDING_PATH, 'utf8');
      list = JSON.parse(content || '[]');
    }
    list = list.filter((item: any) => item.reference_id !== order.reference_id);
    list.push(order);
    fs.writeFileSync(LOCAL_PENDING_PATH, JSON.stringify(list, null, 2), 'utf8');
    console.log(`[Resilient Cache] Local pending order saved successfully: ${order.reference_id}`);
  } catch (err: any) {
    console.error('[Resilient Cache Error] Failed to save local pending order:', err.message);
  }
}

// Helper to get from local cache
function getLocalPendingOrder(referenceId: string) {
  try {
    if (!fs.existsSync(LOCAL_PENDING_PATH)) return null;
    const content = fs.readFileSync(LOCAL_PENDING_PATH, 'utf8');
    const list = JSON.parse(content || '[]');
    return list.find((item: any) => item.reference_id === referenceId) || null;
  } catch (err: any) {
    console.error('[Resilient Cache Error] Failed to load local pending order:', err.message);
    return null;
  }
}

// Helper to remove from local cache
function deleteLocalPendingOrder(referenceId: string) {
  try {
    if (!fs.existsSync(LOCAL_PENDING_PATH)) return;
    const content = fs.readFileSync(LOCAL_PENDING_PATH, 'utf8');
    let list = JSON.parse(content || '[]');
    list = list.filter((item: any) => item.reference_id !== referenceId);
    fs.writeFileSync(LOCAL_PENDING_PATH, JSON.stringify(list, null, 2), 'utf8');
  } catch (err: any) {
    console.error('[Resilient Cache Error] Failed to delete local pending order:', err.message);
  }
}

// Helper to load all pending orders in a checkout group or starting with referenceId
function getLocalPendingOrdersByGroup(orderId: string) {
  try {
    if (!fs.existsSync(LOCAL_PENDING_PATH)) return [];
    const content = fs.readFileSync(LOCAL_PENDING_PATH, 'utf8');
    const list = JSON.parse(content || '[]');
    return list.filter((item: any) => 
      item.checkout_group_id === orderId || 
      item.reference_id === orderId || 
      item.reference_id === `${orderId}_sub_${item.vendor_id}` ||
      (typeof item.reference_id === 'string' && item.reference_id.startsWith(`${orderId}_sub_`))
    );
  } catch (err: any) {
    console.error('[Resilient Cache Error] Failed to load local pending orders by group:', err.message);
    return [];
  }
}

// Commandes en attente d'un même paiement (une par vendeur) : c'est CE total, calculé par le serveur, qui est débité
async function getGroupPendingOrders(orderId: string): Promise<any[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from('pending_orders').select('*')
        .or(`reference_id.eq.${orderId},checkout_group_id.eq.${orderId},reference_id.like.${orderId}_sub_%`);
      if (data && data.length) return data;
    } catch (_) {}
  }
  return getLocalPendingOrdersByGroup(orderId);
}

// Helper to save orphaned payment
function saveOrphanedPayment(payment: any) {
  try {
    let list: any[] = [];
    if (fs.existsSync(ORPHANED_PATH)) {
      const content = fs.readFileSync(ORPHANED_PATH, 'utf8');
      list = JSON.parse(content || '[]');
    }
    list.push({ ...payment, timestamp: new Date().toISOString() });
    fs.writeFileSync(ORPHANED_PATH, JSON.stringify(list, null, 2), 'utf8');
    console.warn(`[CRITICAL - ORPHANED PAYMENT SECURED LOCALLY] Written to orphaned_payments.json:`, payment.id || payment.reference_id);
  } catch (err: any) {
    console.error('[CRITICAL ERROR] Failed to write orphaned payment to disk:', err.message);
  }
}

// Shared order creation function for Stripe and MonCash webhooks
const creerCommandeApresPaiement = async (
  orderId: string, 
  paymentMethod: string,
  transactionId?: string | null,
  paidAmount?: number | null
) => {
  if (!isSupabaseConfigured || !supabase) {
    console.error('[Webhook] Database is not configured.');
    return null;
  }

  // Paiement confirmé par le fournisseur (webhook signé / session Stripe lue chez Stripe) : on l'enregistre.
  // Seul ce registre (écrit par le serveur) autorise ensuite un virement au vendeur.
  await recordVerifiedPayment(supabase, { reference: orderId, method: paymentMethod, transactionId, amount: paidAmount });

  // Idempotence : si une commande existe déjà pour ce paiement (webhook rejoué, ou commande créée par le navigateur en repli
  // quand le webhook tardait), on ne crée PAS de doublon. Le paiement vient d'être marqué « vérifié » ci-dessus.
  try {
    const { data: already } = await supabase
      .from('orders')
      .select('id')
      .or(`qr_token.eq.${orderId},qr_token.like.${orderId}_sub_%,payment_reference.eq.${orderId}`)
      .limit(1);
    if (already && already.length > 0) {
      console.log(`[Webhook] An order already exists for payment ${orderId}; skipping duplicate creation.`);
      try { await supabase.from('pending_orders').delete().eq('reference_id', orderId); } catch (_) {}
      return null;
    }
  } catch (e: any) {
    console.warn('[Webhook] duplicate-order check failed (continuing):', e?.message);
  }

  try {
    console.log(`[Webhook] Processing creerCommandeApresPaiement for reference ID: ${orderId} (${paymentMethod})`);

    // 1. Récupérer les données depuis Supabase stockées temporairement avant le paiement
    let pendingOrders: any[] = [];
    try {
      const { data, error: pendingErr } = await supabase
        .from('pending_orders')
        .select('*')
        .or(`reference_id.eq.${orderId},checkout_group_id.eq.${orderId},reference_id.like.${orderId}_sub_%`);
      
      if (!pendingErr && data && data.length > 0) {
        pendingOrders = data;
        console.log('[Webhook] Pending orders found in Supabase:', pendingOrders);
      } else if (pendingErr) {
        console.warn('[Webhook] Info: Error retrieving pending orders from database:', pendingErr.message);
      }
    } catch (dbErr: any) {
      console.warn('[Webhook] Info: Exception retrieving pending orders from database:', dbErr.message);
    }

    // fallback 1.2: Check local cache system
    if (pendingOrders.length === 0) {
      console.log(`[Webhook Fallback] Fetching pending orders from local backup cache for ref: ${orderId}`);
      const localPendings = getLocalPendingOrdersByGroup(orderId);
      if (localPendings && localPendings.length > 0) {
        pendingOrders = localPendings;
        console.log('[Webhook Fallback] Pending orders retrieved successfully from local backup cache:', pendingOrders);
      }
    }

    // fallback 1.3: If still missing and it is Stripe, let's recover whatever info we can from Stripe session details
    if (pendingOrders.length === 0 && paymentMethod === 'stripe' && transactionId && !transactionId.startsWith('stripe-sim-')) {
      try {
        console.log(`[Webhook Fallback] Attempting to rebuild order from active Stripe session: ${transactionId}`);
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-05-27.dahlia' as any });
          const session = await stripe.checkout.sessions.retrieve(transactionId, { expand: ['line_items'] });
          if (session) {
            // Reconstruct minimal metadata to allow safe creation
            const reconstructed = {
              reference_id: orderId,
              buyer_id: session.metadata?.userId || 'anonymous_buyer',
              vendor_id: 'reconstructed_from_session',
              items: (session.line_items?.data || []).map(li => ({
                productId: 'stripe_generic',
                nom: li.description || 'Produit Stripe',
                prix: (li.amount_total || 0) / 100,
                qte: li.quantity || 1
              })),
              total_price: (session.amount_total || 0) / 100,
              shipping_fee: 0,
              delivery_commune: 'Stripe Reconstructed',
              delivery_address: 'Stripe Reconstructed'
            };
            pendingOrders = [reconstructed];
            console.log('[Webhook Fallback] Successfully reconstructed pending order details from Stripe API:', pendingOrders);
          }
        }
      } catch (stripeRecErr: any) {
        console.error('[Webhook Fallback Error] Rebuild from Stripe failed:', stripeRecErr.message);
      }
    }

    if (pendingOrders.length === 0) {
      console.error('[Webhook Blocked] Commande pending completely untraceable for ID:', orderId);
      // Save this as an orphaned payment with what we have to prevent losing customer details
      saveOrphanedPayment({
        reference_id: orderId,
        payment_method: paymentMethod,
        transaction_id: transactionId,
        status: 'pending_untraceable'
      });
      return null;
    }

    // Garde-fou : un paiement nettement inférieur au total dû ne crée PAS de commandes payées (mis de côté pour traitement manuel)
    {
      const expectedGroupTotal = pendingOrders.reduce((sum: number, po: any) => sum + (Number(po.total_price) || 0), 0);
      if (paymentMethod !== 'stripe' && isUnderpaid(paidAmount, expectedGroupTotal, Number(process.env.UNDERPAID_BLOCK_PCT ?? 10))) {
        console.error(`[SÉCURITÉ] Paiement insuffisant pour ${orderId} : reçu ${paidAmount} HTG, dû ${expectedGroupTotal} HTG. Commandes non créées.`);
        const underpaid = { id: `orph-under-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, order_id: orderId, buyer_id: pendingOrders[0]?.buyer_id || null,
          amount: Number(paidAmount) || 0, payment_method: paymentMethod, transaction_id: transactionId || orderId, status: 'underpaid',
          payload_details: JSON.stringify({ expected: expectedGroupTotal, paid: paidAmount, pending: pendingOrders }), created_at: new Date().toISOString() };
        try { await supabase.from('orphaned_payments').insert([underpaid]); } catch (_) { saveOrphanedPayment(underpaid); }
        return null;
      }
    }

    // Now we loop over each pending order in pendingOrders to create final orders!
    let lastStoredOrder: any = null;
    const getDbDate = () => new Date().toISOString().split('T')[0];
    const getDbTime = () => {
      const d = new Date();
      return [d.getHours(), d.getMinutes(), d.getSeconds()].map(v => String(v).padStart(2, '0')).join(':');
    };
    const dateStr = getDbDate();
    const heureStr = getDbTime();

    for (const pendingOrder of pendingOrders) {
      const subRefId = pendingOrder.reference_id || orderId;
      const vendor_id = pendingOrder.vendor_id;
      const buyer_id = pendingOrder.buyer_id;

      const isValidVendor = isValidUuid(vendor_id);
      const isValidBuyer = isValidUuid(buyer_id);

      if (!isValidVendor || !isValidBuyer) {
        console.error("======================================================================");
        console.error(`[CRITICAL WEBHOOK ERROR] Invalid UUID for order creation inside webhook!`);
        console.error(`Sub-Reference ID: ${subRefId}`);
        console.error(`Buyer ID: ${buyer_id} (Valid: ${isValidBuyer})`);
        console.error(`Vendor ID: ${vendor_id} (Valid: ${isValidVendor})`);
        if (pendingOrder.items && Array.isArray(pendingOrder.items)) {
          console.error("Order items details:");
          pendingOrder.items.forEach((item: any, index: number) => {
            console.error(`  Item ${index + 1}: ID=${item.productId || item.id}, Name=${item.productNom || item.name || 'Unknown'}, VendorID=${item.vendeurId || 'N/A'}`);
          });
        } else {
          console.error(`Items data: ${JSON.stringify(pendingOrder.items)}`);
        }
        console.error("======================================================================");

        // Save complete details in orphaned_payments
        const orphanedPayload: any = {
          id: `orph-${subRefId.split('-')[1] || Date.now().toString().slice(-4)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          order_id: subRefId,
          buyer_id: isValidBuyer ? buyer_id : null,
          vendor_id: isValidVendor ? vendor_id : null,
          amount: Number(pendingOrder.total_price) || 0,
          payment_method: paymentMethod,
          transaction_id: transactionId || orderId,
          status: 'invalid_vendor_id',
          payload_details: JSON.stringify({
            pendingOrder,
            error_type: 'invalid_uuid_fields_webhook',
            invalid_buyer_id: !isValidBuyer ? buyer_id : undefined,
            invalid_vendor_id: !isValidVendor ? vendor_id : undefined,
            original_subRefId: subRefId
          }),
          created_at: new Date().toISOString()
        };

        saveOrphanedPayment(orphanedPayload);

        if (isSupabaseConfigured && supabase) {
          const payloadOrphCopy = { ...orphanedPayload };
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const { error: orphError } = await supabase
                .from('orphaned_payments')
                .insert([payloadOrphCopy]);
              if (!orphError) {
                console.log('[Webhook Orphaned Recovery] Saved UUID validation failure successfully in Supabase: orphaned_payments');
                break;
              }
              const errMsg = orphError.message || '';
              const matchCol = errMsg.match(/column "([^"]+)"/i);
              if (matchCol && matchCol[1]) {
                delete payloadOrphCopy[matchCol[1]];
              } else {
                console.error('[Webhook Orphaned Recovery Error] Failed saving UUID validation failure to DB:', orphError.message);
                break;
              }
            } catch (e: any) {
              console.error('[Webhook Orphaned Recovery Exception]', e.message);
              break;
            }
          }
        }
        continue;
      }

      console.log(`[Webhook Processing Sub-order] processing ${subRefId} for vendor ${pendingOrder.vendor_id}`);

      // 2. Générer QR code unique per sub-order
      const qrCode = `qr-${subRefId.split('-')[1] || Date.now().toString().slice(-4)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      // 3. Récupérer le plan du vendeur pour la commission
      const { data: shop, error: shopErr } = await supabase
        .from('shops')
        .select('plan')
        .eq('vendor_id', pendingOrder.vendor_id)
        .maybeSingle();

      if (shopErr) {
        console.warn('[Webhook] Error fetching shop plan, defaulting to gratuit:', shopErr.message);
      }

      const commissions: Record<string, number> = {
        'gratuit':      0.20,
        'pro_local':    0.15,
        'pro_national': 0.10
      };

      const plan = (shop?.plan || 'gratuit').toLowerCase();
      const rate = commissions[plan] !== undefined ? commissions[plan] : 0.20;
      const total_price = Number(pendingOrder.total_price) || 0;
      const commission = total_price * rate;
      const montantVendeur = total_price - commission;

      console.log(`[Webhook Sub] SubRefId=${subRefId}, Plan=${plan}, Rate=${rate}, Total=${total_price}, Comm=${commission}, VendorAmount=${montantVendeur}`);

      // Ensure profiles details are retrieved for client name & phone
      let clientNom = 'Client Anonyme';
      let clientTel = '';
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('prenom, nom, telephone')
        .eq('id', pendingOrder.buyer_id)
        .maybeSingle();

      if (clientProfile) {
        clientNom = `${clientProfile.prenom || ''} ${clientProfile.nom || ''}`.trim() || 'Client';
        clientTel = clientProfile.telephone || '';
      }

      const itemsList = Array.isArray(pendingOrder.items) ? pendingOrder.items : [];

      const firstItem = itemsList[0];
      const firstProductId = firstItem ? (firstItem.productId || firstItem.product_id || firstItem.id || '') : '';
      const firstProductName = firstItem ? (firstItem.productNom || firstItem.product_name || firstItem.nom || firstItem.name || '') : '';
      const firstUnitPrice = firstItem ? (Number(firstItem.prix) || Number(firstItem.price) || Number(firstItem.unit_price) || total_price) : total_price;
      const firstQuantity = firstItem ? (Number(firstItem.qte) || Number(firstItem.quantity) || 1) : 1;

      let vendorName = 'Boutique';
      try {
        const { data: vendorShop } = await supabase
          .from('shops')
          .select('shop_name')
          .eq('vendor_id', pendingOrder.vendor_id)
          .maybeSingle();
        if (vendorShop) {
          vendorName = vendorShop.shop_name || 'Boutique';
        } else {
          const { data: vendorProfile } = await supabase
            .from('profiles')
            .select('prenom, nom, boutique_nom')
            .eq('id', pendingOrder.vendor_id)
            .maybeSingle();
          if (vendorProfile) {
            vendorName = vendorProfile.boutique_nom || `${vendorProfile.prenom || ''} ${vendorProfile.nom || ''}`.trim() || 'Boutique';
          }
        }
      } catch {
        // Ignored
      }

      const isUuid = (str: string) => {
        if (typeof str !== 'string') return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      };
      const cleanBuyerId = isUuid(pendingOrder.buyer_id) ? pendingOrder.buyer_id : null;
      const cleanVendorId = isUuid(pendingOrder.vendor_id) ? pendingOrder.vendor_id : null;
      const cleanProductId = isUuid(firstProductId) ? firstProductId : null;
      
      // 4. Créer la commande définitive (with maximum redundant aliases for complete schema compatibility)
      const orderPayload: any = {
        id: isUuid(subRefId) ? subRefId : crypto.randomUUID(),
        checkout_group_id: pendingOrder.checkout_group_id || orderId,
        payment_reference: orderId, // sert à l'idempotence du webhook (voir contrôle .eq('payment_reference', ...))
        qr_token: subRefId, // Save the friendly payment reference in the text qr_token column
        qr_payload: pendingOrder.buyer_id, // Store original client ID here as fallback text in case user ID is not a UUID
        
        // Client / Buyer mapping with redundant aliases
        buyer_id: cleanBuyerId,
        client_id: cleanBuyerId,
        customer_id: cleanBuyerId,
        user_id: cleanBuyerId,
        client_nom: clientNom,
        client_name: clientNom, // alias
        client_tel: clientTel,
        
        // Vendor / Seller mapping with redundant aliases
        vendor_id: cleanVendorId,
        vendeur_id: cleanVendorId, // alias
        seller_id: cleanVendorId,
        owner_id: cleanVendorId,
        vendor_name: vendorName,
        items: itemsList,
        articles: itemsList, // alias
        total_price: total_price,
        total: total_price, // alias
        frais_livraison: Number(pendingOrder.shipping_fee) || 0,
        shipping_fee: Number(pendingOrder.shipping_fee) || 0,
        discount: Number(pendingOrder.discount) || 0,
        delivery_commune: pendingOrder.delivery_commune || '',
        delivery_address: pendingOrder.delivery_address || '',
        departement: pendingOrder.delivery_address || pendingOrder.departement || 'Ouest',
        commune: pendingOrder.delivery_commune || pendingOrder.commune || 'Pétion-Ville',
        status: 'payee', // 'payee' is standard in Vendza
        statut: 'payee', // alias
        payment_method: paymentMethod,
        paymentMethod: paymentMethod, // alias
        stripe_session_id: paymentMethod === 'stripe' ? transactionId : null,
        qr_code: qrCode,
        is_validated: false,
        client_confirmed: false,
        buyer_confirmed: false,
        reception_confirmed: false,
        vendor_credited: false,
        date: dateStr,
        heure: heureStr,
        product_id: cleanProductId,
        product_name: firstProductName,
        unit_price: firstUnitPrice,
        quantity: firstQuantity,
        created_at: new Date().toISOString()
      };

      // Retry insertion loop with resilience just like in frontend to bypass schema changes
      let orderStored: any = null;
      const payloadCopy = { ...orderPayload };
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const { data: insertedData, error: insertError } = await supabase
            .from('orders')
            .insert([payloadCopy])
            .select()
            .maybeSingle();

          if (!insertError) {
            orderStored = insertedData;
            console.log('[Webhook] Order created successfully inside database:', subRefId);
            break;
          }

          const errMsg = insertError.message || '';
          if (errMsg.toLowerCase().includes('uuid') || errMsg.toLowerCase().includes('invalid input syntax for uuid')) {
            let foundOffendingKey = false;
            for (const key of Object.keys(payloadCopy)) {
              const valStr = String(payloadCopy[key]);
              if (valStr && errMsg.includes(valStr)) {
                if (key === 'id') {
                  console.warn(`[Webhook resilience] Detected invalid UUID value '${valStr}' for primary key 'id', replacing with a new random UUID...`);
                  payloadCopy.id = crypto.randomUUID();
                } else {
                  console.warn(`[Webhook resilience] Detected invalid UUID value '${valStr}' for column '${key}', removing...`);
                  delete payloadCopy[key];
                }
                foundOffendingKey = true;
              }
            }
            if (!foundOffendingKey) {
              if (errMsg.toLowerCase().includes('buyer_id') || errMsg.toLowerCase().includes('client_id') || errMsg.toLowerCase().includes('customer_id') || errMsg.toLowerCase().includes('user_id')) {
                console.warn("[Webhook resilience] UUID issue on buyer_id, deleting from payload copy...");
                delete payloadCopy.buyer_id;
                delete payloadCopy.client_id;
                delete payloadCopy.customer_id;
                delete payloadCopy.user_id;
              } else if (errMsg.toLowerCase().includes('vendor_id') || errMsg.toLowerCase().includes('vendeur_id') || errMsg.toLowerCase().includes('seller_id') || errMsg.toLowerCase().includes('owner_id')) {
                console.warn("[Webhook resilience] UUID issue on vendor_id, deleting from payload copy...");
                delete payloadCopy.vendor_id;
                delete payloadCopy.vendeur_id;
                delete payloadCopy.seller_id;
                delete payloadCopy.owner_id;
              } else {
                console.log("[Webhook resilience] Detected UUID primary key on orders table, converting ID to UUID...");
                payloadCopy.id = crypto.randomUUID();
              }
            }
            continue;
          }

          const matchCol = errMsg.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i) || 
                           errMsg.match(/Could not find the '([^']+)' column/i) || 
                           errMsg.match(/column "([^"]+)" does not exist/i);
          
          if (matchCol && matchCol[1]) {
            const offendingCol = matchCol[1];
            console.warn(`[Webhook resilience] Removing offending column: ${offendingCol}`);
            delete payloadCopy[offendingCol];
          } else {
            console.error('[Webhook error] Fatal database insert error:', insertError);
            break;
          }
        } catch (err: any) {
          console.error('[Webhook error] Insertion exception:', err.message);
          break;
        }
      }

      if (!orderStored) {
        console.error(`[CRITICAL] Order insertion failed for reference ${subRefId}. Storing inside orphaned_payments table and local backup file.`);
        
        const orphanedPayload = {
          id: `orph-${subRefId.split('-')[1] || Date.now().toString().slice(-4)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          order_id: subRefId,
          buyer_id: pendingOrder.buyer_id,
          vendor_id: pendingOrder.vendor_id,
          amount: total_price,
          payment_method: paymentMethod,
          transaction_id: transactionId || orderId,
          payload_details: JSON.stringify(orderPayload),
          created_at: new Date().toISOString()
        };
        
        const payloadOrphCopy = { ...orphanedPayload };
        let isSavedInSupabaseOrph = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const { error: orphError } = await supabase
              .from('orphaned_payments')
              .insert([payloadOrphCopy]);
            if (!orphError) {
              console.log('[Webhook Recovery] Saved orphaned payment successfully in Supabase: orphaned_payments');
              isSavedInSupabaseOrph = true;
              break;
            }
            const errMsg = orphError.message || '';
            const matchCol = errMsg.match(/column "([^"]+)"/i);
            if (matchCol && matchCol[1]) {
              delete payloadOrphCopy[matchCol[1]];
            } else {
              console.error('[Webhook Recovery Error] Failed saving orphaned payment to DB:', orphError.message);
              break;
            }
          } catch (e: any) {
            console.error('[Webhook Recovery Exception]', e.message);
            break;
          }
        }
        
        if (!isSavedInSupabaseOrph) {
          console.warn(`[CRITICAL - FALLBACK WARNING] Storing orphaned payment to local JSON file as a last resort!`);
          saveOrphanedPayment(orderPayload);
        }
        continue; // pas de commande : on ne crédite pas le vendeur
      } else {
        // Order created successfully, we can safely delete from local pending cache
        deleteLocalPendingOrder(subRefId);
        lastStoredOrder = orderStored;

        // Stock réservé dès le paiement (si un article manque, on rend ce qui a été pris : la livraison déduira comme avant)
        try {
          const lines: any[] = Array.isArray(pendingOrder.items) ? pendingOrder.items : [];
          const taken: Array<{ id: string; qty: number }> = []; let allOk = lines.length > 0;
          for (const it of lines) {
            const pid = String(it?.productId || it?.product_id || it?.id || ''); const qty = Math.max(1, Math.floor(Number(it?.qte ?? it?.quantity ?? 1) || 1));
            if (!isValidUuid(pid)) { allOk = false; continue; }
            const { data: ok, error: rErr } = await supabase.rpc('reserve_stock', { p_product_id: pid, p_qty: qty });
            if (!rErr && ok === true) taken.push({ id: pid, qty }); else allOk = false;
          }
          if (allOk) { if (orderStored?.id) await supabase.from('orders').update({ stock_reserved: true }).eq('id', orderStored.id); }
          else for (const t of taken) await supabase.rpc('release_stock', { p_product_id: t.id, p_qty: t.qty });
        } catch (e: any) { console.warn('[Webhook] réservation du stock impossible:', e?.message); }
      }

      // 5. Créditer le wallet vendeur (en séquestre)
      const { data: wallet } = await supabase
        .from('vendor_wallets')
        .select('*')
        .eq('vendor_id', pendingOrder.vendor_id)
        .maybeSingle();

      if (wallet) {
        const newPending = (Number(wallet.pending_balance) || 0) + montantVendeur;
        const newTotal = (Number(wallet.total_earned) || 0) + montantVendeur;
        await supabase
          .from('vendor_wallets')
          .update({
            pending_balance: newPending,
            total_earned: newTotal,
            updated_at: new Date().toISOString()
          })
          .eq('vendor_id', pendingOrder.vendor_id);
      } else {
        await supabase
          .from('vendor_wallets')
          .insert({
            vendor_id: pendingOrder.vendor_id,
            pending_balance: montantVendeur,
            available_balance: 0,
            total_earned: montantVendeur,
            updated_at: new Date().toISOString()
          });
      }

      // 6. Enregistrer transaction wallet
      await supabase
        .from('vendor_wallet_transactions')
        .insert({
          vendor_id: pendingOrder.vendor_id,
          order_id: subRefId,
          amount: montantVendeur,
          type: 'pending_escrow',
          description: `Paiement ${paymentMethod} — en séquestre (commission ${rate * 100}% pour forfait ${plan} déduite)`
        });

      // 7. Supprimer la commande pending
      await supabase
        .from('pending_orders')
        .delete()
        .eq('reference_id', subRefId);

      // 8. Trigger real-time push notifications from backend (Fail-safe)
      try {
        if (pendingOrder.vendor_id) {
          console.log(`[Webhook Push] Notifying seller '${pendingOrder.vendor_id}'...`);
          await sendPushNotificationBackend(
            pendingOrder.vendor_id,
            "Nouvelle commande reçue",
            `Tu as reçu une nouvelle commande d'un montant de ${total_price} HTG. Réf: ${subRefId}`
          );
        }
        if (pendingOrder.buyer_id) {
          console.log(`[Webhook Push] Notifying buyer '${pendingOrder.buyer_id}'...`);
          await sendPushNotificationBackend(
            pendingOrder.buyer_id,
            "Ta commande a été confirmée",
            `Ton paiement de ${total_price} HTG a été enregistré avec succès et placé en séquestre de sécurité. Réf: ${subRefId}`
          );
        }
      } catch (pushErr: any) {
        console.error("[Webhook Push Error] Failed to send push notification from backend webhook:", pushErr.message);
      }
    }

    // Also clean up any parent pending order reference if it exists
    await supabase
      .from('pending_orders')
      .delete()
      .eq('reference_id', orderId);
    deleteLocalPendingOrder(orderId);

    console.log('[Webhook Success] Finished successfully for group order:', orderId);
    return lastStoredOrder;
  } catch (e: any) {
    console.error('[Webhook] Exception in creerCommandeApresPaiement:', e.message);
    return null;
  }
};

// ============================================
// BAZIK INTEGRATION PAYMENTS (REPLACING MCC)
// ============================================

// OPTIONS CORS preflight handler for Bazik creation
app.options('/api/bazik/create-payment', (req, res) => {
  // Liste d'origines autorisées (jamais « * ») : sans origine reconnue, aucun en-tête CORS n'est envoyé
  const corsOrigin = corsOriginFor(req.headers.origin);
  res.header('Vary', 'Origin');
  if (corsOrigin) {
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  return res.sendStatus(204);
});

// 1. Create Payment (Backend -> Bazik)
app.post('/api/bazik/create-payment', async (req, res) => {
  const corsOrigin = corsOriginFor(req.headers.origin);
  res.header('Vary', 'Origin');
  if (corsOrigin) res.header('Access-Control-Allow-Origin', corsOrigin);
  const { orderId: bodyOrderId, amount, buyerName, buyerEmail, description } = req.body;
  let orderId: string = bodyOrderId;

  const metadata = req.body.metadata || {};
  const isSubscription = req.body.type === 'subscription' || (typeof orderId === 'string' && orderId.startsWith('sub-')) || metadata.type === 'subscription';

  if (!isSubscription && (!orderId || !amount)) {
    return res.status(400).json({ error: "orderId et amount sont requis." });
  }

  let numericAmount = Number(amount);
  let subPlan: string | null = null;
  let subBilling: string | null = null;

  if (isSubscription) {
    // Abonnement : TOUT est fixé par le serveur (utilisateur = jeton de connexion, forfait et durée validés, prix = grille serveur)
    const authed = await getAuthedUser(req);
    if (!authed) return res.status(401).json({ error: "Connexion requise pour souscrire à un abonnement." });
    const plan = normalizePlan(req.body.planCode ?? metadata.planCode);
    const billing = normalizeBilling(req.body.billing ?? metadata.billing);
    if (!plan || !billing) return res.status(400).json({ error: "Forfait ou durée d'abonnement invalide." });
    numericAmount = planPriceHtg(plan, billing);
    if (Number(amount) && Math.round(Number(amount)) !== numericAmount) console.warn(`[Bazik] Montant d'abonnement du navigateur ignoré : ${amount} → ${numericAmount} HTG`);
    orderId = newSubscriptionRef(authed.id);
    subPlan = plan; subBilling = billing;
    await setPendingSubscriptionMeta(orderId, numericAmount, { type: 'subscription', planCode: plan, billing, userId: authed.id, expectedHtg: numericAmount });
  } else {
    if (isNaN(numericAmount) || numericAmount < 1 || numericAmount > 1000000) {
      return res.status(400).json({ error: 'Montant invalide (1 à 1 000 000 HTG)' });
    }
    // Commande : le montant est FIXÉ PAR LE SERVEUR (somme des commandes de tous les vendeurs, livraison comprise)
    const group = await getGroupPendingOrders(String(orderId));
    if (!group.length) return res.status(404).json({ error: "Commande introuvable ou expirée. Retournez au panier et réessayez." });
    const serverTotal = Math.round(group.reduce((sum: number, po: any) => sum + (Number(po.total_price) || 0), 0));
    if (serverTotal < 1 || serverTotal > 1000000) return res.status(400).json({ error: 'Montant invalide (1 à 1 000 000 HTG)' });
    if (Math.abs(serverTotal - numericAmount) > 1) console.warn(`[Bazik] Montant du navigateur ignoré : ${numericAmount} → ${serverTotal} HTG (commande ${orderId})`);
    numericAmount = serverTotal;
  }

  // Check if Bazik is configured
  const secretKey = process.env.BAZIK_SECRET_KEY || '';
  const isPlaceholderKey = !secretKey || secretKey === "sk_proj_..." || secretKey.trim() === "";

  if (isPlaceholderKey) {
    console.error(`[Bazik Backend Error] Clé Bazik manquante ou invalide.`);
    return res.status(400).json({
      error: "La clé de l'API Bazik n'est pas configurée ou est invalide. Veuillez vérifier les variables d'environnement."
    });
  }

  try {
    const baseUrl = getBaseUrl(req);
    const successUrl = isSubscription
      ? `${baseUrl}/paiement/abonnement/succes?referenceId=${encodeURIComponent(orderId)}&plan=${subPlan}&billing=${subBilling}`
      : `${baseUrl}/paiement/succes?orderId=${orderId}`;
    const errorUrl = `${baseUrl}/paiement/erreur?orderId=${orderId}`;
    const webhookUrl = (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))
      ? 'https://www.vendza.store/api/bazik/webhook/payment'
      : `${baseUrl}/api/bazik/webhook/payment`;

    const nameParts = (buyerName || '').trim().split(/\s+/);
    const customerFirstName = nameParts[0] || 'Client';
    const customerLastName = nameParts.slice(1).join(' ') || 'Vendza';

    const token = await getBazikToken();

    // Use unique reference ID to prevent Bazik duplicate transaction errors on retries
    const uniqueReferenceId = `${orderId}_bz_${Date.now()}`;

    console.log(`[Bazik API] Creating payment token for order ${orderId} (Ref: ${uniqueReferenceId}), amount: ${numericAmount} GDES...`);

    const requestBody = {
      gdes: numericAmount,
      userID: process.env.BAZIK_USER_ID,
      successUrl: successUrl,
      errorUrl: errorUrl,
      description: description || `Achat sur Vendza — Commande ${orderId}`,
      referenceId: uniqueReferenceId,
      customerFirstName,
      customerLastName,
      customerEmail: buyerEmail || 'info@vendza.store',
      webhookUrl: webhookUrl,
      metadata: {
        isSubscription: isSubscription ? "true" : "false"
      }
    };

    const response = await fetch('https://api.bazik.io/moncash/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Bazik API Error] Payment creation failed:', response.status, errorText);
      throw new Error(`La création de paiement via l'API Bazik a échoué : ${response.status} ${errorText}`);
    }

    const data: any = await response.json();
    console.log('[Bazik API] Successfully created payment token:', data);
    console.log('[Bazik DEBUG] Full response keys:', Object.keys(data));
    console.log('[Bazik DEBUG] Full response:', JSON.stringify(data, null, 2));

    if (data.success === false || data.success === 'false') {
      let friendlyError = "La création du paiement a échoué de la part de Bazik/MonCash.";
      const msg = data.msg || '';
      if (msg.includes("The user name does not exist") || msg.includes("security credential is incorrect")) {
        friendlyError = "Erreur d'authentification MonCash : Les clés API MonCash (Client ID / Client Secret) configurées sur votre compte Bazik sont incorrectes ou configurées pour le mauvais environnement (Sandbox vs Production).";
      } else if (msg) {
        friendlyError = `Échec de l'initialisation MonCash : ${msg}`;
      }
      console.error('[Bazik API Error] Success is false in payload:', data);
      return res.status(400).json({ error: friendlyError, details: data });
    }

    const redirectUrl = data.paymentUrl || data.payment_url || data.url || 
      data.redirectUrl || data.redirect_url || data.redirect || 
      data.checkoutUrl || data.checkout_url || data.payment_link || null;

    if (!redirectUrl) {
      console.error('[Bazik API Error] No redirectUrl. Full response:', JSON.stringify(data));
      return res.status(500).json({ 
        error: "Bazik n'a pas retourné d'URL de redirection. Réponse reçue : " + JSON.stringify(data)
      });
    }

    return res.json({
      payment_url: redirectUrl,
      expires_at: data.expiresAt || data.expires_at || null,
      reference_id: orderId
    });

  } catch (err: any) {
    console.error('[Bazik Backend] Exception in create-payment:', err.message);
    return res.status(500).json({
      error: `Erreur lors de l'appel de l'API de paiement : ${err.message}`
    });
  }
});

// 2. Payment Webhook (Bazik -> Backend)
app.post('/api/bazik/webhook/payment', express.raw({ type: '*/*' }), async (req: any, res) => {
  try {
    const rawBodyBuffer = req.body;
    const rawBody = rawBodyBuffer ? rawBodyBuffer.toString('utf-8') : '';
    
    const sig = req.headers['x-bazik-signature'] || '';
    const ts = req.headers['x-bazik-timestamp'] || '';
    const evId = req.headers['x-bazik-event-id'] || '';

    const receivedSig = Array.isArray(sig) ? sig[0] : String(sig);
    const timestamp = Array.isArray(ts) ? ts[0] : String(ts);
    const eventId = Array.isArray(evId) ? evId[0] : String(evId);

    console.log('[Bazik Payment Webhook] Received signature:', receivedSig, 'timestamp:', timestamp, 'eventId:', eventId);

    // Verify signature
    if (!verifyBazikSignature(rawBody, receivedSig, timestamp, eventId)) {
      console.error('[Bazik Payment Webhook] Invalid webhook signature!');
      return res.status(401).send('Signature verification failed');
    }

    const payload = JSON.parse(rawBody);
    console.log('[Bazik Payment Webhook] Signature verified. Event Type:', payload.type, 'orderId:', payload.orderId, 'referenceId:', payload.referenceId);

    const { type, orderId, referenceId, amount } = payload;
    const rawOrderId = referenceId || orderId;
    let finalOrderId = rawOrderId;

    if (rawOrderId && typeof rawOrderId === 'string') {
      if (rawOrderId.includes('_bz_')) {
        finalOrderId = rawOrderId.split('_bz_')[0];
        console.log(`[Bazik Payment Webhook] Decoded raw reference ID ${rawOrderId} to final internal order ID: ${finalOrderId}`);
      }
    }

    if (!finalOrderId) {
      console.error('[Bazik Payment Webhook Error] Missing finalOrderId/referenceId in webhook payload:', payload);
      return res.status(400).send('Missing referenceId');
    }

    if (type === 'payment.succeeded') {
      console.log('[Bazik Payment Webhook] Payment succeeded! Processing order:', finalOrderId);

      if (isSupabaseConfigured && supabase) {
        const { data: pendingData } = await supabase
          .from('pending_orders')
          .select('id')
          .or(`reference_id.eq.${finalOrderId},checkout_group_id.eq.${finalOrderId},reference_id.like.${finalOrderId}_sub_%`);

        const { data: orderData } = await supabase
          .from('orders')
          .select('id')
          .eq('payment_reference', finalOrderId);

        if ((!pendingData || pendingData.length === 0) && orderData && orderData.length > 0) {
          console.log(`[Bazik Payment Webhook Idempotency] Order ${finalOrderId} already successfully processed. Skipping.`);
          return res.status(200).send('ok');
        }
      }

      if (isSubscriptionRef(finalOrderId)) {
        const pending = await getPendingOrderSubscriptionInfo(finalOrderId);
        if (pending) {
          console.log(`[Bazik Webhook Subscription] Métadonnées trouvées : plan=${pending.planCode}, billing=${pending.billing}`);
          // Le montant payé (webhook signé) doit couvrir le prix du forfait ; sinon l'abonnement n'est PAS activé
          await activateSubscriptionFromPayment({
            userId: pending.userId, planCode: pending.planCode, billing: pending.billing,
            method: 'moncash', paidHtg: Number(amount) || 0, tolerancePct: 0, reference: finalOrderId
          });
          try { await supabase!.from('pending_orders').delete().eq('reference_id', finalOrderId); } catch (e) {}
        } else {
          // Plus de repli « deviner l'utilisateur dans la référence » : un paiement sans métadonnées est mis de côté pour traitement manuel
          console.error('[Bazik Webhook Subscription] Aucune métadonnée pour', finalOrderId, '— abonnement non activé, paiement mis de côté.');
          const row = { id: `orph-sub-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, order_id: finalOrderId, buyer_id: null,
            amount: Number(amount) || 0, payment_method: 'moncash', transaction_id: finalOrderId, status: 'pending_untraceable',
            payload_details: JSON.stringify({ subscription: true, reason: 'no_pending_meta', paid: Number(amount) || 0 }), created_at: new Date().toISOString() };
          try { await supabase!.from('orphaned_payments').insert([row]); } catch (_) { saveOrphanedPayment(row); }
        }
      } else {
        await creerCommandeApresPaiement(finalOrderId, 'moncash', orderId || finalOrderId, Number(amount) || null);
      }
    } else if (type === 'payment.failed' || type === 'payment.cancelled') {
      console.log(`[Bazik Payment Webhook] Payment failed or cancelled: ${finalOrderId}`);
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('pending_orders')
          .delete()
          .eq('reference_id', finalOrderId);
      }
    }

    return res.status(200).send('ok');
  } catch (err: any) {
    console.error('[Bazik Payment Webhook Exception]', err.message);
    return res.status(200).send('Handled with exception: ' + err.message);
  }
});

// Helper to calculate vendor payout amount based on order price and vendor shop plan
async function getMontantVendeurForOrder(order: any): Promise<number> {
  const vendorId = order.vendor_id || order.vendeur_id || order.seller_id;
  if (!vendorId) return Number(order.total_price || order.total || 0);

  let plan = 'gratuit';
  try {
    const { data: shop } = await supabase
      .from('shops')
      .select('plan')
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (shop && shop.plan) {
      plan = shop.plan.toLowerCase();
    }
  } catch (err) {
    console.error('Error fetching shop plan for vendor payout:', err);
  }

  const commissions: Record<string, number> = {
    'gratuit':      0.20,
    'pro_local':    0.15,
    'pro_national': 0.10
  };

  const rate = commissions[plan] !== undefined ? commissions[plan] : 0.20;
  const totalPrice = Number(order.total_price || order.total || 0);
  const commission = totalPrice * rate;
  return totalPrice - commission;
}

// 3. Transfer Webhook (Bazik -> Backend)
app.post('/api/bazik/webhook/transfer', express.raw({ type: '*/*' }), async (req: any, res) => {
  try {
    const rawBodyBuffer = req.body;
    const rawBody = rawBodyBuffer ? rawBodyBuffer.toString('utf-8') : '';
    
    const sig = req.headers['x-bazik-signature'] || '';
    const ts = req.headers['x-bazik-timestamp'] || '';
    const evId = req.headers['x-bazik-event-id'] || '';

    const receivedSig = Array.isArray(sig) ? sig[0] : String(sig);
    const timestamp = Array.isArray(ts) ? ts[0] : String(ts);
    const eventId = Array.isArray(evId) ? evId[0] : String(evId);

    console.log('[Bazik Transfer Webhook] Received signature:', receivedSig, 'timestamp:', timestamp, 'eventId:', eventId);

    if (!verifyBazikSignature(rawBody, receivedSig, timestamp, eventId)) {
      console.error('[Bazik Transfer Webhook] Invalid webhook signature!');
      return res.status(401).send('Signature verification failed');
    }

    const payload = JSON.parse(rawBody);
    console.log('[Bazik Transfer Webhook] Signature verified. Event Type:', payload.type, 'referenceId:', payload.referenceId);

    const { type, referenceId, failureReason, amount } = payload;
    let orderId = referenceId || '';
    if (orderId.startsWith('PAY_VENDOR_')) {
      orderId = orderId.replace('PAY_VENDOR_', '');
    }

    if (!orderId) {
      console.error('[Bazik Transfer Webhook Error] Missing referenceId/orderId in transfer payload.');
      return res.status(400).send('Missing referenceId');
    }

    if (type === 'transfer.succeeded') {
      console.log(`[Bazik Transfer Webhook] Payout succeeded for reference ${referenceId}, orderId: ${orderId}`);
      if (isSupabaseConfigured && supabase) {
        // Fetch order to get vendor_id and total_price
        const { data: order, error: orderFetchErr } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (orderFetchErr || !order) {
          console.error(`[Bazik Transfer Webhook Error] Order not found for id ${orderId}:`, orderFetchErr?.message);
        } else {
          const vendorId = order.vendor_id || order.vendeur_id || order.seller_id;
          const finalAmount = Number(amount) || await getMontantVendeurForOrder(order);

          // Update order in DB
          const { error: updateErr } = await supabase
            .from('orders')
            .update({
              vendor_credited: true,
              vendor_credited_at: new Date().toISOString()
            })
            .eq('id', orderId);

          if (updateErr) {
            console.error(`[Bazik Transfer Webhook] Error updating vendor_credited in DB:`, updateErr.message);
          } else {
            console.log(`[Bazik Transfer Webhook] Vendor credited updated to true in DB for order: ${orderId}`);
          }

          if (vendorId) {
            // Update vendor wallet (transfer from pending_balance to available_balance)
            const { data: wallet } = await supabase
              .from('vendor_wallets')
              .select('*')
              .eq('vendor_id', vendorId)
              .maybeSingle();

            if (wallet) {
              await supabase
                .from('vendor_wallets')
                .update({
                  pending_balance: Math.max(0, (Number(wallet.pending_balance) || 0) - finalAmount),
                  available_balance: (Number(wallet.available_balance) || 0) + finalAmount,
                  updated_at: new Date().toISOString()
                })
                .eq('vendor_id', vendorId);
            } else {
              await supabase
                .from('vendor_wallets')
                .insert({
                  vendor_id: vendorId,
                  pending_balance: 0,
                  available_balance: finalAmount,
                  total_earned: finalAmount,
                  updated_at: new Date().toISOString()
                });
            }

            // Record transaction
            await supabase
              .from('vendor_wallet_transactions')
              .insert({
                vendor_id: vendorId,
                order_id: orderId,
                amount: finalAmount,
                type: 'credit',
                description: `Virement MonCash confirmé — ${finalAmount} HTG disponible (transfert réussi via Bazik)`
              });

            // Create notification message for vendor
            await supabase
              .from('platform_messages')
              .insert({
                title: '✅ Virement MonCash confirmé !',
                message: `Le virement MonCash de ${finalAmount.toLocaleString('fr-FR')} HTG pour la commande ${orderId} a été crédité avec succès sur votre solde disponible.`,
                audience: vendorId,
                is_active: true
              });

            console.log(`[Bazik Transfer Webhook] Successfully credited vendor ${vendorId} with ${finalAmount} HTG for order ${orderId}`);
          }
        }
      }
    } else if (type === 'transfer.failed') {
      console.error(`[Bazik Transfer Webhook Failed] Transfer failed for reference ${referenceId}, orderId: ${orderId}, reason: ${failureReason}`);
      if (isSupabaseConfigured && supabase) {
        const { data: order } = await supabase
          .from('orders')
          .select('vendor_id')
          .eq('id', orderId)
          .maybeSingle();

        if (order && order.vendor_id) {
          await supabase
            .from('vendor_wallet_transactions')
            .insert({
              vendor_id: order.vendor_id,
              order_id: orderId,
              amount: Number(amount) || 0,
              type: 'failed_payout',
              description: `Échec du virement MonCash du vendeur : ${failureReason || 'Raison inconnue'}. Retry manuel requis.`
            });
          console.log(`[Bazik Transfer Webhook] Created failed_payout wallet transaction in DB for order: ${orderId}`);
        }
      }
    }

    return res.status(200).send('ok');
  } catch (err: any) {
    console.error('[Bazik Transfer Webhook Exception]', err.message);
    return res.status(200).send('Handled with exception: ' + err.message);
  }
});

// 4. Pay Vendor (Triggered after QR code delivery validation)
// Exécute le virement MonCash d'une commande dont la livraison est confirmée (les contrôles d'accès sont faits par l'appelant).
async function executeVendorPayout(
  order: any,
  opts: { clientAmount?: any; clientFirstName?: string; clientLastName?: string } = {}
): Promise<{ status: number; body: any }> {
  const orderId = order.id;
  const { clientAmount, clientFirstName, clientLastName } = opts;
  let payoutLockRef: string | null = null;
  try {
    if (!isSupabaseConfigured || !supabase) {
      return { status: 500, body: { error: "Database not configured on server." } };
    }
    if (order.vendor_credited === true) {
      return { status: 409, body: { error: "Cette commande a déjà été versée au vendeur." } };
    }

    // --- Montant calculé côté serveur (jamais supérieur à ce que dit la base) ---
    const payoutVendorId = order.vendor_id || order.seller_id || order.owner_id;
    const serverAmount = Math.round(await getMontantVendeurForOrder(order));
    const requestedAmount = Math.round(Number(clientAmount) || 0);
    const amount = requestedAmount > 0 ? Math.min(requestedAmount, serverAmount) : serverAmount;
    if (requestedAmount > 0 && requestedAmount !== serverAmount) {
      console.warn(`[Bazik Pay Vendor] Client amount ${requestedAmount} differs from server amount ${serverAmount} for order ${orderId}; using ${amount}.`);
    }
    if (!(amount > 0)) {
      return { status: 400, body: { error: "Montant du virement invalide." } };
    }

    // --- Portefeuille MonCash lu en base (profil puis boutique), jamais depuis la requête ---
    let vendorWallet = '';
    let moncashName = '';
    if (payoutVendorId) {
      // 1) table privée (source de vérité) ; 2) anciennes colonnes, tant qu'elles existent
      const { data: payoutPrivate } = await supabase.from('vendor_private').select('moncash, moncash_nom').eq('user_id', payoutVendorId).maybeSingle();
      const { data: payoutProfile } = await supabase
        .from('profiles')
        .select('numero_moncash, moncash_nom')
        .eq('id', payoutVendorId)
        .maybeSingle();
      vendorWallet = payoutPrivate?.moncash || payoutProfile?.numero_moncash || '';
      moncashName = ((payoutPrivate?.moncash_nom || payoutProfile?.moncash_nom) || '').trim();
      if (!vendorWallet) {
        const { data: payoutShop } = await supabase
          .from('shops')
          .select('moncash, moncash_nom')
          .eq('vendor_id', payoutVendorId)
          .maybeSingle();
        vendorWallet = payoutShop?.moncash || '';
        moncashName = moncashName || (payoutShop?.moncash_nom || '').trim();
      }
    }
    if (!vendorWallet) {
      return { status: 400, body: { error: "Le vendeur n'a pas configuré son numéro MonCash." } };
    }
    const nameParts = moncashName ? moncashName.split(/\s+/) : [];
    const vendorFirstName = nameParts[0] || clientFirstName || 'Vendeur';
    const vendorLastName = nameParts.slice(1).join(' ') || clientLastName || 'Vendza';

    // --- Verrou durable anti double-virement (index unique sur payouts.reference) ---
    const payoutRef = `PAY_VENDOR_${orderId}`;
    const { error: lockErr } = await supabase
      .from('payouts')
      .insert({ vendor_id: payoutVendorId, amount, status: 'pending', reference: payoutRef });
    if (lockErr) {
      if ((lockErr as any).code === '23505') {
        return { status: 409, body: { error: "Un virement est déjà en cours ou effectué pour cette commande." } };
      }
      console.warn('[Bazik Pay Vendor] payouts lock insert failed (non bloquant):', lockErr.message);
    } else {
      payoutLockRef = payoutRef;
    }

    const secretKey = process.env.BAZIK_SECRET_KEY || '';
    const isSimulation = !secretKey || secretKey === "sk_proj_...";
    if (isSimulation && isProduction() && process.env.ALLOW_PAYMENT_SIMULATION !== 'true') {
      // SÉCURITÉ : on ne « simule » JAMAIS un virement en production (cela marquerait la commande comme réglée sans argent réel)
      console.error('[Bazik Pay Vendor] BAZIK_SECRET_KEY missing/placeholder in production: payout refused (set ALLOW_PAYMENT_SIMULATION=true only for tests).');
      await releasePayoutLock(payoutLockRef);
      return { status: 503, body: { error: "Passerelle de paiement non configurée (clé Bazik manquante) : le virement est impossible pour l'instant." } };
    }
    console.log(`[Bazik Pay Vendor Log] Payout attempt details:
      Order ID: ${orderId}
      Amount to transfer: ${amount} GDES/HTG
      Destination Wallet: ${vendorWallet}
      Execution Mode: ${isSimulation ? 'SIMULATION (No valid BAZIK_SECRET_KEY)' : 'REAL (BAZIK_SECRET_KEY configured)'}`);

    if (isSimulation) {
      console.warn('[Bazik Pay Vendor Simulation] No secret key. Simulating successful transfer request.');
      
      // Perform immediate simulated credit of vendor wallet
      if (isSupabaseConfigured && supabase) {
        const vendorId = order.vendor_id || order.vendeur_id || order.seller_id;
        const finalAmount = Number(amount) || await getMontantVendeurForOrder(order);

        // Update order
        await supabase
          .from('orders')
          .update({
            vendor_credited: true,
            vendor_credited_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (vendorId) {
          // Update wallet
          const { data: wallet } = await supabase
            .from('vendor_wallets')
            .select('*')
            .eq('vendor_id', vendorId)
            .maybeSingle();

          if (wallet) {
            await supabase
              .from('vendor_wallets')
              .update({
                pending_balance: Math.max(0, (Number(wallet.pending_balance) || 0) - finalAmount),
                available_balance: (Number(wallet.available_balance) || 0) + finalAmount,
                updated_at: new Date().toISOString()
              })
              .eq('vendor_id', vendorId);
          } else {
            await supabase
              .from('vendor_wallets')
              .insert({
                vendor_id: vendorId,
                pending_balance: 0,
                available_balance: finalAmount,
                total_earned: finalAmount,
                updated_at: new Date().toISOString()
              });
          }

          // Insert transaction
          await supabase
            .from('vendor_wallet_transactions')
            .insert({
              vendor_id: vendorId,
              order_id: orderId,
              amount: finalAmount,
              type: 'credit',
              description: `Virement MonCash simulé (mode test) — ${finalAmount} HTG disponible`
            });

          // Log platform message for vendor
          await supabase
            .from('platform_messages')
            .insert({
              title: '✅ Fonds disponibles (Test) !',
              message: `Le virement MonCash simulé de ${finalAmount.toLocaleString('fr-FR')} HTG pour la commande ${orderId} a été confirmé (mode test).`,
              audience: vendorId,
              is_active: true
            });
          
          console.log(`[Bazik Pay Vendor Simulation] Successfully simulated wallet credit for vendor ${vendorId} with ${finalAmount} HTG`);
        }
      }

      return { status: 200, body: {
        success: true,
        is_simulated: true,
        status: "succeeded",
        referenceId: `PAY_VENDOR_${orderId}`,
        message: "Virement MonCash simulé initié et crédité avec succès (mode test)."
      } };
    }

    const token = await getBazikToken();
    console.log(`[Bazik API] Initiating withdraw of ${amount} GDES to MonCash wallet ${vendorWallet} for order ${orderId}...`);

    const response = await fetch('https://api.bazik.io/moncash/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        gdes: Math.round(Number(amount)),
        wallet: vendorWallet,
        description: `Transfert de fonds Vendza - Commande ${orderId}`,
        referenceId: `PAY_VENDOR_${orderId}`,
        customerFirstName: vendorFirstName || 'Vendeur',
        customerLastName: vendorLastName || 'Vendza',
        customerEmail: 'info@vendza.store',
        webhookUrl: 'https://www.vendza.store/api/bazik/webhook/transfer'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Bazik API Error] Withdraw call failed:', response.status, errorText);
      await releasePayoutLock(payoutLockRef);
      return { status: response.status, body: { error: `Le virement via Bazik a échoué: ${errorText}` } };
    }

    const data: any = await response.json();
    console.log('[Bazik API] Withdraw successfully initiated:', data);

    return { status: 200, body: {
      success: true,
      status: data.status || 'pending',
      transactionId: data.transactionId || null,
      referenceId: `PAY_VENDOR_${orderId}`
    } };
  } catch (err: any) {
    console.error('[Bazik Pay Vendor Exception]', err.message);
    await releasePayoutLock(payoutLockRef);
    return { status: 500, body: { error: err.message || 'Erreur interne lors du traitement du virement' } };
  }
}

app.post('/api/bazik/pay-vendor', async (req, res) => {
  // SÉCURITÉ : le portefeuille de destination et le montant ne sont JAMAIS pris tels quels dans la requête.
  const { orderId, amount: clientAmount, vendorFirstName: clientFirstName, vendorLastName: clientLastName } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: "orderId is required." });
  }
  const caller = await getAuthedUser(req);
  if (!caller) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  if (!isValidUuid(orderId)) {
    return res.status(400).json({ error: "L'identifiant de commande n'est pas un UUID valide." });
  }

  try {
    if (!isSupabaseConfigured || !supabase) {
      return res.status(500).json({ error: "Database not configured on server." });
    }
    const { data: order, error: orderErr } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (orderErr || !order) {
      return res.status(404).json({ error: "Commande non trouvée dans la base de données." });
    }

    // Nouvel essai d'un virement pour une commande DÉJÀ confirmée par l'acheteur (le serveur est seul à écrire ces indicateurs)
    const isDeliveryConfirmed = order.reception_confirmed === true || order.status === 'completed' || order.status === 'livree';
    if (!isDeliveryConfirmed) {
      return res.status(400).json({ error: "Le virement ne peut pas être initié car la livraison n'est pas confirmée par l'acheteur." });
    }
    const participantIds = [order.buyer_id, order.client_id, order.customer_id, order.user_id, order.vendor_id, order.seller_id, order.owner_id].filter(Boolean);
    if (!participantIds.includes(caller.id)) {
      return res.status(403).json({ error: "Accès refusé pour cette commande." });
    }
    if (order.vendor_credited === true) {
      return res.status(409).json({ error: "Cette commande a déjà été versée au vendeur." });
    }
    const unverified = await assertPaymentVerified(supabase, order);
    if (unverified) return res.status(unverified.status).json(unverified.body);

    const r = await executeVendorPayout(order, { clientAmount, clientFirstName, clientLastName });
    return res.status(r.status).json(r.body);
  } catch (err: any) {
    console.error('[Bazik Pay Vendor Route Exception]', err.message);
    return res.status(500).json({ error: err.message || 'Erreur interne lors du traitement du virement' });
  }
});

// Le VENDEUR récupère le code de livraison à afficher en QR (l'acheteur le scanne). Le code n'est lisible que par le serveur.
app.get('/api/orders/:orderId/delivery-code', async (req, res) => {
  const caller = await getAuthedUser(req);
  if (!caller) return res.status(401).json({ error: "Authentification requise." });
  if (!isValidUuid(req.params.orderId)) return res.status(400).json({ error: "Identifiant de commande invalide." });
  if (!isSupabaseConfigured || !supabase) return res.status(500).json({ error: "Database not configured on server." });
  const r = await getOrCreateDeliveryCode(supabase, req.params.orderId, caller.id);
  return res.status(r.status).json(r.body);
});

// L'ACHETEUR confirme la réception (bouton ou scan du QR du vendeur) : transition atomique + virement au vendeur.
app.post('/api/orders/confirm-delivery', async (req, res) => {
  const { orderId, code } = req.body || {};
  if (!orderId || !isValidUuid(orderId)) return res.status(400).json({ error: "orderId invalide." });
  const caller = await getAuthedUser(req);
  if (!caller) return res.status(401).json({ error: "Authentification requise." });
  if (!isSupabaseConfigured || !supabase) return res.status(500).json({ error: "Database not configured on server." });
  try {
    const r = await confirmDelivery(
      { db: supabase, payout: (order: any) => executeVendorPayout(order) },
      { orderId, callerId: caller.id, code }
    );
    return res.status(r.status).json(r.body);
  } catch (err: any) {
    console.error('[Confirm Delivery Exception]', err.message);
    return res.status(500).json({ error: err.message || 'Erreur interne.' });
  }
});

app.post('/api/orders/pending', async (req, res) => {
  const {
    reference_id,
    buyer_id,
    vendor_id,
    items: clientItems,
    total_price: clientTotal,
    shipping_fee: clientShipping,
    delivery_commune,
    delivery_address,
    promo_code
  } = req.body;
  let items = clientItems;
  let total_price = clientTotal;
  let shipping_fee = clientShipping;
  let discount_amount = 0;

  if (!reference_id) {
    return res.status(400).json({ error: "reference_id est manquant" });
  }

  // SÉCURITÉ : seul l'acheteur connecté peut déclarer SA commande en attente (plus d'usurpation de buyer_id)
  {
    const caller = await getAuthedUser(req);
    if (!caller) return res.status(401).json({ error: "Authentification requise." });
    if (String(buyer_id || '') !== caller.id) return res.status(403).json({ error: "buyer_id doit correspondre à l'utilisateur connecté." });

    // MONTANTS FIXÉS PAR LE SERVEUR : prix en base, frais de livraison du vendeur, promotion validée, stock vérifié.
    // Ce que le navigateur envoie comme total ou comme prix n'est plus utilisé.
    if (isSupabaseConfigured && supabase && Array.isArray(items) && items.length > 0 && isValidUuid(String(vendor_id || ''))) {
      const idOf = (it: any) => String(it?.productId || it?.product_id || it?.id || '');
      const ids = [...new Set(items.map(idOf).filter((v: string) => isValidUuid(v)))];
      if (ids.length !== new Set(items.map(idOf)).size) return res.status(400).json({ error: "Un produit de votre panier est invalide. Rechargez la page." });
      const [{ data: prods, error: prodErr }, { data: shop }] = await Promise.all([
        supabase.from('products').select('id, name, price, stock, vendor_id, is_active, status').in('id', ids),
        supabase.from('shops').select('shipping_fee_default, shipping_fees').eq('vendor_id', vendor_id).maybeSingle()
      ]);
      if (prodErr) return res.status(503).json({ error: "Vérification des prix impossible pour le moment. Réessayez dans un instant." });
      const products = new Map<string, DbProduct>((prods || []).map((pr: any) => [String(pr.id), pr as DbProduct]));
      const dept = String(req.body.delivery_departement || req.body.departement || delivery_address || '').trim();
      const fee = resolveShippingFee(shop as any, dept, String(delivery_commune || '').trim());
      const priced = priceVendorOrder({ items, products, vendorId: String(vendor_id), shippingFee: fee, promoPct: promoPercent(promo_code) });
      if (priced.ok === false) {
        console.warn(`[Pending Order Reject] ${priced.error} (buyer ${caller.id}, ref ${reference_id})`);
        return res.status(400).json({ error: priced.error });
      }
      items = priced.items;
      total_price = priced.total;
      shipping_fee = priced.shipping;
      discount_amount = priced.discount;
    } else if (isValidUuid(String(vendor_id || ''))) {
      return res.status(400).json({ error: "Commande invalide : aucun produit." });
    }
    // vendeur invalide : traité juste en dessous (enregistré pour vérification manuelle)
  }

  // 1. Validate vendor_id and buyer_id are valid UUIDs
  const isValidVendor = isValidUuid(vendor_id);
  const isValidBuyer = isValidUuid(buyer_id);

  if (!isValidVendor || !isValidBuyer) {
    // Logger une erreur explicite et visible (pas juste un warning silencieux)
    console.error("======================================================================");
    console.error("[CRITICAL ERROR] Invalid UUID fields detected for pending order!");
    console.error(`Reference ID: ${reference_id}`);
    console.error(`Buyer ID: ${buyer_id} (Valid: ${isValidBuyer})`);
    console.error(`Vendor ID: ${vendor_id} (Valid: ${isValidVendor})`);
    if (items && Array.isArray(items)) {
      console.error("Cart items details:");
      items.forEach((item, index) => {
        console.error(`  Item ${index + 1}: ID=${item.productId || item.id}, Name=${item.productNom || item.name || 'Unknown'}, VendorID=${item.vendeurId || 'N/A'}`);
      });
    } else {
      console.error(`Items data: ${JSON.stringify(items)}`);
    }
    console.error("======================================================================");

    // Sauvegarder quand même les détails complets de la tentative dans la table orphaned_payments
    const orphanedPayload: any = {
      id: `orph-${reference_id.split('-')[1] || Date.now().toString().slice(-4)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      order_id: reference_id,
      buyer_id: isValidBuyer ? buyer_id : null,
      vendor_id: isValidVendor ? vendor_id : null,
      amount: Number(total_price) || 0,
      payment_method: 'moncash',
      transaction_id: reference_id,
      status: 'invalid_vendor_id',
      payload_details: JSON.stringify({
        reference_id,
        buyer_id,
        vendor_id,
        items,
        total_price,
        shipping_fee,
        delivery_commune,
        delivery_address,
        error_type: 'invalid_uuid_fields_pending_orders',
        invalid_buyer_id: !isValidBuyer ? buyer_id : undefined,
        invalid_vendor_id: !isValidVendor ? vendor_id : undefined
      }),
      created_at: new Date().toISOString()
    };

    saveOrphanedPayment(orphanedPayload);

    if (isSupabaseConfigured && supabase) {
      const payloadOrphCopy = { ...orphanedPayload };
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const { error: orphError } = await supabase
            .from('orphaned_payments')
            .insert([payloadOrphCopy]);
          if (!orphError) {
            console.log('[Orphaned API] Saved invalid pending order UUID error successfully in Supabase: orphaned_payments');
            break;
          }
          const errMsg = orphError.message || '';
          const matchCol = errMsg.match(/column "([^"]+)"/i);
          if (matchCol && matchCol[1]) {
            delete payloadOrphCopy[matchCol[1]];
          } else {
            console.error('[Orphaned API Error] Failed saving UUID error to DB:', orphError.message);
            break;
          }
        } catch (e: any) {
          console.error('[Orphaned API Exception]', e.message);
          break;
        }
      }
    }

    // Renvoyer une erreur claire au frontend (pas de détail technique)
    return res.status(400).json({
      success: false,
      error: "Une erreur est survenue avec ce produit, veuillez réessayer ou contacter le support"
    });
  }

  // Define pending order payload
  const pendingPayload = {
    reference_id,
    buyer_id,
    vendor_id,
    items,
    total_price: Number(total_price) || 0,
    shipping_fee: Number(shipping_fee) || 0,
    discount: discount_amount,
    checkout_group_id: String(req.body.checkout_group_id || reference_id),
    delivery_commune: delivery_commune || '',
    delivery_address: delivery_address || '',
    created_at: new Date().toISOString()
  };

  try {
    console.log(`[Pending Order Server] Registering pending order: ${reference_id} for buyer: ${buyer_id}`);
    
    let isSavedInSupabase = false;
    let supabaseErrorMsg = '';
    let savedData = null;

    if (isSupabaseConfigured && supabase) {
      // First, let's delete any existing pending order with this reference ID to avoid unique-constraint collisions
      await supabase
        .from('pending_orders')
        .delete()
        .eq('reference_id', reference_id);

      // Insert new pending order using the server client which bypasses Row-Level Security
      const { data, error } = await supabase
        .from('pending_orders')
        .insert([pendingPayload])
        .select()
        .maybeSingle();

      if (error) {
        supabaseErrorMsg = error.message;
        console.error('[Pending Order Server] Error inserting pending order into Supabase:', error.message);
      } else {
        isSavedInSupabase = true;
        savedData = data;
        console.log(`[Pending Order Server] Successfully created pending order in database: ${reference_id}`);
      }
    } else {
      supabaseErrorMsg = "Supabase is not configured";
    }

    if (!isSavedInSupabase) {
      // N'appelle saveLocalPendingOrder QUE si l'insertion Supabase a réellement échoué
      console.warn(`[Pending Order Server] [FALLBACK WARNING] Supabase pending order insertion failed. Falling back to local file storage as last resort. Reason: ${supabaseErrorMsg}`);
      saveLocalPendingOrder(pendingPayload);

      return res.json({
        success: true,
        source: 'local_fallback',
        warning: supabaseErrorMsg,
        data: pendingPayload
      });
    }

    return res.json({
      success: true,
      source: 'supabase',
      data: savedData
    });
  } catch (err: any) {
    console.error('[Pending Order Server] Unexpected exception:', err.message);
    // N'appelle saveLocalPendingOrder QUE si l'insertion Supabase a réellement échoué
    console.warn(`[Pending Order Server] [FALLBACK WARNING] Exception during Supabase insert. Saving to local file storage as last resort: ${err.message}`);
    saveLocalPendingOrder(pendingPayload);

    return res.json({
      success: true,
      source: 'local_fallback',
      warning: err.message,
      data: pendingPayload
    });
  }
});



// Endpoint serving the interactive mock Stripe Simulation screen
app.get('/stripe-simulation', (req, res) => {
  if (process.env.ALLOW_STRIPE_SIMULATION !== 'true') return res.status(404).send('Not found');
  const { orderId, totalUSD, customerEmail } = req.query;
  const cleanOrderId = String(orderId || 'order-unknown');
  const cleanTotalUSD = String(totalUSD || '0.00');
  const cleanEmail = String(customerEmail || 'demo@vendza-buyer.com');

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stripe Checkout - Passerelle de Paiement Sécurisée</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc;
        }
    </style>
</head>
<body class="min-h-screen bg-slate-50 flex flex-col md:flex-row items-stretch">
    <!-- Left panel (Session details / Order Summary) -->
    <div class="w-full md:w-[45%] bg-white p-8 md:p-14 border-r border-slate-100 flex flex-col justify-between">
        <div>
            <!-- Stripe style minimalist back link -->
            <a href="/paiement/annule" class="text-slate-400 hover:text-slate-600 transition text-xs font-medium flex items-center gap-1.5 mb-10">
                ← Retourner chez Vendza
            </a>

            <!-- Logo and Merchant Name -->
            <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md shadow-indigo-100 font-serif">V</div>
                <div>
                    <h2 class="font-bold text-slate-800 text-sm">Vendza S.A.</h2>
                    <p class="text-[10.5px] text-slate-400 font-medium">Séquestre Mobile Haïti</p>
                </div>
            </div>

            <!-- Amount Section -->
            <div class="space-y-1">
                <span class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Payer Vendza</span>
                <div class="flex items-baseline gap-1.5">
                    <span class="text-4xl font-extrabold text-slate-900 tracking-tight">$${cleanTotalUSD}</span>
                    <span class="text-slate-400 font-bold text-sm">USD</span>
                </div>
                <div class="text-[11px] font-medium text-[#10b981] bg-emerald-50 inline-block px-2.5 py-0.5 rounded-full border border-emerald-100 mt-1">
                    Séquestre Actif • Taux 1 USD ≈ 130 HTG
                </div>
            </div>

            <!-- Order Lines -->
            <div class="mt-12 space-y-4">
                <div class="flex justify-between text-xs pb-3 border-b border-slate-100 text-slate-500 font-medium">
                    <span>Référence de commande</span>
                    <span class="font-mono text-slate-900 font-bold">${cleanOrderId}</span>
                </div>
                <div class="flex justify-between text-xs pb-3 border-b border-slate-100 text-slate-500 font-medium">
                    <span>Mode de Facturation</span>
                    <span class="text-slate-900">Carte de Crédit (Visa/Mastercard)</span>
                </div>
            </div>
        </div>

        <div class="pt-8 md:pt-0">
            <div class="flex items-center gap-2 text-[10.5px] text-slate-400">
                <span class="bg-indigo-600 text-white px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider font-sans">stripe</span>
                <span>Alimenté par Stripe • Simulateur d'essai Vendza</span>
            </div>
        </div>
    </div>

    <!-- Right panel (Secure Payment Fields) -->
    <div class="w-full md:w-[55%] p-8 md:p-24 flex items-center justify-center">
        <div class="w-full max-w-md space-y-8">
            <div class="space-y-1.5">
                <h3 class="text-lg font-bold text-slate-800 tracking-tight">Paiement par carte</h3>
                <p class="text-xs text-slate-400 leading-relaxed">Veuillez renseigner vos coordonnées bancaires fictives pour simuler un paiement par carte avec succès.</p>
            </div>

            <!-- Simulation Banner -->
            <div class="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-900 space-y-1">
                <p class="font-bold flex items-center gap-1 text-indigo-900">
                    💳 Version de démonstration Stripe
                </p>
                <p class="leading-relaxed text-indigo-800/90 text-[11px]">Notre passerelle locale simule instantanément l'API de Stripe. Vous pouvez utiliser n'importe quel numéro de carte de test pour valider l'achat.</p>
            </div>

            <!-- Card Form fields -->
            <div class="space-y-4">
                <div>
                    <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Adresse de messagerie (E-mail)</label>
                    <input type="email" value="${cleanEmail}" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="vous@exemple.com" />
                </div>

                <div>
                    <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Informations de carte</label>
                    <div class="bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                        <!-- Card number input -->
                        <div class="relative flex items-center px-4 py-3 border-b border-slate-200">
                            <span class="text-lg mr-2">💳</span>
                            <input type="text" value="4242 4242 4242 4242" class="w-full bg-transparent text-xs font-mono font-bold text-slate-700 outline-none" placeholder="Numéro de carte" />
                        </div>
                        <!-- Expiration and CVV -->
                        <div class="flex">
                            <input type="text" value="12/29" class="w-1/2 px-4 py-3 border-r border-slate-200 bg-transparent text-xs font-mono font-bold text-slate-700 outline-none" placeholder="MM / AA" />
                            <input type="password" value="123" class="w-1/2 px-4 py-3 bg-transparent text-xs font-mono font-semibold text-slate-700 outline-none" placeholder="CVC" />
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nom sur la carte</label>
                    <input type="text" value="Demo User" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Nom complet sur la carte" />
                </div>
            </div>

            <!-- Action calls -->
            <div class="space-y-3 pt-4">
                <button onclick="triggerStripePayment('success')" class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-xs tracking-wider uppercase transition shadow-md hover:shadow-lg cursor-pointer transform hover:scale-[1.01] flex items-center justify-center gap-1.5">
                    ✓ Payer $${cleanTotalUSD} USD
                </button>
                <button onclick="triggerStripePayment('cancel')" class="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center">
                    Annuler et retourner au panier
                </button>
            </div>
        </div>
    </div>

    <script>
        function triggerStripePayment(status) {
            const orderId = "${encodeURIComponent(cleanOrderId)}";
            if (status === 'success') {
                const sessionId = "stripe-sim-session-id_" + orderId;
                window.location.href = "/paiement/succes?session_id=" + sessionId + "&orderId=" + orderId;
            } else {
                window.location.href = "/paiement/annule";
            }
        }
    </script>
</body>
</html>
  `;
  res.send(html);
});

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  const { orderId, items, customerEmail, type, referenceId, planCode, billing, userId, successUrl, cancelUrl } = req.body;
  const isSubscriptionReq = type === 'subscription';
  if (!isSubscriptionReq && (!items || !Array.isArray(items))) {
    return res.status(400).json({ error: "Missing required fields: items" });
  }
  const itemsSafe: any[] = Array.isArray(items) ? items : [];

  // Abonnement : utilisateur = jeton de connexion, forfait/durée validés, prix = grille serveur (rien n'est repris du navigateur)
  let subServer: { userId: string; email?: string; plan: string; billing: string; priceHtg: number; ref: string } | null = null;
  if (isSubscriptionReq) {
    const authed = await getAuthedUser(req);
    if (!authed) return res.status(401).json({ error: "Connexion requise pour souscrire à un abonnement." });
    const plan = normalizePlan(planCode);
    const bill = normalizeBilling(billing);
    if (!plan || !bill) return res.status(400).json({ error: "Forfait ou durée d'abonnement invalide." });
    subServer = { userId: authed.id, email: authed.email, plan, billing: bill, priceHtg: planPriceHtg(plan, bill), ref: newSubscriptionRef(authed.id) };
  }

  const cleanOrderId = subServer ? subServer.ref : (orderId || referenceId || 'pending_payment');
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  // Fetch exchange rate to convert HTG prices to USD
  let currentRate = 130;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from('exchange_rates')
        .select('usd_to_htg')
        .maybeSingle();
      if (data && data.usd_to_htg) {
        currentRate = Number(data.usd_to_htg);
      }
    } catch (rateErr) {
      console.warn('[Stripe Backend] Could not read exchange rate from DB, using fallback of 130:', rateErr);
    }
  }

  // Commande : montants fixés par le serveur (une ligne par vendeur, livraison comprise)
  let serverLines: Array<{ name: string; cents: number }> | null = null;
  if (subServer) {
    serverLines = [{ name: `Abonnement Vendza — ${subServer.plan === 'pro_national' ? 'Pro National' : 'Pro Local'} (${subServer.billing === 'annuel' ? 'annuel' : 'mensuel'})`, cents: usdCents(subServer.priceHtg, currentRate) }];
  } else if (type !== 'subscription') {
    const group = await getGroupPendingOrders(String(cleanOrderId));
    if (!group.length) return res.status(404).json({ error: "Commande introuvable ou expirée. Retournez au panier et réessayez." });
    const names = new Map<string, string>();
    try {
      const { data: shops } = await supabase!.from('shops').select('vendor_id, shop_name').in('vendor_id', group.map((g: any) => g.vendor_id));
      (shops || []).forEach((sh: any) => names.set(String(sh.vendor_id), String(sh.shop_name || '').trim()));
    } catch (_) {}
    serverLines = group.map((g: any) => ({ name: `Commande Vendza — ${names.get(String(g.vendor_id)) || 'Boutique'}`, cents: usdCents(Number(g.total_price) || 0, currentRate) }));
  }

  // Calculate order total in USD
  let totalUSD = itemsSafe.reduce((acc, item) => {
    const price = item.product ? Number(item.product.prix) : Number(item.price);
    const qty = item.quantity || 1;
    return acc + (price / currentRate) * qty;
  }, 0);

  if (serverLines) totalUSD = serverLines.reduce((acc, l) => acc + l.cents / 100, 0);

  if (!stripeSecretKey && process.env.ALLOW_STRIPE_SIMULATION !== 'true') {
    console.error("[Stripe Backend ERROR] STRIPE_SECRET_KEY manquante : paiement par carte indisponible (simulation désactivée).");
    return res.status(503).json({ error: "Le paiement par carte est momentanément indisponible. Utilisez MonCash ou réessayez plus tard." });
  }
  if (!stripeSecretKey) {
    console.error("[Stripe Backend ERROR] STRIPE_SECRET_KEY is missing. Falling back to interactive Stripe Simulation (ALLOW_STRIPE_SIMULATION=true)...");
    const simulationUrl = `${baseUrl}/stripe-simulation?orderId=${encodeURIComponent(cleanOrderId)}&totalUSD=${encodeURIComponent(totalUSD.toFixed(2))}&customerEmail=${encodeURIComponent(customerEmail || '')}`;
    return res.json({ url: simulationUrl });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-05-27.dahlia' as any
    });

    console.log(`[Stripe Backend] Creating session, converting prices to USD basis... Type=${type || 'order'}`);

    const isSub = !!subServer;
    // Adresses de retour fixées par le serveur (plus d'adresse fournie par le navigateur)
    const actualSuccessUrl = subServer
      ? `${baseUrl}/paiement/abonnement/succes?referenceId=${encodeURIComponent(subServer.ref)}&plan=${subServer.plan}&billing=${subServer.billing}&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}/paiement/succes?session_id={CHECKOUT_SESSION_ID}`;
    const actualCancelUrl = subServer ? `${baseUrl}` : `${baseUrl}/paiement/annule`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: (subServer?.email || customerEmail) || undefined,
      line_items: serverLines ? serverLines.map(l => ({ price_data: { currency: 'usd', product_data: { name: l.name }, unit_amount: l.cents }, quantity: 1 })) : itemsSafe.map(item => {
        // Handle cart item format: { product: { nom, prix, image_url }, quantity }
        if (item.product) {
          return {
            price_data: {
              currency: 'usd',
              product_data: {
                name: item.product.nom || 'Produit Vendza',
                images: item.product.image_url && item.product.image_url.startsWith('https://') 
                  ? [item.product.image_url] 
                  : [],
              },
              unit_amount: Math.round((Number(item.product.prix) / currentRate) * 100),
            },
            quantity: item.quantity || 1,
          };
        }
        // Handle flat item format: { name, price, quantity, image_url }
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name || 'Produit Vendza',
              images: item.image_url && item.image_url.startsWith('https://') 
                ? [item.image_url] 
                : [],
            },
            unit_amount: Math.round((Number(item.price) / currentRate) * 100),
          },
          quantity: item.quantity || 1,
        };
      }),
      mode: 'payment',
      metadata: subServer ? {
        orderId: subServer.ref,
        source: 'vendza',
        type: 'subscription',
        planCode: subServer.plan,
        billing: subServer.billing,
        userId: subServer.userId,
        expectedHtg: String(subServer.priceHtg)
      } : {
        orderId: orderId || referenceId || 'pending_payment',
        source: 'vendza',
        type: type || 'order',
        planCode: planCode || '',
        billing: billing || '',
        userId: userId || ''
      },
      success_url: actualSuccessUrl,
      cancel_url: actualCancelUrl,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("[Stripe Backend] Error creating session:", error.message);
    res.status(500).json({ error: error.message || "Failed to create Stripe checkout session" });
  }
});

// Endpoint verifying Stripe session status by session ID
app.post('/api/stripe/verify-session', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: "Missing required field: sessionId" });
  }

  // Handle local stripe simulator verification
  if (sessionId.startsWith('stripe-sim-') && process.env.ALLOW_STRIPE_SIMULATION !== 'true') {
    console.warn('[SÉCURITÉ] Tentative de validation par fausse session Stripe refusée.');
    return res.status(400).json({ error: 'Session de paiement invalide.' });
  }
  if (sessionId.startsWith('stripe-sim-')) {
    const orderId = sessionId.split('_')[1];
    if (orderId) {
      console.log(`[Stripe Simulation Verification] Session paid! Finalizing simulated order in database: ${orderId}`);
      await creerCommandeApresPaiement(orderId, 'stripe', sessionId);
    }
    return res.json({
      paid: true,
      amount: 1000,
      customerEmail: 'customer@vendza-simulation.com'
    });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeSecretKey) {
    return res.status(500).json({ error: "Stripe features are not configured: STRIPE_SECRET_KEY is missing." });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-05-27.dahlia' as any
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Call activation or order creation if Stripe session is fully paid to ensure database registration
    if (session.payment_status === 'paid') {
      const orderId = session.metadata?.orderId;
      const type = session.metadata?.type;
      
      if (type === 'subscription') {
        // Activation seulement si le montant réellement payé couvre le prix du forfait (taux de change : 10 % de tolérance)
        const paidHtg = stripePaidHtg(session.amount_total, await getUsdRate());
        console.log(`[Stripe Verification Proxy Subscription] Session payée, vérification du montant (${paidHtg} HTG)…`);
        await activateSubscriptionFromPayment({
          userId: session.metadata?.userId, planCode: session.metadata?.planCode, billing: session.metadata?.billing,
          method: 'stripe', paidHtg, tolerancePct: 10, reference: session.id
        });
      } else if (orderId) {
        console.log(`[Stripe Verification Proxy] Session paid! Finalizing order inside database securely: ${orderId}`);
        await creerCommandeApresPaiement(orderId, 'stripe', session.id);
      }
    }

    res.json({
      paid: session.payment_status === 'paid',
      amount: session.amount_total,
      customerEmail: session.customer_email
    });
  } catch (error: any) {
    console.error("[Stripe Backend Verify Error]", error.message);
    res.status(500).json({ error: error.message || "Failed to verify session" });
  }
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req: any, res) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  if (!stripeSecretKey) {
    return res.status(500).send("Stripe not configured on server.");
  }

  let event;
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-05-27.dahlia' as any
  });

  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else if (isProduction() && !allowUnsignedWebhooks()) {
      console.error("[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET or stripe-signature header in production. Rejecting.");
      return res.status(400).send("Webhook signature required");
    } else {
      console.warn("[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET or stripe-signature header, parsing request payload directly in fallback mode");
      const bodyString = req.body && Buffer.isBuffer(req.body) ? (req.body as Buffer).toString('utf8') : JSON.stringify(req.body);
      event = JSON.parse(bodyString);
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error verifying signature:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const orderId = session.metadata?.orderId;
    const type = session.metadata?.type;

    if (type === 'subscription') {
      if (session.payment_status && session.payment_status !== 'paid') {
        console.warn(`[Stripe Webhook Subscription] Session ${session.id} non payée (${session.payment_status}) : rien à activer.`);
      } else {
        const paidHtg = stripePaidHtg(session.amount_total, await getUsdRate());
        await activateSubscriptionFromPayment({
          userId: session.metadata?.userId, planCode: session.metadata?.planCode, billing: session.metadata?.billing,
          method: 'stripe', paidHtg, tolerancePct: 10, reference: session.id
        });
      }
    } else if (orderId) {
      console.log(`[Stripe Webhook] Verified success for order ${orderId}. Session ID: ${session.id}`);
      await creerCommandeApresPaiement(orderId, 'stripe', session.id);
    }
  }

  res.json({ received: true });
});

const SITE_ORIGIN = (process.env.SITE_URL || 'https://www.vendza.store').replace(/\/$/, '');
if (supabase) registerSellerexRoutes(app, { supabase, getAuthedUser });
// Page admin « Paiements » (remboursements, virements en attente, export, journal) : réservée à public.is_admin().
if (supabase) registerAdminPaymentsRoutes(app, {
  supabase, getAuthedUser,
  makeUserClient: (token: string) => createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
  }),
});
if (supabase) {
  // Pages SEO de Vendza (accueil avec catalogue, produits, sitemap…) : jamais servies sur sellerex.*,
  // sinon le catalogue Vendza s'y afficherait (et serait lu par les robots) à la place de l'application Sellerex.
  const seoRouter = express.Router();
  registerSeoRoutes(seoRouter as any, supabase);
  app.use((req, res, next) => (isSellerexHostname(req.hostname) ? next() : seoRouter(req, res, next)));
}

// Helper to escape HTML safely for meta values
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 2. MIDDLEWARE TO CAPTURE PRODUCT SHARES AND INJECT REAL-TIME OPENGRAPH META TAGS
app.get('*', async (req, res, next) => {
  const prodId = req.query.product || req.query.p || req.query.id;
  
  // If no product queried, standard SPA routing takes over
  if (!prodId) {
    return next();
  }

  // Fetch product information to construct rich dynamic preview card
  let product: any = null;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', prodId)
        .maybeSingle();

      if (!error && data) {
        product = {
          id: data.id,
          nom: data.nom || data.name || data.title || 'Article Vendza',
          desc: data.desc || data.description || 'Venez découvrir cet article exclusif sur la marketplace Vendza.',
          prix: Number(data.prix || data.price || 0),
          image: data.image || data.image_url || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1200&h=630&q=80'
        };
      }
    } catch (e) {
      console.warn("Failed fetching metadata product:", e);
    }
  }

  if (!product) {
    product = FALLBACK_PRODUCTS.find(p => p.id === prodId);
  }

  // If there is a product matches the query, we inject details dynamically
  if (product) {
    try {
      const isProd = process.env.NODE_ENV === 'production';
      const htmlFileName = 'index.html';

      // Check all potential paths for the HTML template
      const pathsToTry = [
        isProd ? path.join(process.cwd(), 'dist', htmlFileName) : path.join(process.cwd(), htmlFileName)
      ];

      let indexPath = '';
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          indexPath = p;
          break;
        }
      }

      if (indexPath) {
        let html = fs.readFileSync(indexPath, 'utf-8');

        const pName = escapeHtml(product.nom);
        const pDesc = escapeHtml(product.desc.substring(0, 160) + (product.desc.length > 160 ? '...' : ''));
        const pPrice = `${product.prix.toLocaleString('fr-FR')} Gdes`;
        const pImage = product.image;
        const pUrl = `${SITE_ORIGIN}${productPath({ id: String(product.id), name: String(product.nom) })}`;

        const fullTitle = `${pName} | ${pPrice} sur Vendza`;
        const fullDesc = `${pDesc} - Achetez sereinement avec notre modèle sécurisé de séquestre de fonds à Haïti.`;

        // Perform fast injections over meta tags supporting standard and self-closing styles
        html = html.replace(/<title>.*?<\/title>/, `<title>${fullTitle}</title>`);
        html = html.replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${fullDesc}" />`);

        html = html.replace(/<link rel="canonical" href=".*?"\s*\/?>/, `<link rel="canonical" href="${pUrl}" />`);

        // OG replacements
        html = html.replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${fullTitle}" />`);
        html = html.replace(/<meta property="og:description" content=".*?"\s*\/?>/, `<meta property="og:description" content="${fullDesc}" />`);
        html = html.replace(/<meta property="og:image" content=".*?"\s*\/?>/, `<meta property="og:image" content="${pImage}" />`);
        html = html.replace(/<meta property="og:url" content=".*?"\s*\/?>/, `<meta property="og:url" content="${pUrl}" />`);

        // Twitter Card replacements
        html = html.replace(/<meta property="twitter:title" content=".*?"\s*\/?>/, `<meta property="twitter:title" content="${fullTitle}" />`);
        html = html.replace(/<meta property="twitter:description" content=".*?"\s*\/?>/, `<meta property="twitter:description" content="${fullDesc}" />`);
        html = html.replace(/<meta property="twitter:image" content=".*?"\s*\/?>/, `<meta property="twitter:image" content="${pImage}" />`);
        html = html.replace(/<meta name="twitter:title" content=".*?"\s*\/?>/, `<meta name="twitter:title" content="${fullTitle}" />`);
        html = html.replace(/<meta name="twitter:description" content=".*?"\s*\/?>/, `<meta name="twitter:description" content="${fullDesc}" />`);
        html = html.replace(/<meta name="twitter:image" content=".*?"\s*\/?>/, `<meta name="twitter:image" content="${pImage}" />`);

        return res.send(html);
      }
    } catch (err) {
      console.error("Error doing metadata injection:", err);
    }
  }

  next();
});

// ============================================
// SIGHTENGINE IMAGE MODERATION API PROXY
// ============================================
// Limite de débit en mémoire : 20 analyses / 10 min / utilisateur (chaque appel coûte des crédits Sightengine)
const moderationHits = new Map<string, number[]>();
function moderationRateLimited(userId: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const recent = (moderationHits.get(userId) || []).filter(t => now - t < windowMs);
  if (recent.length >= 20) {
    moderationHits.set(userId, recent);
    return true;
  }
  recent.push(now);
  moderationHits.set(userId, recent);
  if (moderationHits.size > 5000) {
    for (const [k, v] of moderationHits) if (!v.some(t => now - t < windowMs)) moderationHits.delete(k);
  }
  return false;
}

app.post('/api/moderate-image', async (req, res) => {
  // SÉCURITÉ : réservé aux utilisateurs connectés + limite de débit (évite la consommation abusive du quota IA)
  const caller = await getAuthedUser(req);
  if (!caller) return res.status(401).json({ error: "Authentification requise." });
  if (moderationRateLimited(caller.id)) {
    return res.status(429).json({ error: "Trop d'analyses d'images. Réessayez dans quelques minutes." });
  }
  const { imageUrl, imageBase64 } = req.body;
  try {
    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;

    if (!apiUser || !apiSecret) {
      const errMsg = "Les clés d'API Sightengine (SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET) ne sont pas configurées.";
      console.error("[Vendza Sightengine Config Error]", errMsg);
      return res.status(500).json({ error: errMsg });
    }

    const formData = new FormData();
    formData.append('api_user', apiUser);
    formData.append('api_secret', apiSecret);
    formData.append('models', 'properties,type');

    if (imageUrl && !imageUrl.startsWith('data:')) {
      formData.append('url', imageUrl);
    } else if (imageBase64) {
      const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Clean, 'base64');
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      formData.append('media', blob, 'image.jpg');
    } else {
      return res.status(400).json({ error: "Aucun URL ou Base64 d'image fourni." });
    }

    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Sightengine response status: ${response.status}`);
    }

    const json: any = await response.json();
    if (json.status !== 'success') {
      throw new Error(json.error?.message || "Sightengine returned error status.");
    }

    const sharpness = json.properties?.sharpness ?? 50;
    const contrast = json.properties?.contrast ?? 1.0;
    const brightness = json.properties?.brightness ?? 0.5;
    const illustrationScore = json.type?.illustration ?? 0.0;
    const photoScore = json.type?.photo ?? 1.0;

    const isBlurry = sharpness < 20;
    const isIllustration = illustrationScore > 0.5;
    const shouldLowerSeo = isBlurry || isIllustration;

    let warning = "";
    if (isBlurry) {
      warning += "L'image de votre produit est trop floue (netteté insuffisante).";
    }
    if (isIllustration) {
      if (warning) warning += " De plus, ";
      warning += "le type d'image détecté est une illustration ou un dessin non-physique.";
    }

    return res.json({
      status: "success",
      sharpness,
      contrast,
      brightness,
      illustrationScore,
      photoScore,
      warning: shouldLowerSeo ? warning : undefined,
      shouldLowerSeo
    });
  } catch (err: any) {
    console.error("Error with Sightengine moderation API:", err.message);
    return res.status(500).json({ error: "Erreur lors de la modération de l'image: " + err.message });
  }
});

// Envoi groupé (jusqu'à 1000 destinataires par appel) — campagnes Ventes Flash / suggestions
async function sendOneSignalPushMany(userIds: string[], title: string, message: string, category: string) {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!apiKey || userIds.length === 0) return null;
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
    body: JSON.stringify({
      app_id: '75a4d965-5500-4694-abfa-69b8a88c9d1d',
      contents: { fr: message, en: message },
      headings: { fr: title, en: title },
      chrome_web_badge: NOTIF_BADGE_URL,
      chrome_web_icon: NOTIF_ICON_URL,
      target_channel: 'push',
      data: { category },
      include_aliases: { external_id: userIds }
    })
  });
  const data: any = await response.json();
  console.log('[sendOneSignalPushMany]', userIds.length, 'destinataires ->', JSON.stringify(data).slice(0, 300));
  return data;
}

// Tâches planifiées (appelées par pg_cron via /api/internal/cron/run, + filet de sécurité interne)
async function cronSecretOk(provided: string | undefined): Promise<boolean> {
  if (!supabase || !provided) return false;
  const { data } = await supabase.from('internal_secrets').select('value').eq('name', 'cron').maybeSingle();
  const expected = data?.value;
  if (!expected) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function runCampaign(task: string) {
  if (!supabase) throw new Error('Supabase non configuré');
  if (task === 'flash-sale') return runFlashSale(supabase, sendOneSignalPushMany);
  if (task === 'recommendations') return runRecommendations(supabase, sendOneSignalPushMany);
  if (task === 'cart-reminders') return runCartReminders(supabase, sendOneSignalPushMany);
  if (task === 'low-stock') return runLowStockAlerts(supabase, sendOneSignalPushMany);
  if (task === 'escrow-release') return runEscrowAutoRelease({ db: supabase, send: sendOneSignalPushMany, payout: (order: any) => executeVendorPayout(order) });
  if (task === 'indexnow') return runIndexNow(supabase, false);
  if (task === 'indexnow-all') return runIndexNow(supabase, true);
  throw new Error('Tâche inconnue');
}

app.post('/api/internal/cron/run', async (req, res) => {
  try {
    if (!(await cronSecretOk(req.header('x-cron-secret')))) return res.status(401).json({ error: 'Non autorisé' });
    const task = String(req.query.task || '');
    if (!['flash-sale', 'recommendations', 'cart-reminders', 'low-stock', 'escrow-release', 'indexnow', 'indexnow-all'].includes(task)) return res.status(400).json({ error: 'task invalide' });
    const result = await runCampaign(task);
    console.log('[cron]', task, JSON.stringify(result));
    return res.json(result);
  } catch (err: any) {
    console.error('[cron] échec:', err?.message);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// Filet de sécurité si le serveur est réveillé : idempotent grâce à notification_log
setInterval(() => {
  runCampaign('flash-sale').catch(e => console.warn('[cron-local] flash-sale:', e?.message));
  if (haitiClock(new Date()).hour === 17) runCampaign('recommendations').catch(e => console.warn('[cron-local] reco:', e?.message));
}, 15 * 60 * 1000);

// ============================================
// ONESIGNAL MULTI-USER NOTIFICATION PROXY
// ============================================

async function sendOneSignalPush(recipientId: string, title: string, message: string, category?: string) {
  try {
    const apiAppId = '75a4d965-5500-4694-abfa-69b8a88c9d1d';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!apiKey) {
      console.error("[sendOneSignalPush] ONESIGNAL_REST_API_KEY is not configured.");
      return null;
    }

    const cleanUrl = supabaseUrl ? supabaseUrl.replace(/\/$/, '') : 'https://giakjeanwekipnvyhlxm.supabase.co';
    const badgeUrl = NOTIF_BADGE_URL;

    const payload = {
      app_id: apiAppId,
      contents: {
        fr: message,
        en: message
      },
      headings: {
        fr: title,
        en: title
      },
      chrome_web_badge: badgeUrl,
            chrome_web_icon: NOTIF_ICON_URL,
      target_channel: "push",
      data: {
        category: category || 'order'
      },
      include_external_user_ids: [recipientId],
      include_aliases: {
        external_id: [recipientId]
      }
    };

    console.log("[sendOneSignalPush] Transmitting notification:", JSON.stringify(payload));

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("[sendOneSignalPush] Response:", data);

    if (data && data.errors) {
      const errStr = JSON.stringify(data.errors);
      if (errStr.includes('invalid_aliases') || errStr.includes('all_participants_unsubscribed')) {
        console.warn("[sendOneSignalPush] Gracefully swallowed expected OneSignal alias mismatch (recipient is not subscribed yet).");
        return { success: true, status: "ignored_not_subscribed" };
      }
    }
    return data;
  } catch (err: any) {
    console.error("[sendOneSignalPush] Failed sending notification:", err.message);
    throw err;
  }
}

app.post('/api/onesignal/send', async (req, res) => {
  const { recipientId, title, message, category } = req.body;
  if (!(await getAuthedUser(req))) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  try {
    const data = await sendOneSignalPush(recipientId, title, message, category);
    return res.json(data || { status: "sent" });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to send notification: " + err.message });
  }
});

// ============================================
// AUTOMATIC FOLLOWER NOTIFICATIONS ENDPOINTS
// ============================================

app.post('/api/notifications/new-product', async (req, res) => {
  const { vendorId, vendorShopName, productNom, productPrix, productCommune, productDept } = req.body;
  {
    const caller = await getAuthedUser(req);
    if (!caller) return res.status(401).json({ error: "Authentification requise." });
    if (String(req.body.vendorId || '') !== caller.id) return res.status(403).json({ error: "Accès refusé." });
  }
  
  if (!isSupabaseConfigured || !supabase) {
    return res.status(400).json({ error: "Supabase n'est pas configuré sur le serveur." });
  }

  try {
    // Query followers having notify_new_products enabled
    const { data: followers, error } = await supabase
      .from('vendor_follows')
      .select('follower_id')
      .eq('vendor_id', vendorId)
      .eq('notify_new_products', true);

    if (error) {
      console.error("[New Product Notifications] Error fetching followers:", error);
      return res.status(500).json({ error: "Erreur lors de la récupération des abonnés." });
    }

    if (!followers || followers.length === 0) {
      console.log(`[New Product Notifications] Aucun abonné à notifier pour le vendeur ${vendorId}`);
      return res.json({ status: "ignored", message: "Aucun abonné n'a activé ces notifications." });
    }

    console.log(`[New Product Notifications] Notification de ${followers.length} abonnés pour ${productNom}`);
    
    const title = `🚀 Nouveau produit chez ${vendorShopName}`;
    const message = `Le produit "${productNom}" est disponible à ${productPrix.toLocaleString('fr-FR')} HTG. Commandez-le vite !`;

    let notifiedCount = 0;
    for (const follower of followers) {
      if (follower.follower_id) {
        try {
          await sendOneSignalPush(follower.follower_id, title, message, 'promo');
          notifiedCount++;
        } catch (pushErr: any) {
          console.warn(`[New Product Notifications] Failed sending to follower ${follower.follower_id}:`, pushErr.message);
        }
      }
    }

    return res.json({ status: "success", notifiedCount });
  } catch (err: any) {
    console.error("[New Product Notifications] Exception:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/promotion', async (req, res) => {
  const { vendorId, vendorShopName, productNom, oldPrice, newPrice } = req.body;
  {
    const caller = await getAuthedUser(req);
    if (!caller) return res.status(401).json({ error: "Authentification requise." });
    if (String(req.body.vendorId || '') !== caller.id) return res.status(403).json({ error: "Accès refusé." });
  }

  if (!isSupabaseConfigured || !supabase) {
    return res.status(400).json({ error: "Supabase n'est pas configuré sur le serveur." });
  }

  try {
    // Query followers having notify_promotions enabled
    const { data: followers, error } = await supabase
      .from('vendor_follows')
      .select('follower_id')
      .eq('vendor_id', vendorId)
      .eq('notify_promotions', true);

    if (error) {
      console.error("[Promotion Notifications] Error fetching followers:", error);
      return res.status(500).json({ error: "Erreur lors de la récupération des abonnés." });
    }

    if (!followers || followers.length === 0) {
      console.log(`[Promotion Notifications] Aucun abonné à notifier pour le vendeur ${vendorId}`);
      return res.json({ status: "ignored", message: "Aucun abonné n'a activé ces notifications." });
    }

    console.log(`[Promotion Notifications] Notification de ${followers.length} abonnés pour baisse de prix de ${productNom}`);

    const title = `⚡ Promotion chez ${vendorShopName} !`;
    const message = `Baisse de prix sur "${productNom}" ! Il passe de ${oldPrice.toLocaleString('fr-FR')} HTG à seulement ${newPrice.toLocaleString('fr-FR')} HTG. Ne ratez pas ça !`;

    let notifiedCount = 0;
    for (const follower of followers) {
      if (follower.follower_id) {
        try {
          await sendOneSignalPush(follower.follower_id, title, message, 'promo');
          notifiedCount++;
        } catch (pushErr: any) {
          console.warn(`[Promotion Notifications] Failed sending to follower ${follower.follower_id}:`, pushErr.message);
        }
      }
    }

    return res.json({ status: "success", notifiedCount });
  } catch (err: any) {
    console.error("[Promotion Notifications] Exception:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 3. VITE INTEGRATION FOR ASSETS AND SPA HANDLING
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets compiled inside /dist
    const distPath = path.join(process.cwd(), 'dist');
    // index: false : « / » ne doit pas être servi tel quel par le serveur de fichiers, il passe par la route ci-dessous
    // (injection de la configuration, et version dédiée pour sellerex.*)
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      const htmlPath = path.join(distPath, 'index.html');
      fs.readFile(htmlPath, 'utf8', (err, html) => {
        if (err) {
          return res.sendFile(htmlPath);
        }
        const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
        if (isSellerexHostname(req.hostname) && res.locals.cspNonce) {
          // Sellerex : page sans l'identité SEO/PWA de Vendza, scripts autorisés par nonce (voir sellerexHostMiddleware)
          return res.type('html').send(sellerexHtml(html, { nonce: res.locals.cspNonce, supabaseUrl: url, supabaseAnonKey: anonKey }));
        }
        const configScript = `
          <script id="supabase-config">
            window.__SUPABASE_CONFIG__ = {
              supabaseUrl: ${JSON.stringify(url)},
              supabaseAnonKey: ${JSON.stringify(anonKey)}
            };
          </script>
        `;
        const modifiedHtml = html.replace('<head>', `<head>${configScript}`);
        res.send(modifiedHtml);
      });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vendza FullStack] Server listening securely on http://localhost:${PORT}`);
  });
}

if (process.env.NETLIFY !== 'true') {
  startServer();
}

export { app };
