import React, { useState } from 'react';
import { apiFetchAuthed } from '../lib/api';
import { FOUNDER_MIN_PRODUCTS } from '../lib/founder';
import { FounderInviteCard, useFounderOffer } from './FounderInviteCard';

// Programme fondateurs dans le tableau de bord : carte d'invitation (compteur, sans badge) ou jours restants pour un membre.
export const FounderCard: React.FC<{ userId?: string }> = ({ userId }) => {
  const { spots, member, open, reload } = useFounderOffer(userId, true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState<number | null>(null);

  React.useEffect(() => {
    if (member !== true) return;
    apiFetchAuthed('/api/founder/me').then(r => r.json()).then(d => {
      if (d?.expires_at) setDays(Math.max(0, Math.ceil((new Date(d.expires_at).getTime() - Date.now()) / 86400000)));
    }).catch(() => {});
  }, [member]);

  const claim = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await apiFetchAuthed('/api/founder/claim', { method: 'POST' });
      const d: any = await r.json().catch(() => ({}));
      setMsg(r.ok ? 'Place réservée ! Ta commission est réduite de 90 % pendant 90 jours.' : (d.error || 'Inscription impossible.'));
      reload();
    } finally { setBusy(false); }
  };

  if (!spots || !spots.available) return null;
  if (member === true) {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
        <p className="font-bold text-[#0c1445]">Programme fondateurs</p>
        <p className="mt-1">Ta commission est réduite de 90 %.{days !== null ? ` Il te reste ${days} jour${days > 1 ? 's' : ''}.` : ''}</p>
        {msg && <p className="mt-2 text-xs font-semibold text-blue-900">{msg}</p>}
      </div>
    );
  }
  if (!open) {
    return spots.remaining === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Les {spots.total} places du programme fondateurs sont toutes prises.</p> : null;
  }
  return (
    <div className="space-y-2">
      <FounderInviteCard remaining={spots.remaining} onCta={claim} busy={busy} />
      <p className="px-1 text-xs text-slate-500">Conditions : identité vérifiée, au moins {FOUNDER_MIN_PRODUCTS} produits en ligne, places réparties entre les catégories.</p>
      {msg && <p className="px-1 text-xs font-semibold text-blue-900">{msg}</p>}
    </div>
  );
};
