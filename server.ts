import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import crypto from 'crypto';
import { MonCashClient, constructEvent, MonCashError } from "@moncashconnect/sdk";

// Load environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable JSON and URL-encoded body parsing middlewares (excluding Stripe & MonCash webhooks)
app.use((req, res, next) => {
  const isWebhook = req.originalUrl.includes('/api/stripe/webhook') || 
                    req.originalUrl.includes('/api/moncash/webhook') || 
                    req.originalUrl.includes('/api/mcc/webhook') ||
                    req.path.includes('/api/stripe/webhook') || 
                    req.path.includes('/api/moncash/webhook') || 
                    req.path.includes('/api/mcc/webhook');
  if (isWebhook) {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Initialize Supabase Client on Server Side securely
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
// On the server, we want to favor the Service Role Key (secret) if configured to automatically bypass Row Level Security (RLS) constraints
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize MonCash client using MonCashConnect secret key lazily to prevent server crashes on start if the key is missing in development/environments
const getMonCashClient = (): MonCashClient => {
  const secretKey = process.env.MONCASHCONNECT_KEY || process.env.VITE_MONCASHCONNECT_KEY;
  if (!secretKey) {
    throw new Error("Configuration MonCash manquante : MONCASHCONNECT_KEY ou VITE_MONCASHCONNECT_KEY est requise.");
  }
  return new MonCashClient(secretKey);
};

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
  montant: number
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
    await supabase
      .from('vendor_subscriptions')
      .insert({
        user_id:        userId,
        plan_code:      planCodeLower,
        status:         'active',
        billing:        billing,
        payment_method: paymentMethod,
        total_paid:     Number(montant) || 0,
        started_at:     maintenant.toISOString(),
        expires_at:     expiresAt.toISOString(),
        created_at:     maintenant.toISOString(),
        updated_at:     maintenant.toISOString()
      });
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
        message:   `Votre abonnement ${planCodeLower} est actif jusqu'au ${expiresAt.toLocaleDateString('fr-FR')}. Profitez de votre commission réduite à ${planCodeLower === 'pro_national' ? '3%' : planCodeLower === 'pro_local' ? '7%' : '10%'}.`,
        audience:  userId,
        is_active: true
      });
  } catch (err: any) {
    console.error('Error inserting platform messages check:', err.message);
  }

  console.log('Abonnement activé avec succès:', planCodeLower, 'pour', userId);
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
const sendPushNotificationBackend = async (recipientId: string, title: string, message: string) => {
  try {
    const apiAppId = '75a4d965-5500-4694-abfa-69b8a88c9d1d';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!apiKey) {
      console.error("[OneSignal Backend Helper Error] API key ONESIGNAL_REST_API_KEY is not configured.");
      return;
    }

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
      target_channel: "push",
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
  transactionId?: string | null
) => {
  if (!isSupabaseConfigured || !supabase) {
    console.error('[Webhook] Database is not configured.');
    return null;
  }

  try {
    console.log(`[Webhook] Processing creerCommandeApresPaiement for reference ID: ${orderId} (${paymentMethod})`);

    // 1. Récupérer les données depuis Supabase stockées temporairement avant le paiement
    let pendingOrder: any = null;
    try {
      const { data, error: pendingErr } = await supabase
        .from('pending_orders')
        .select('*')
        .eq('reference_id', orderId)
        .maybeSingle();
      
      if (!pendingErr && data) {
        pendingOrder = data;
        console.log('[Webhook] Pending order found in Supabase:', pendingOrder);
      } else if (pendingErr) {
        console.warn('[Webhook] Info: Error retrieving pending order from database:', pendingErr.message);
      }
    } catch (dbErr: any) {
      console.warn('[Webhook] Info: Exception retrieving pending order from database:', dbErr.message);
    }

    // fallback 1.2: Check local cache system
    if (!pendingOrder) {
      console.log(`[Webhook Fallback] Fetching pending order from local backup cache for ref: ${orderId}`);
      const localPending = getLocalPendingOrder(orderId);
      if (localPending) {
        pendingOrder = localPending;
        console.log('[Webhook Fallback] Pending order retrieved successfully from local backup cache:', pendingOrder);
      }
    }

    // fallback 1.3: If still missing and it is Stripe, let's recover whatever info we can from Stripe session details
    if (!pendingOrder && paymentMethod === 'stripe' && transactionId && !transactionId.startsWith('stripe-sim-')) {
      try {
        console.log(`[Webhook Fallback] Attempting to rebuild order from active Stripe session: ${transactionId}`);
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-05-27.dahlia' as any });
          const session = await stripe.checkout.sessions.retrieve(transactionId, { expand: ['line_items'] });
          if (session) {
            // Reconstruct minimal metadata to allow safe creation
            pendingOrder = {
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
            console.log('[Webhook Fallback] Successfully reconstructed pending order details from Stripe API:', pendingOrder);
          }
        }
      } catch (stripeRecErr: any) {
        console.error('[Webhook Fallback Error] Rebuild from Stripe failed:', stripeRecErr.message);
      }
    }

    if (!pendingOrder) {
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

    // 2. Générer QR code unique
    const qrCode = `qr-${orderId.split('-')[1] || Date.now().toString().slice(-4)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

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
      'gratuit':      0.10,
      'pro_local':    0.07,
      'pro_national': 0.03
    };

    const plan = (shop?.plan || 'gratuit').toLowerCase();
    const rate = commissions[plan] !== undefined ? commissions[plan] : 0.10;
    const total_price = Number(pendingOrder.total_price) || 0;
    const commission = total_price * rate;
    const montantVendeur = total_price - commission;

    console.log(`[Webhook] Plan=${plan}, Rate=${rate}, Total=${total_price}, Comm=${commission}, VendorAmount=${montantVendeur}`);

    // Create a human readable date and hour for French format matching App.tsx orders
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const heureStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Ensure profiles details are retrieved for client name & phone
    let clientNom = 'Client Anonyme';
    let clientTel = '';
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('prenom, nom, tel')
      .eq('id', pendingOrder.buyer_id)
      .maybeSingle();

    if (clientProfile) {
      clientNom = `${clientProfile.prenom || ''} ${clientProfile.nom || ''}`.trim() || 'Client';
      clientTel = clientProfile.tel || '';
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
        .select('name, shop_name')
        .eq('vendor_id', pendingOrder.vendor_id)
        .maybeSingle();
      if (vendorShop) {
        vendorName = vendorShop.shop_name || vendorShop.name || 'Boutique';
      } else {
        const { data: vendorProfile } = await supabase
          .from('profiles')
          .select('prenom, nom, shop_name')
          .eq('id', pendingOrder.vendor_id)
          .maybeSingle();
        if (vendorProfile) {
          vendorName = vendorProfile.shop_name || `${vendorProfile.prenom || ''} ${vendorProfile.nom || ''}`.trim() || 'Boutique';
        }
      }
    } catch {
      // Ignored
    }

    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    
    // 4. Créer la commande définitive (with maximum redundant aliases for complete schema compatibility)
    const orderPayload: any = {
      id: isUuid(orderId) ? orderId : crypto.randomUUID(),
      qr_token: orderId, // Save the friendly payment reference in the text qr_token column
      buyer_id: pendingOrder.buyer_id,
      client_id: pendingOrder.buyer_id, // alias to prevent write issue
      client_nom: clientNom,
      client_name: clientNom, // alias
      client_tel: clientTel,
      vendor_id: pendingOrder.vendor_id,
      vendeur_id: pendingOrder.vendor_id, // alias
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
      reception_confirmed: false,
      vendor_credited: false,
      date: dateStr,
      heure: heureStr,
      product_id: firstProductId,
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
          console.log('[Webhook] Order created successfully inside database:', orderId);
          break;
        }

        const errMsg = insertError.message || '';
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
      console.error(`[CRITICAL] Order insertion failed for reference ${orderId}. Storing inside orphaned_payments table and local backup file.`);
      
      const orphanedPayload = {
        id: `orph-${orderId.split('-')[1] || Date.now().toString().slice(-4)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        order_id: orderId,
        buyer_id: pendingOrder.buyer_id,
        vendor_id: pendingOrder.vendor_id,
        amount: total_price,
        payment_method: paymentMethod,
        transaction_id: transactionId || orderId,
        payload_details: JSON.stringify(orderPayload),
        created_at: new Date().toISOString()
      };
      
      const payloadOrphCopy = { ...orphanedPayload };
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const { error: orphError } = await supabase
            .from('orphaned_payments')
            .insert([payloadOrphCopy]);
          if (!orphError) {
            console.log('[Webhook Recovery] Saved orphaned payment successfully in Supabase: orphaned_payments');
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
      
      // Always store locally as guaranteed fallback
      saveOrphanedPayment(orderPayload);
    } else {
      // Order created successfully, we can safely delete from local pending cache
      deleteLocalPendingOrder(orderId);
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
        order_id: orderId,
        amount: montantVendeur,
        type: 'pending_escrow',
        description: `Paiement ${paymentMethod} — en séquestre (commission ${rate * 100}% pour forfait ${plan} déduite)`
      });

    // 7. Supprimer la commande pending
    await supabase
      .from('pending_orders')
      .delete()
      .eq('reference_id', orderId);

    // 8. Trigger real-time push notifications from backend (Fail-safe)
    try {
      if (pendingOrder.vendor_id) {
        console.log(`[Webhook Push] Notifying seller '${pendingOrder.vendor_id}'...`);
        await sendPushNotificationBackend(
          pendingOrder.vendor_id,
          "Nouvelle commande reçue",
          `Tu as reçu une nouvelle commande d'un montant de ${total_price} HTG. Réf: ${orderId}`
        );
      }
      if (pendingOrder.buyer_id) {
        console.log(`[Webhook Push] Notifying buyer '${pendingOrder.buyer_id}'...`);
        await sendPushNotificationBackend(
          pendingOrder.buyer_id,
          "Ta commande a été confirmée",
          `Ton paiement de ${total_price} HTG a été enregistré avec succès et placé en séquestre de sécurité. Réf: ${orderId}`
        );
      }
    } catch (pushErr: any) {
      console.error("[Webhook Push Error] Failed to send push notification from backend webhook:", pushErr.message);
    }

    console.log('[Webhook Success] Finished successfully for order:', orderId);
    return orderStored;
  } catch (e: any) {
    console.error('[Webhook] Exception in creerCommandeApresPaiement:', e.message);
    return null;
  }
};

