import React, { useEffect, useState } from 'react';
import { QRCodeRenderer } from './QRCodeRenderer';
import { apiFetchAuthed } from '../lib/api';

interface DeliveryCodeQRProps {
  orderId: string;
  size?: number;
  delivered?: boolean;
}

// QR que le VENDEUR présente à l'acheteur : lien vendza.store + code secret généré par le serveur.
export const DeliveryCodeQR: React.FC<DeliveryCodeQRProps> = ({ orderId, size = 105, delivered = false }) => {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setCode(''); setError('');
    if (delivered) return;
    (async () => {
      try {
        const res = await apiFetchAuthed(`/api/orders/${orderId}/delivery-code`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.code) setCode(data.code);
        else setError(data.error || 'Code indisponible');
      } catch {
        if (!cancelled) setError('Code indisponible (réseau)');
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, delivered]);

  if (delivered) return <QRCodeRenderer value={`https://www.vendza.store/?order=${orderId}`} size={size} />;
  if (!code) {
    return (
      <div style={{ width: size, minHeight: size }} className="flex items-center justify-center text-center text-[9px] font-bold text-slate-400 px-1">
        {error || 'Génération du code…'}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <QRCodeRenderer value={`https://www.vendza.store/?confirm=${orderId}&code=${code}`} size={size} />
      <span className="font-mono text-[11px] font-black tracking-[0.2em] text-slate-700">{code.slice(0, 4)}-{code.slice(4)}</span>
    </div>
  );
};
