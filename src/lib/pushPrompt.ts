// Décision pure : faut-il inviter ce compte à activer les notifications push ?
export type PushStatus = { supported: boolean; permission: 'default' | 'granted' | 'denied'; subscribed: boolean };
export const PUSH_DISMISS_MS = 3 * 86400000;

export type PushPromptMode = 'hidden' | 'ask' | 'blocked';

export function pushPromptMode(userId: string | undefined, s: PushStatus, dismissedAt: number, now = Date.now()): PushPromptMode {
  if (!userId || !s.supported || s.subscribed) return 'hidden';
  if (now - dismissedAt < PUSH_DISMISS_MS) return 'hidden';
  return s.permission === 'denied' ? 'blocked' : 'ask';
}
