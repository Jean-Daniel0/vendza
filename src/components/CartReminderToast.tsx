import React, { useState } from 'react';

const KEY = 'vendza_cart_toast_shown';

// Rappel dans l'application : « votre panier contient N article(s) » (une fois par session)
export const CartReminderToast: React.FC<{ count: number; enabled: boolean; hidden: boolean; onOpen: () => void }> = ({ count, enabled, hidden, onOpen }) => {
  const [closed, setClosed] = useState<boolean>(() => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } });
  if (!enabled || hidden || closed || count <= 0) return null;
  const close = () => { try { sessionStorage.setItem(KEY, '1'); } catch {} setClosed(true); };
  return (
    <div role="status" className="fixed left-3 right-3 top-20 z-[55] mx-auto flex max-w-md items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-bold text-slate-800">🛒 Votre panier contient {count} article{count > 1 ? 's' : ''}</p>
      <div className="flex shrink-0 gap-2">
        <button onClick={() => { close(); onOpen(); }} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Voir</button>
        <button onClick={close} aria-label="Fermer" className="rounded-xl px-2 py-1.5 text-xs font-bold text-slate-400">✕</button>
      </div>
    </div>
  );
};
