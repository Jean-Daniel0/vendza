import React, { useEffect, useState } from 'react';
import { apiFetchAuthed } from '../lib/api';
import { FOUNDER_DAYS, FOUNDER_MIN_PRODUCTS } from '../lib/founder';

type Spots = { total: number; taken: number; remaining: number; available: boolean };
type Me = { member: boolean; expires_at?: string };

// Programme fondateurs : compteur de places (pas de badge) et inscription du vendeur connecté.
export const FounderCard: React.FC = () => {
  const [spots, setSpots] = useState<Spots | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const r = await fetch('/api/public/founder-spots'); if (r.ok) setSpots(await r.json()); } catch { /* compteur non affiché */ }
    try { const r = await apiFetchAuthed('/api/founder/me'); if (r.ok) setMe(await r.json()); } catch { /* ignoré */ }
  };
  useEffect(() => { load(); }, []);

  const claim = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await apiFetchAuthed('/api/founder/claim', { method: 'POST' });
      const d: any = await r.json().catch(() => ({}));
      setMsg(r.ok ? 'Place réservée ! Ta commission est réduite de 90 % pendant 90 jours.' : (d.error || 'Inscription impossible.'));
      await load();
    } finally { setBusy(false); }
  };

  if (!spots || !spots.available) return null;
  const daysLeft = me?.expires_at ? Math.max(0, Math.ceil((new Date(me.expires_at).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
      <p className="font-bold text-[#0c1445]">Programme fondateurs</p>
      {me?.member ? (
        <p className="mt-1">Ta commission est réduite de 90 %. Il te reste {daysLeft} jour{daysLeft > 1 ? 's' : ''}.</p>
      ) : spots.remaining > 0 ? (
        <>
          <p className="mt-1">{spots.remaining} place{spots.remaining > 1 ? 's' : ''} restante{spots.remaining > 1 ? 's' : ''} sur {spots.total} : -90 % sur la commission Vendza pendant {FOUNDER_DAYS} jours.</p>
          <p className="mt-1 text-xs text-slate-600">Conditions : identité vérifiée, au moins {FOUNDER_MIN_PRODUCTS} produits en ligne, places réparties entre les catégories.</p>
          <button onClick={claim} disabled={busy} className="mt-3 rounded-xl bg-[#0c1445] px-4 py-2 text-xs font-bold text-white disabled:opacity-60">Réserver ma place</button>
        </>
      ) : (
        <p className="mt-1">Les {spots.total} places sont toutes prises.</p>
      )}
      {msg && <p className="mt-2 text-xs font-semibold text-blue-900">{msg}</p>}
    </div>
  );
};
