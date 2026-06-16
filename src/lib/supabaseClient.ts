import { createClient } from '@supabase/supabase-js';

// Récupération des variables d'environnement configurées dans AI Studio
const supabaseUrl = 
  (import.meta as any).env.VITE_SUPABASE_URL || 
  (import.meta as any).env.SUPABASE_URL ||
  (typeof process !== 'undefined' && process.env ? (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) : '') || '';

const supabaseAnonKey = 
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env.SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' && process.env ? (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY) : '') || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('orders')
    .insert([order]);

  if (error) {
    console.error("Erreur lors de la création de la commande :", error.message);
    throw error;
  }
  return data;
}
