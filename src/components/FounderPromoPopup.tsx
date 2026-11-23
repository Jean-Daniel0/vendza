import React, { useEffect, useState } from 'react';
import { FounderInviteCard, useFounderOffer } from './FounderInviteCard';

const KEY = 'vendza_founder_popup_until';
const read = (): number => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const write = (t: number) => { try { localStorage.setItem(KEY, String(t)); } catch { /* sans stockage, la pub peut revenir */ } };

/** Pub à l'écran : une fenêtre fermable, réaffichée au plus une fois par jour, seulement aux vendeurs éligibles. */
export const FounderPromoPopup: React.FC<{ userId?: string; isVendor?: boolean; onOpen: () => void }> = ({ userId, isVendor, onOpen }) => {
  const { spots, open } = useFounderOffer(userId, isVendor);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (!open) return;
    if (Date.now() < read()) return;
    const t = setTimeout(() => setHidden(false), 4000);
    return () => clearTimeout(t);
  }, [open]);
  if (hidden || !open || !spots) return null;
  const close = () => { write(Date.now() + 24 * 3600 * 1000); setHidden(true); };
  return (
    <div role="dialog" aria-label="Programme fondateurs" className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[440px]">
      <FounderInviteCard remaining={spots.remaining} onClose={close} ctaLabel="Découvrir l'offre" onCta={() => { write(Date.now() + 24 * 3600 * 1000); setHidden(true); onOpen(); }} />
    </div>
  );
};
