import React, { useEffect, useState } from 'react';
import { apiFetchAuthed } from '../lib/api';
import { FOUNDER_DAYS, FOUNDER_TOTAL } from '../lib/founder';

export type FounderSpots = { total: number; taken: number; remaining: number; available: boolean };

/** Données réelles du programme : places restantes (public) et statut du vendeur connecté. */
export function useFounderOffer(userId?: string, isVendor?: boolean) {
  const [spots, setSpots] = useState<FounderSpots | null>(null);
  const [member, setMember] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId || !isVendor) return;
    let alive = true;
    fetch('/api/public/founder-spots').then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d) setSpots(d); }).catch(() => {});
    apiFetchAuthed('/api/founder/me').then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d) setMember(d.member === true); }).catch(() => {});
    return () => { alive = false; };
  }, [userId, isVendor]);
  // L'offre n'est montrée que si la table existe, qu'il reste des places et que le vendeur n'est pas déjà membre
  const open = !!spots && spots.available && spots.remaining > 0 && member === false;
  return { spots, member, open, reload: () => { fetch('/api/public/founder-spots').then(r => r.json()).then(setSpots).catch(() => {}); apiFetchAuthed('/api/founder/me').then(r => r.json()).then(d => setMember(d.member === true)).catch(() => {}); } };
}

/** Carte d'invitation : image + texte posés par-dessus, compteur toujours à jour. */
export const FounderInviteCard: React.FC<{ remaining: number; onCta: () => void; ctaLabel?: string; busy?: boolean; onClose?: () => void }> = ({ remaining, onCta, ctaLabel = 'Réserver ma place', busy, onClose }) => (
  <div className="relative overflow-hidden rounded-2xl bg-[#0c1445] text-white shadow-lg" style={{ containerType: 'inline-size' }}>
    <img src="/images/programme-fondateurs.webp" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
    <div className="absolute inset-0 bg-gradient-to-r from-[#0c1445]/90 via-[#0c1445]/60 to-transparent sm:from-transparent sm:via-transparent" />
    <div className="relative flex min-h-[190px] flex-col justify-center gap-2 p-4 sm:min-h-0 sm:w-[58%] sm:p-6 sm:py-8">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-300">Programme fondateurs</p>
      <h3 className="text-lg font-black leading-tight sm:text-2xl">Rejoins les {FOUNDER_TOTAL} premiers vendeurs de Vendza</h3>
      <p className="text-xs text-blue-100 sm:text-sm">Commission réduite de 90 % pendant {FOUNDER_DAYS} jours. Il reste <b className="text-amber-300">{remaining} place{remaining > 1 ? 's' : ''}</b> sur {FOUNDER_TOTAL}.</p>
      <button onClick={onCta} disabled={busy} className="mt-1 w-fit rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-[#0c1445] shadow disabled:opacity-60">{ctaLabel}</button>
    </div>
    {onClose && <button aria-label="Fermer" onClick={onClose} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-sm font-bold text-white">×</button>}
  </div>
);