// ============================================
// OFFICIAL MONCASHCONNECT (MCC) SANDBOX PAYMENTS
// ============================================

// 1. OPTIONS CORS preflight handler for MCC creation
app.options('/api/mcc/create-payment', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return res.sendStatus(204);
});

// 2. Create payment backend route (Backend -> MCC)
app.post('/api/mcc/create-payment', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { 
    orderId, 
    amount,
    customerName,
    customerEmail 
  } = req.body;

  if (!amount || amount < 1 || amount > 1000000) {
    return res.status(400).json({ error: 'Montant invalide (1 à 1 000 000 HTG)' });
  }

  // Pre-save subscription metadata resiliently if starting with 'sub-'
  const metadata = req.body.metadata;
  const isSubscription = (orderId && orderId.startsWith('sub-')) || (metadata && metadata.type === 'subscription');

  if (isSubscription) {
    const subMeta = metadata || {
      type: 'subscription',
      planCode: req.body.planCode || (orderId.includes('pro_national') ? 'pro_national' : 'pro_local'),
      billing: req.body.billing || 'mensuel',
      userId: req.body.userId || 'unknown_user_id'
    };
    await setPendingSubscriptionMeta(orderId, amount, subMeta);
  }

  const mccSecret = process.env.MCC_SECRET || '';
  const mccDomain = process.env.MCC_DOMAIN || '';

  if (!mccSecret || !mccDomain) {
    console.error('[MCC Backend Error] MCC_SECRET or MCC_DOMAIN not configured in your environment system.');
    return res.status(400).json({ error: 'Configuration MonCashConnect manquante sur le serveur (MCC_SECRET / MCC_DOMAIN).' });
  }

  try {
    const cleanDomain = mccDomain.replace(/^https?:\/\//i, '').split('/')[0];
    const originHeader = `https://${cleanDomain}`;
    const returnUrl = `https://${cleanDomain}/checkout/return`;

    console.log(`[MCC Backend] Creating payment page request to MCC backend. Origin: ${originHeader}, returnUrl: ${returnUrl}`);

    const requestBody: any = {
      amount: Math.round(Number(amount)),
      referenceId: orderId,
      returnUrl: returnUrl,
    };

    if (customerEmail && customerEmail.trim() !== '') {
      requestBody.customerEmail = customerEmail;
    }
    if (customerName && customerName.trim() !== '') {
      requestBody.customerName = customerName;
    }

    const mccResponse = await fetch('https://hvlmeoqyxaguzcujpmit.supabase.co/functions/v1/pay-create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mccSecret}`,
        'Origin': originHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!mccResponse.ok) {
      const errorText = await mccResponse.text();
      console.error('[MCC Backend] Reject response from pay-create:', mccResponse.status, errorText);
      return res.status(mccResponse.status).json({ error: `La création du paiement pay-create a échoué: ${errorText}` });
    }

    const data: any = await mccResponse.json();
    console.log('[MCC Backend] Successfully received paymentUrl:', data);

    return res.json({
      paymentUrl: data.paymentUrl,
      reference: data.reference,
      expiresAt: data.expiresAt,
      livemode: data.livemode
    });
  } catch (err: any) {
    console.error('[MCC Backend] Exception in create-payment:', err.message);
    return res.status(500).json({ error: err.message || 'Erreur interne lors de la création du paiement MonCashConnect' });
  }
});

