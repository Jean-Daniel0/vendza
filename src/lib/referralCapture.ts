// Mémorise le lien de parrainage (?ref=CODE, UTM) sur l'appareil pendant 30 jours ; le premier lien gagne.
import { apiFetchAuthed } from './api';

export const REF_KEY = 'vendza_ref';
export const REF_DAYS = 30;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type PendingRef = { code: string; at: number; utmSource?: string; utmCampaign?: string };

export const cleanRefCode = (v: unknown): string => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export function readPendingRef(store: Store, now = Date.now()): PendingRef | null {
  try {
    const j = JSON.parse(store.getItem(REF_KEY) || 'null');
    if (!j || !j.code || typeof j.at !== 'number') return null;
    if (now - j.at > REF_DAYS * 86400000) { store.removeItem(REF_KEY); return null; }
    return j;
  } catch { return null; }
}

/** Lit ?ref= dans l'adresse. Un lien déjà mémorisé (encore valable) n'est jamais remplacé. */
export function captureReferral(search: string, store: Store, now = Date.now()): boolean {
  try {
    const q = new URLSearchParams(search);
    const code = cleanRefCode(q.get('ref'));
    if (code.length < 6) return false;
    if (readPendingRef(store, now)) return false;
    const clip = (v: string | null) => (v || '').trim().slice(0, 60) || undefined;
    store.setItem(REF_KEY, JSON.stringify({ code, at: now, utmSource: clip(q.get('utm_source')), utmCampaign: clip(q.get('utm_campaign')) }));
    return true;
  } catch { return false; }
}

/** À appeler après une inscription ou une connexion. Le serveur décide (jamais d'indice sur le refus) ; on n'insiste pas. */
export function attachPendingReferral(): void {
  try {
    const p = readPendingRef(localStorage);
    if (!p) return;
    apiFetchAuthed('/api/referral/attach', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: p.code, clickedAt: new Date(p.at).toISOString(), utmSource: p.utmSource, utmCampaign: p.utmCampaign }) })
      .then(r => { if (r.ok) localStorage.removeItem(REF_KEY); }).catch(() => {});
  } catch { /* jamais bloquant */ }
}
