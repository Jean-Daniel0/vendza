import React, { useState } from 'react';
import OneSignal from 'react-onesignal';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const DISMISS_KEY = 'vendza_promo_optin_dismissed_at';
const SEVEN_DAYS = 7 * 86400000;

// Invite le client connecté à activer « Promotions & ventes flash » (consentement explicite, jamais activé automatiquement)
export const PromoOptIn: React.FC<{ userId?: string; newsletter?: boolean; onEnabled: () => void }> = ({ userId, newsletter, onEnabled }) => {
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < SEVEN_DAYS; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  if (!userId || newsletter || hidden) return null;

  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {} setHidden(true); };
  const enable = async () => {
    setBusy(true);
    try { await OneSignal.Notifications.requestPermission(); } catch {}
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('profiles').update({ newsletter: true }).eq('id', userId);
        if (!error) onEnabled();
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-3 shadow-lg">
      <p className="text-xs font-bold text-slate-800">🔥 Ne ratez plus les Ventes Flash</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Recevez nos promotions et des suggestions selon ce que vous aimez. Désactivable à tout moment dans votre profil.</p>
      <div className="mt-2 flex gap-2">
        <button onClick={enable} disabled={busy} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{busy ? '…' : 'Activer'}</button>
        <button onClick={dismiss} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Plus tard</button>
      </div>
    </div>
  );
};