// 3. Webhook endpoint with HMAC verification (MCC -> Backend)
app.post('/api/mcc/webhook', express.raw({ type: '*/*' }), async (req: any, res) => {
  try {
    const rawBodyBuffer = req.body;
    const rawBody = rawBodyBuffer ? rawBodyBuffer.toString('utf-8') : '';
    
    const sig = req.headers['x-mcc-signature'];
    const ts = req.headers['x-mcc-timestamp'];

    console.log('[MCC Webhook] Received signature:', sig, 'timestamp:', ts);

    const webhookSecret = process.env.MCC_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      console.error('[MCC Webhook Error] Webhook secret MCC_WEBHOOK_SECRET is missing from server environment.');
    }

    // Compute expected webhook verification signature
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const expected = "sha256=" + hmac.update(rawBody).digest('hex');

    const receivedSig = Array.isArray(sig) ? sig[0] : (sig || '');

    if (receivedSig !== expected) {
      console.error('[MCC Webhook] Invalid webhook signature! Expected:', expected, 'Received:', receivedSig);
      return res.status(401).send('Signature verification failed');
    }

    const payload = JSON.parse(rawBody);
    console.log('[MCC Webhook] Signature verified. Event:', payload.event, 'Ref:', payload.reference);

    const { event, reference, amount } = payload;

    if (event === 'payment.completed') {
      console.log('[MCC Webhook] Processing billing success for ref:', reference);
      if (reference && String(reference).startsWith('sub-')) {
        const pending = await getPendingOrderSubscriptionInfo(String(reference));
        if (pending) {
          console.log(`[MCC Webhook Subscription] Found subscription details: user=${pending.userId}, plan=${pending.planCode}`);
          await activerAbonnement(
            pending.userId,
            pending.planCode,
            pending.billing || 'mensuel',
            'moncash',
            Number(amount) || 0
          );
          try {
            await supabase.from('pending_orders').delete().eq('reference_id', String(reference));
          } catch (e) {}
        } else {
          console.warn('[MCC Webhook Subscription] No pending meta found in DB for:', reference, 'Parsing ref fallback');
          const parts = String(reference).split('-');
          const userId = parts[1] || 'unknown';
          await activerAbonnement(
            userId,
            String(reference).includes('pro_national') ? 'pro_national' : 'pro_local',
            'mensuel',
            'moncash',
            Number(amount) || 0
          );
        }
      } else {
        await creerCommandeApresPaiement(reference, 'moncash', reference);
      }
    } else if (event === 'payment.failed' || event === 'payment.cancelled') {
      console.log('[MCC Webhook] Order failed or was cancelled:', reference);
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('pending_orders')
          .delete()
          .eq('reference_id', reference);
      }
    }

    return res.status(200).send('ok');
  } catch (err: any) {
    console.error('[MCC Webhook Exception]', err.message);
    return res.status(200).send('Handled: ' + err.message);
  }
});

