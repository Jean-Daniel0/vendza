import { apiFetchAuthed } from './api';

/** Demande l'e-mail de bienvenue. Le serveur l'envoie une seule fois par compte ; tout échec est ignoré (jamais bloquant). */
export function requestWelcomeEmail(isVendor: boolean): void {
  try { apiFetchAuthed('/api/email/welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor: isVendor }) }).catch(() => {}); } catch { /* ignoré */ }
}
