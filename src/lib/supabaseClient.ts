import { createClient } from '@supabase/supabase-js';

// Récupération initiale statique (Vite remplacera process.env à la compilation)
let initialUrl = '';
let initialKey = '';

try {
  // @ts-ignore
  initialUrl = import.meta.env.VITE_SUPABASE_URL || '';
} catch (e) {}

if (!initialUrl) {
  try {
    initialUrl = process.env.VITE_SUPABASE_URL || '';
  } catch (e) {}
}

try {
  // @ts-ignore
  initialKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
} catch (e) {}

if (!initialKey) {
  try {
    initialKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  } catch (e) {}
}

export let supabaseUrl = initialUrl;
export let supabaseAnonKey = initialKey;
export let isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Instance de client réelle
let internalSupabase: ReturnType<typeof createClient> | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// On exporte un Proxy pour 'supabase' pour garantir que tout accès pointe vers la bonne instance,
// même si l'initialisation se fait de manière asynchrone après coup ou au boot
export const supabase = new Proxy({}, {
  get(target, prop) {
    if (!internalSupabase) {
      console.warn("[Supabase Proxy] Appel de la propriété '" + String(prop) + "' alors que Supabase n'est pas encore initialisé.");
      return undefined;
    }
    const val = (internalSupabase as any)[prop];
    if (typeof val === 'function') {
      return val.bind(internalSupabase);
    }
    return val;
  }
}) as ReturnType<typeof createClient>;

// Fonction asynchrone appelée avant le montage de l'application React
export async function initializeSupabaseConfig() {
  if (isSupabaseConfigured) {
    console.log("[Supabase Client] Déjà configuré via l'environnement local/build. URL:", supabaseUrl);
    return;
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        if (config.supabaseUrl && config.supabaseAnonKey) {
          supabaseUrl = config.supabaseUrl;
          supabaseAnonKey = config.supabaseAnonKey;
          isSupabaseConfigured = true;
          internalSupabase = createClient(supabaseUrl, supabaseAnonKey);
          console.log("[Supabase Client] Initialisation réussie via configuration dynamique (/api/config).");
        } else {
          console.warn("[Supabase Client] Le serveur a renvoyé une configuration vide.");
        }
      } else {
        console.warn("[Supabase Client] Impossible d'appeler l'endpoint /api/config. Code statut :", res.status);
      }
    } catch (err) {
      console.error("[Supabase Client] Erreur lors de la récupération de la configuration dynamique :", err);
    }
  }
}

/**
 * GUIDE D'INTÉGRATION SUPABASE POUR VENDZA.HT
 * 
 * 1. Déclarez vos variables dans le panneau "Secrets" de Google AI Studio :
 *    - VITE_SUPABASE_URL : l'URL de votre projet Supabase (https://xxx.supabase.co)
 *    - VITE_SUPABASE_ANON_KEY : votre clé publique anon
 * 
 * 2. Structure des tables recommandées dans votre projet Supabase :
 * 
 *    -- TABLE DES UTILISATEURS / PROFILS (synchronisée avec Auth)
 *    create table public.profiles (
 *      id uuid references auth.users on delete cascade primary key,
 *      prenom text not null,
 *      nom text not null,
 *      email text unique not null,
 *      tel text,
 *      departement text default 'Ouest',
 *      commune text not null,
 *      user_type text check (user_type in ('client', 'vendeur')),
 *      plan text default 'Gratuit',
 *      shop_name text,
 *      shop_desc text,
 *      premium_depts text[],
 *      created_at timestamp with time zone default timezone('utc'::text, now()) not null
 *    );
 * 
 *    -- TABLE DES PRODUITS
 *    create table public.products (
 *      id text primary key,
 *      nom text not null,
 *      desc text,
 *      prix numeric not null,
 *      image text,
 *      vendeur_id text not null,
 *      vendeur text not null,
 *      rating numeric default 5.0,
 *      stock integer not null default 1,
 *      categorie text,
 *      couleurs text[],
 *      tailles text[],
 *      date_creation date default current_date
 *    );
 * 
 *    -- TABLE DES COMMANDES (PAIEMENT GARANTI)
 *    create table public.orders (
 *      id text primary key,
 *      buyer_id text not null,
 *      client_nom text not null,
 *      client_tel text,
 *      items jsonb not null, -- Tableau des items achetés
 *      frais_livraison numeric default 0,
 *      discount numeric default 0,
 *      total_price numeric not null,
 *      status text check (status in ('payee', 'livree', 'annulee')) default 'payee',
 *      date text not null,
 *      heure text not null,
 *      departement text not null,
 *      commune text not null,
 *      created_at timestamp with time zone default timezone('utc'::text, now()) not null
 *    );
 */

// Exemple de fonction pour charger les produits depuis Supabase
export async function getProductsFromSupabase() {
  if (!supabase) {
    console.warn("Supabase n'est pas encore configuré. Remplissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans vos Secrets.");
    return null;
  }
  const { data, error } = await (supabase as any)
    .from('products')
    .select('*')
    .order('date_creation', { ascending: false });

  if (error) {
    console.error("Erreur lors du chargement des produits :", error.message);
    throw error;
  }
  return data;
}

// Exemple pour enregistrer une commande en Séquestre sur Supabase
export async function createOrderInSupabase(order: any) {
  if (!supabase) return null;
  const { data, error } = await (supabase as any)
    .from('orders')
    .insert([order]);

  if (error) {
    console.error("Erreur lors de la création de la commande :", error.message);
    throw error;
  }
  return data;
}