// 4. Proxy status route to bypass client-side CORS issues
app.get('/api/mcc/status', async (req, res) => {
  const { reference } = req.query;
  if (!reference) {
    return res.status(400).json({ error: 'Référence obligatoire' });
  }

  const mccSecret = process.env.MCC_SECRET || '';

  try {
    const url = `https://hvlmeoqyxaguzcujpmit.supabase.co/functions/v1/pay-status?referenceId=${encodeURIComponent(String(reference))}`;
    console.log(`[MCC Status Proxy] Fetching pay-status for referenceId: ${reference}`);
    const response = await fetch(url, {
      headers: mccSecret ? {
        'Authorization': `Bearer ${mccSecret}`
      } : {}
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[MCC Status Proxy Error] Code: ${response.status}. Msg: ${errorText}`);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    
    // Auto-create order in database securely if completed, acting as an instant webhook fallback on redirect/polling
    if (data.status === 'completed' && reference) {
      console.log(`[MCC Status Proxy] Payment status completed! Finalizing: ${reference}`);
      if (String(reference).startsWith('sub-')) {
        const pending = await getPendingOrderSubscriptionInfo(String(reference));
        if (pending) {
          console.log(`[MCC Status Proxy Subscription] Activating subscription for user: ${pending.userId}, plan: ${pending.planCode}`);
          await activerAbonnement(
            pending.userId,
            pending.planCode,
            pending.billing || 'mensuel',
            'moncash',
            data.amount || 0
          );
          try {
            await supabase.from('pending_orders').delete().eq('reference_id', String(reference));
          } catch (e) {}
        } else {
          console.warn('[MCC Status Proxy Subscription] No pending meta found in DB for:', reference);
          const parts = String(reference).split('-');
          const userId = parts[1] || 'unknown';
          await activerAbonnement(
            userId,
            String(reference).includes('pro_national') ? 'pro_national' : 'pro_local',
            'mensuel',
            'moncash',
            data.amount || 0
          );
        }
      } else {
        await creerCommandeApresPaiement(String(reference), 'moncash', String(reference));
      }
    }

    return res.json(data);
  } catch (err: any) {
    console.error('[MCC Status Proxy Exception]', err.message);
    return res.status(500).json({ error: err.message || 'Erreur lors de la récupération du statut' });
  }
});

// ============================================
// MONCASHCONNECT & WEBHOOK ENDPOINTS
// ============================================

app.post('/api/moncash/create-payment', async (req, res) => {
  const { 
    orderId, 
    amount,
    customerName,
    customerEmail 
  } = req.body;

  // Vérifier montant valide (1 à 1 000 000 HTG)
  if(!amount || amount < 1 || amount > 1000000){
    return res.status(400).json({ 
      error: 'Montant invalide (1 à 1 000 000 HTG)' 
    });
  }

  // Pre-save subscription metadata resiliently if starting with 'sub-'
  const metadata = req.body.metadata;
  const isSubscription = (orderId && orderId.startsWith('sub-')) || (metadata && metadata.type === 'subscription');

  if (isSubscription) {
    const subMeta = metadata || {
      type: 'subscription',
      planCode: req.body.planCode || (orderId.includes('pro_national') ? 'pro_national' : 'pro_local'),
      billing: req.body.billing || 'mensuel',
      userId: req.body.userId || 'unknown_user_id'
    };
    await setPendingSubscriptionMeta(orderId, amount, subMeta);
  }

  const baseUrl = getBaseUrl(req);
  const simulationUrl = `${baseUrl}/moncash-simulation?orderId=${encodeURIComponent(orderId)}&total=${encodeURIComponent(String(amount))}`;

  // Check if MonCash secret key is missing or matches the literal placeholder "sk_proj_..." or is not properly formatted.
  const secretKey = process.env.MONCASHCONNECT_KEY || process.env.VITE_MONCASHCONNECT_KEY || '';
  const isPlaceholderKey = !secretKey || secretKey === "sk_proj_..." || secretKey.trim() === "" || !secretKey.startsWith("sk_proj_");

  if (isPlaceholderKey) {
    console.warn(`[MonCash Backend Fallback] Clé MonCashConnect manquante ou invalide ("${secretKey}"). Redirection automatique vers la passerelle de simulation sécurisée.`);
    return res.json({
      payment_url: simulationUrl,
      is_simulated: true,
      warning: "La clé de l'API MonCashConnect n'est pas configurée ou est invalide. En cours de simulation de paiement."
    });
  }

  try {
    const returnUrl = `${baseUrl}/paiement/moncash/succes?orderId=${orderId}`;
    console.log(`[MonCash Backend] BaseUrl: ${baseUrl}, returnUrl: ${returnUrl}`);

    const payment = await getMonCashClient().createPayment(
      Math.round(amount), // Entier obligatoire
      orderId,
      {
        returnUrl: returnUrl,
        customerName:  customerName || '',
        customerEmail: customerEmail || '',
      }
    );

    res.json({ 
      payment_url: payment.paymentUrl,
      expires_at:  payment.expiresAt
    });

  } catch(error: any) {
    console.error('MonCashConnect API error:', error);

    // If duplicate reference, let's treat it gracefully
    if(error.code === 'duplicate_reference'){
      try {
        const status = await getMonCashClient().getPaymentStatus(orderId);
        if(status.status === 'completed'){
          return res.status(409).json({ 
            error: 'Cette commande a déjà été payée' 
          });
        }
      } catch (checkErr: any) {
        console.error('Error fetching status for duplicate reference:', checkErr);
      }
    }

    // Catch formatting / key error and fall back to simulation
    const errMsg = error.message || String(error);
    if (errMsg.includes('sk_proj_') || errMsg.includes('Secret key')) {
      console.warn(`[MonCash Backend Fallback] Détection de l'erreur de clé SDK (${errMsg}). Redirection vers le mode simulation.`);
      return res.json({
        payment_url: simulationUrl,
        is_simulated: true,
        warning: "Configuration MonCash invalide détectée par le SDK. Utilisation du mode simulation."
      });
    }

    res.status(500).json({ 
      error: error.message || 'Erreur lors de la création du paiement MonCash' 
    });
  }
});

app.post('/api/moncash/webhook', express.raw({ type: 'application/json' }), async (req: any, res) => {
  try {
    const sig = req.headers['x-mcc-signature'];
    const ts = req.headers['x-mcc-timestamp'];

    // Vérifier signature HMAC-SHA256 via le constructeur d'évènement SDK
    const event = constructEvent(
      req.body,
      Array.isArray(sig) ? sig[0] : (sig || ''),
      Array.isArray(ts) ? ts[0] : (ts || ''),
      process.env.MCC_WEBHOOK_SECRET || ''
    );

    console.log('Webhook MonCash reçu via SDK:', event.event);

    if(event.event === 'payment.completed'){
      await creerCommandeApresPaiement(
        event.reference,
        'moncash',
        event.reference
      );
    }

    if(event.event === 'payment.failed'){
      if (isSupabaseConfigured && supabase) {
        // Nettoyer la commande pending
        await supabase
          .from('pending_orders')
          .delete()
          .eq('reference_id', event.reference);
      }
      console.log('Paiement échoué:', event.reference);
    }

    res.sendStatus(200);

  } catch(err: any) {
    if(err instanceof MonCashError){
      return res.status(err.statusCode)
        .send(err.message);
    }
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

app.get('/api/moncash/status/:orderId', async (req, res) => {
  const secretKey = process.env.MONCASHCONNECT_KEY || process.env.VITE_MONCASHCONNECT_KEY || '';
  const isPlaceholderKey = !secretKey || secretKey === "sk_proj_..." || secretKey.trim() === "" || !secretKey.startsWith("sk_proj_");

  if (isPlaceholderKey) {
    // Return mock completed status to gracefully satisfy client-side polling in test environment
    return res.json({
      status: 'completed',
      reference: req.params.orderId,
      amount: 100,
      is_simulated: true
    });
  }

  try {
    const status = await getMonCashClient().getPaymentStatus(
      req.params.orderId
    );
    
    // Call creerCommandeApresPaiement if Classic MonCash is fully paid to ensure database registration
    if (status && status.status === 'completed') {
      console.log(`[Classic MonCash status] Payment status completed! Finalizing order: ${req.params.orderId}`);
      await creerCommandeApresPaiement(req.params.orderId, 'moncash', req.params.orderId);
    }
    
    res.json(status);
  } catch(error: any) {
    console.error('Erreur status-check MonCash:', error.message);
    
    // Fallback if SDK complains about formatting
    if (error.message?.includes('sk_proj_')) {
      return res.json({
        status: 'completed',
        reference: req.params.orderId,
        amount: 100,
        is_simulated: true
      });
    }

    res.status(404).json({ 
      error: 'Transaction introuvable: ' + error.message 
    });
  }
});

app.post('/api/orders/pending', async (req, res) => {
  const {
    reference_id,
    buyer_id,
    vendor_id,
    items,
    total_price,
    shipping_fee,
    delivery_commune,
    delivery_address
  } = req.body;

  if (!reference_id) {
    return res.status(400).json({ error: "reference_id est manquant" });
  }

  // Define pending order payload
  const pendingPayload = {
    reference_id,
    buyer_id,
    vendor_id,
    items,
    total_price: Number(total_price) || 0,
    shipping_fee: Number(shipping_fee) || 0,
    delivery_commune: delivery_commune || '',
    delivery_address: delivery_address || '',
    created_at: new Date().toISOString()
  };

  try {
    console.log(`[Pending Order Server] Registering pending order: ${reference_id} for buyer: ${buyer_id}`);
    
    // Always store in our 100% resilient local backup cache file first!
    saveLocalPendingOrder(pendingPayload);

    if (!isSupabaseConfigured || !supabase) {
      console.warn("[Pending Order Server] Supabase is not configured. Saved pending order locally as fallback.");
      return res.json({ success: true, cachedLocally: true, data: pendingPayload });
    }

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
      console.error('[Pending Order Server] Warning: Error inserting pending order into Supabase:', error.message);
      // Don't fail the request if it is at least cached locally!
      return res.json({ success: true, cachedLocally: true, warning: error.message, data: pendingPayload });
    }

    console.log(`[Pending Order Server] Successfully created pending order in database: ${reference_id}`);
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Pending Order Server] Unexpected exception:', err.message);
    // Don't crash checkout if we managed to cache it locally
    return res.json({ success: true, cachedLocally: true, error: err.message, data: pendingPayload });
  }
});

app.post('/api/paiement/creer', async (req, res) => {
  const { orderId, total } = req.body;
  if (!orderId || !total) {
    return res.status(400).json({ error: "Champs requis manquants : orderId ou total" });
  }

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  
  // Real MonCash or Sandbox Integration if ClientID & Secret are set
  const clientId = process.env.MONCASH_CLIENT_ID || '';
  const clientSecret = process.env.MONCASH_CLIENT_SECRET || '';
  const mode = process.env.MONCASH_MODE || 'sandbox';

  if (clientId && clientSecret) {
    try {
      console.log(`[MonCash Backend] Initiating real/sandbox MonCash payment for order ${orderId}, amount: ${total} HTG...`);
      const authUrl = mode === 'live' 
        ? 'https://moncashbutton.digicelgroup.com/Moncash-middleware/oauth/token'
        : 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/oauth/token';

      // Call MonCash token endpoint
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenResponse = await fetch(`${authUrl}?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      if (!tokenResponse.ok) {
        throw new Error(`MonCash auth failed: ${tokenResponse.statusText}`);
      }

      const tokenData: any = await tokenResponse.json();
      const token = tokenData.access_token;

      // Construct payment creation body
      const createUrl = mode === 'live'
        ? 'https://moncashbutton.digicelgroup.com/Moncash-middleware/v1/CreatePayment'
        : 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/v1/CreatePayment';

      const paymentResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: Math.round(Number(total)),
          orderId: orderId
        })
      });

      if (!paymentResponse.ok) {
        throw new Error(`MonCash payment creation failed: ${paymentResponse.statusText}`);
      }

      const paymentData: any = await paymentResponse.json();
      const rawToken = paymentData.payment_token?.token;

      if (!rawToken) {
        throw new Error("No payment token returned by MonCash API.");
      }

      const redirectUrl = mode === 'live'
        ? `https://moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${rawToken}`
        : `https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${rawToken}`;

      return res.json({ payment_url: redirectUrl });
    } catch (err: any) {
      console.warn(`[MonCash Backend] Failed to make actual MonCash token request. Falling back to secure interactive simulation:`, err.message);
    }
  }

  // Fallback / Default: Secure and beautiful interactive MonCash mockup simulator
  const simulationUrl = `${baseUrl}/moncash-simulation?orderId=${encodeURIComponent(orderId)}&total=${encodeURIComponent(String(total))}`;
  res.json({ payment_url: simulationUrl });
});

// Endpoint serving the interactive mock MonCash Simulation screen
app.get('/moncash-simulation', (req, res) => {
  const { orderId, total } = req.query;
  const cleanOrderId = String(orderId || 'order-unknown');
  const cleanTotal = String(total || '0');

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MonCash Digicel - Passerelle de Paiement Sécurisée</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f3f4f6;
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <!-- MonCash Logo Header -->
        <div class="bg-[#e2001a] p-6 text-white text-center relative">
            <div class="font-bold text-3xl tracking-tight flex items-center justify-center gap-2">
                <span class="bg-white text-[#e2001a] px-2.5 py-0.5 rounded-lg text-2xl font-black">Mon</span>Cash
            </div>
            <p class="text-xs text-white/80 mt-1.5 font-medium tracking-wide">PASSERELLE DE PAIEMENT SÉCURISÉE</p>
        </div>

        <div class="p-6 space-y-6">
            <!-- Payment Summary -->
            <div class="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                <div class="flex justify-between items-center text-xs text-slate-500">
                    <span>Marchand</span>
                    <span class="font-semibold text-slate-700">Vendza S.A. (Séquestre)</span>
                </div>
                <div class="flex justify-between items-center text-xs text-slate-500">
                    <span>Référence Commande</span>
                    <span class="font-mono text-slate-700 font-bold">${cleanOrderId}</span>
                </div>
                <div class="border-t border-slate-200/60 my-2 pt-2 flex justify-between items-center">
                    <span class="text-sm font-medium text-slate-700">Montant total</span>
                    <span class="text-xl font-bold text-[#e11d48]">${Number(cleanTotal).toLocaleString('fr-FR')} HTG</span>
                </div>
            </div>

            <!-- Simulation Banner -->
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                <div class="font-semibold flex items-center gap-1.5 text-amber-900">
                    <span>⚠️ Mode Simulation Active</span>
                </div>
                <p>Cette passerelle de test vous permet de simuler un paiement MonCash réel pour vos tests de validation.</p>
            </div>

            <!-- Form simulator -->
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Numéro de Téléphone MonCash</label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">+509</span>
                        <input type="tel" value="3788 4410" readonly class="w-full pl-14 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none cursor-not-allowed font-medium" />
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Code PIN Secret (4 chiffres)</label>
                    <input type="password" value="••••" readonly class="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none cursor-not-allowed font-medium" />
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="space-y-3 pt-2">
                <button onclick="triggerPayment('success')" class="w-full bg-[#10b981] hover:bg-[#059669] text-white py-3 rounded-xl font-semibold text-sm transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-emerald-100 flex items-center justify-center gap-2">
                    ✓ Confirmer le Paiement (Succès)
                </button>
                <button onclick="triggerPayment('error')" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2">
                    ✕ Annuler la Transaction
                </button>
            </div>
            
            <p class="text-[10px] text-slate-400 text-center">En cliquant, vous allez être redirigé vers l'application Vendza pour finaliser votre commande en séquestre.</p>
        </div>
    </div>

    <script>
        function triggerPayment(status) {
            const orderId = "${encodeURIComponent(cleanOrderId)}";
            window.location.href = "/?paymentStatus=" + status + "&orderId=" + orderId;
        }
    </script>
</body>
</html>
  `;
  res.send(html);
});

// Endpoint serving the interactive mock Stripe Simulation screen
app.get('/stripe-simulation', (req, res) => {
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
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Missing required fields: items" });
  }

  const cleanOrderId = orderId || referenceId || 'pending_payment';
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

  // Calculate order total in USD
  const totalUSD = items.reduce((acc, item) => {
    const price = item.product ? Number(item.product.prix) : Number(item.price);
    const qty = item.quantity || 1;
    return acc + (price / currentRate) * qty;
  }, 0);

  if (!stripeSecretKey) {
    console.error("[Stripe Backend ERROR] STRIPE_SECRET_KEY is missing. Falling back to interactive Stripe Simulation...");
    const simulationUrl = `${baseUrl}/stripe-simulation?orderId=${encodeURIComponent(cleanOrderId)}&totalUSD=${encodeURIComponent(totalUSD.toFixed(2))}&customerEmail=${encodeURIComponent(customerEmail || '')}`;
    return res.json({ url: simulationUrl });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-05-27.dahlia' as any
    });

    console.log(`[Stripe Backend] Creating session, converting prices to USD basis... Type=${type || 'order'}`);

    const isSub = type === 'subscription';
    const actualSuccessUrl = isSub && successUrl ? successUrl : `${baseUrl}/paiement/succes?session_id={CHECKOUT_SESSION_ID}`;
    const actualCancelUrl = isSub && cancelUrl ? cancelUrl : `${baseUrl}/paiement/annule`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: customerEmail || undefined,
      line_items: items.map(item => {
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
      metadata: {
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
        const userId = session.metadata?.userId;
        const planCode = session.metadata?.planCode;
        const billing = session.metadata?.billing;
        const amount_total_htg = Math.round((session.amount_total || 0) / 100 * 130);
        console.log(`[Stripe Verification Proxy Subscription] Session paid! Activating subscription for user: ${userId}, plan: ${planCode}`);
        if (userId && planCode) {
          await activerAbonnement(userId, planCode, billing || 'mensuel', 'stripe', amount_total_htg);
        }
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
      const userId = session.metadata?.userId;
      const planCode = session.metadata?.planCode;
      const billing = session.metadata?.billing;
      const amount_total_htg = Math.round((session.amount_total || 0) / 100 * 130);
      console.log(`[Stripe Webhook Subscription] Webhook completed! Activating subscription for user: ${userId}, plan: ${planCode}`);
      if (userId && planCode) {
        await activerAbonnement(userId, planCode, billing || 'mensuel', 'stripe', amount_total_htg);
      }
    } else if (orderId) {
      console.log(`[Stripe Webhook] Verified success for order ${orderId}. Session ID: ${session.id}`);
      await creerCommandeApresPaiement(orderId, 'stripe', session.id);
    }
  }

  res.json({ received: true });
});

// 1. DYNAMIC SITEMAP.XML GENERATOR
app.get('/sitemap.xml', async (req, res) => {
  res.header('Content-Type', 'application/xml');

  let products = [...FALLBACK_PRODUCTS];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, nom, updated_at, date_creation');
      
      if (!error && data && data.length > 0) {
        // Map keys correctly
        products = data.map((p: any) => ({
          id: p.id,
          nom: p.nom || p.name || 'Produit',
          desc: p.desc || p.description || '',
          prix: Number(p.prix || 0),
          image: p.image || '',
          categorie: p.cat || p.category || 'Général'
        }));
      }
    } catch (e) {
      console.warn("Error loading products for sitemap.xml, serving fallbacks instead:", e);
    }
  }

  const hostUrl = `${req.protocol}://${req.get('host')}`;
  
  // Format dynamic XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Pages Générales -->
  <url>
    <loc>${hostUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${hostUrl}/#about</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${hostUrl}/#terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <!-- Produits Dynamiques -->`;

  products.forEach(p => {
    xml += `
  <url>
    <loc>${hostUrl}/?product=${p.id}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  xml += `\n</urlset>`;
  res.send(xml);
});

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
        const pUrl = `${req.protocol}://${req.get('host')}/detail-produit.html?id=${product.id}`;

        const fullTitle = `${pName} | ${pPrice} sur Vendza`;
        const fullDesc = `${pDesc} - Achetez sereinement avec notre modèle sécurisé de séquestre de fonds à Haïti.`;

        // Perform fast injections over meta tags supporting standard and self-closing styles
        html = html.replace(/<title>.*?<\/title>/, `<title>${fullTitle}</title>`);
        html = html.replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${fullDesc}" />`);

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
app.post('/api/moderate-image', async (req, res) => {
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

// ============================================
// ONESIGNAL MULTI-USER NOTIFICATION PROXY
// ============================================
app.post('/api/onesignal/send', async (req, res) => {
  const { recipientId, title, message } = req.body;
  try {
    const apiAppId = '75a4d965-5500-4694-abfa-69b8a88c9d1d';
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (!apiKey) {
      const errMsg = "La clé d'API OneSignal (ONESIGNAL_REST_API_KEY) n'est pas configurée.";
      console.error("[OneSignal Proxy Config Error]", errMsg);
      return res.status(500).json({ error: errMsg });
    }

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
      target_channel: "push",
      include_aliases: {
        external_id: [recipientId]
      }
    };

    console.log("[OneSignal Proxy] Transmitting notification:", JSON.stringify(payload));

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("[OneSignal Proxy] Response:", data);
    return res.json(data);
  } catch (err: any) {
    console.error("[OneSignal Proxy] Failed sending notification:", err.message);
    return res.status(500).json({ error: "Failed to send notification: " + err.message });
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
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
