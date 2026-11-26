// Son Vendza : joué quand l'application est ouverte et qu'un message ou une notification arrive.
// (Application fermée, c'est le navigateur qui joue son propre son : il n'est pas possible de le remplacer pour une page web.)
const KEY = 'vendza_sound';
const SRC = '/sounds/vendza-notification.mp3';
const MIN_GAP_MS = 1500;      // un message + sa notification ne jouent le son qu'une fois
const FRESH_MS = 30_000;      // on ne joue jamais le son pour l'historique relu, seulement pour un message tout juste arrivé

export const isSoundEnabled = (): boolean => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setSoundEnabled = (on: boolean): void => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* stockage indisponible */ } };

/** Pure : faut-il jouer le son pour ce message ? (reçu par moi, pas écrit par moi, créé il y a moins de 30 s) */
export function isFreshIncoming(m: { senderId?: string; recipientId?: string; createdAt?: string }, userId: string, nowMs: number): boolean {
  if (!userId || m.recipientId !== userId || m.senderId === userId) return false;
  const t = m.createdAt ? Date.parse(m.createdAt) : NaN;
  return Number.isFinite(t) && nowMs - t >= -5_000 && nowMs - t <= FRESH_MS;
}

let last = 0; let audio: HTMLAudioElement | null = null;
export function playNotifSound(nowMs = Date.now()): boolean {
  if (typeof Audio === 'undefined' || !isSoundEnabled() || nowMs - last < MIN_GAP_MS) return false;
  last = nowMs;
  try {
    audio = audio || new Audio(SRC);
    audio.currentTime = 0; audio.volume = 0.7;
    void audio.play().catch(() => { /* le navigateur refuse avant la première interaction : sans conséquence */ });
    return true;
  } catch { return false; }
}

/** Aperçu quand on active l'interrupteur : joue toujours, sans toucher à l'anti-répétition. */
export function previewNotifSound(): void {
  if (typeof Audio === 'undefined') return;
  try { const a = new Audio(SRC); a.volume = 0.7; void a.play().catch(() => { /* ignoré */ }); } catch { /* ignoré */ }
}
