import { supabase } from './supabaseClient';

// Appel API serveur avec le jeton Supabase de l'utilisateur (requis par les routes protégées)
export async function apiFetchAuthed(input: string, init: RequestInit = {}): Promise<Response> {
  let token = '';
  try {
    const { data } = await (supabase as any).auth.getSession();
    token = data?.session?.access_token || '';
  } catch {}
  const headers = { ...((init.headers as Record<string, string>) || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  return fetch(input, { ...init, headers });
}
