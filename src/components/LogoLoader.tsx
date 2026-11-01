import React from 'react';

// Indicateur de chargement aux couleurs de Vendza : le logo respire au centre d'un anneau dégradé qui tourne.
export const LogoLoader: React.FC<{ size?: number; label?: string; className?: string }> = ({ size = 72, label = 'Chargement', className = '' }) => {
  const stroke = Math.max(3, Math.round(size / 18));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div role="status" aria-label={label} className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg className="absolute inset-0 vz-loader-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="vz-loader-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#vz-loader-grad)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circ * 0.28} ${circ}`} />
      </svg>
      <img src="/images/logo-vendza-loader.png" alt="" width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} className="vz-loader-logo select-none" draggable={false} />
      <span className="sr-only">{label}</span>
    </div>
  );
};
