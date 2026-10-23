import type { Message } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ts = (m: Message) => new Date((m as any).createdAt || 0).getTime();

// Fusionne des messages reçus du serveur dans la liste locale.
// - même id => remplacé
// - copie « optimiste » locale (id non UUID, ex. msg-1729…) déjà confirmée par le serveur => retirée (1 pour 1)
export function mergeIncoming(prev: Message[], incoming: Message[], windowMs = 120000): Message[] {
  const ids = new Set(incoming.map(m => m.id));
  const used = new Set<Message>();
  const keep = prev.filter(p => {
    if (ids.has(p.id)) return false;
    if (UUID_RE.test(p.id)) return true;
    const twin = incoming.find(m => !used.has(m) && UUID_RE.test(m.id) &&
      m.senderId === p.senderId && m.recipientId === p.recipientId &&
      (m.text || '') === (p.text || '') && Math.abs(ts(m) - ts(p)) <= windowMs);
    if (twin) { used.add(twin); return false; }
    return true;
  });
  return [...keep, ...incoming];
}
