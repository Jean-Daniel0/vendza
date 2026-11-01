import React, { useState } from 'react';
import { PushStatus, pushPromptMode } from '../lib/pushPrompt';
import type { EnableResult } from '../lib/pushStatus';

import { EIcon } from './EIcon';
const KEY = 'vendza_push_prompt_dismissed_at';

// Petit pop-up pour les comptes connectés qui ne sont pas abonnés aux notifications
export const PushPermissionPrompt: React.FC<{ userId?: string; status: PushStatus; onEnable: () => Promise<EnableResult>; unavailable?: boolean }> = ({ userId, status, onEnable, unavailable }) => {
  const [dismissedAt, setDismissedAt] = useState<number>(() => { try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; } });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EnableResult | null>(null);
  const mode = pushPromptMode(userId, status, dismissedAt);
  // Service de notifications inutilisable sur ce navigateur : on ne propose rien plutôt que d'afficher une erreur
  if (mode === 'hidden' || unavailable) return null;

  const dismiss = () => { const t = Date.now(); try { localStorage.setItem(KEY, String(t)); } catch {} setDismissedAt(t); };
  const enable = async () => { setBusy(true); setResult(null); try { setResult(await onEnable()); } finally { setBusy(false); } };

  return (
    <div role="dialog" aria-label="Activer les notifications" className="fixed bottom-20 left-3 right-3 z-[60] mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-3 shadow-xl">
      <p className="text-xs font-bold text-slate-800"><EIcon name="Bell" /> Activez les notifications</p>
      {mode === 'ask' ? (
        <>
          <p className="mt-0.5 text-[11px] text-slate-500">Soyez alerté pour vos commandes, vos messages et les livraisons, même quand l'application est fermée.</p>
          {result && !result.ok && (
            <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
              <p>{result.message}</p>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button onClick={enable} disabled={busy} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{busy ? '…' : 'Activer les notifications'}</button>
            <button onClick={dismiss} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Plus tard</button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-0.5 text-[11px] text-slate-500">Les notifications sont bloquées pour ce site. Appuyez sur le cadenas près de l'adresse, choisissez « Autoriser » pour les notifications, puis rechargez la page.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => window.location.reload()} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">J'ai autorisé, recharger</button>
            <button onClick={dismiss} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Plus tard</button>
          </div>
        </>
      )}
    </div>
  );
};
