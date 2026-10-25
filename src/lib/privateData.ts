import { supabase, isSupabaseConfigured } from './supabaseClient';

// Données financières et d'identité du vendeur : table privée (lisible par le seul propriétaire et l'administrateur)
export type PrivateRow = { moncash?: string; moncash_nom?: string; bank_name?: string; bank_account?: string; id_type?: string; id_number?: string; id_document_url?: string };
export type PrivateView = { moncash: string; moncashNom: string; banque: string; compteBanque: string; idType: string; idNumber: string; idFile: string };

// Anciennes colonnes publiques : on n'y écrit plus ces valeurs
export const LEGACY_PROFILE_KEYS = ['moncash', 'moncash_num', 'numero_moncash', 'moncash_nom', 'moncashnom', 'banque', 'bank_name', 'compte_bug', 'compte_banque', 'comptebanque', 'bank_account', 'id_type', 'idtype', 'id_number', 'idnumber', 'id_file', 'idfile', 'id_document_url'];
export const LEGACY_SHOP_KEYS = ['moncash', 'moncash_nom', 'bank_name', 'bank_account', 'id_type', 'id_number', 'id_document_url'];

export function stripKeys<T extends Record<string, any>>(obj: T, keys: string[]): T {
  keys.forEach(k => { delete (obj as any)[k]; });
  return obj;
}

// Traduit les champs de l'application vers la table privée (seulement ceux qui ont été modifiés)
export function privateFromUpdates(u: Record<string, any>): PrivateRow {
  const out: PrivateRow = {};
  if (u.moncash !== undefined) out.moncash = String(u.moncash ?? '').trim();
  if (u.moncashNom !== undefined) out.moncash_nom = String(u.moncashNom ?? '').trim();
  if (u.banque !== undefined) out.bank_name = String(u.banque ?? '').trim();
  if (u.compteBanque !== undefined) out.bank_account = String(u.compteBanque ?? '').trim();
  if (u.idType !== undefined) out.id_type = String(u.idType ?? '').trim();
  if (u.idNumber !== undefined) out.id_number = String(u.idNumber ?? '').trim();
  if (u.idFile !== undefined) out.id_document_url = String(u.idFile ?? '').trim();
  return out;
}

export async function savePrivate(userId: string, fields: PrivateRow): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !Object.keys(fields).length) return true;
  const { error } = await supabase.from('vendor_private').upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.warn('[private] enregistrement impossible:', error.message);
  return !error;
}

export async function loadPrivate(userId: string): Promise<PrivateView | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from('vendor_private').select('*').eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return { moncash: data.moncash || '', moncashNom: data.moncash_nom || '', banque: data.bank_name || '', compteBanque: data.bank_account || '',
    idType: data.id_type || '', idNumber: data.id_number || '', idFile: data.id_document_url || '' };
}
