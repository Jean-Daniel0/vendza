import React, { useId } from 'react';

// Indicateur de chargement : le logo Vendza se dessine lui-même, d'un point de départ (pointe de la poignée du chariot)
// à un point d'arrivée (bout du plateau), puis les roues apparaissent. Le logo est révélé par un masque dont les traits
// suivent son tracé ; la boucle se répète tant que le chargement dure.
const PENS = [
  { cls: 'vz-pen-a', w: 40, d: 'M58 95 L116 95 Q134 95 142 114 L192 292 Q176 308 184 332 Q194 352 218 352 L406 352' }, // cadre du chariot
  { cls: 'vz-pen-d', w: 30, d: 'M205 306 L262 302 L322 296' },                                                           // dessous du ruban
  { cls: 'vz-pen-b', w: 44, d: 'M158 140 L216 140 Q246 142 258 188 L286 276 Q296 292 308 266 L346 176 Q362 142 394 140 L446 140' }, // le « V »
  { cls: 'vz-pen-c', w: 42, d: 'M444 146 Q446 150 440 168 L402 262 Q394 284 372 290 L332 298' },                          // bord droit
];

export const LogoLoader: React.FC<{ size?: number; label?: string; className?: string }> = ({ size = 84, label = 'Chargement', className = '' }) => {
  const id = 'vz' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div role="status" aria-label={label} className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="-40 -38 592 592" width={size} height={size} aria-hidden="true" className="vz-loader">
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
            <g fill="none" stroke="#fff" strokeLinejoin="round">
              {PENS.map(p => <path key={p.cls} className={`vz-pen ${p.cls}`} d={p.d} pathLength={1} strokeWidth={p.w} />)}
            </g>
            <circle className="vz-wheel vz-wheel-1" cx="230" cy="403" r="36" fill="#fff" />
            <circle className="vz-wheel vz-wheel-2" cx="361" cy="403" r="36" fill="#fff" />
          </mask>
        </defs>
        {/* Anneau qui accompagne le tracé : une piste claire et deux arcs qui tournent */}
        <circle cx="256" cy="258" r="280" fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <g className="vz-ring">
          <circle cx="256" cy="258" r="280" fill="none" stroke={`url(#${id}g)`} strokeWidth="14" strokeLinecap="round" strokeDasharray="520 1240" />
        </g>
        <g className="vz-ring vz-ring-slow">
          <circle cx="256" cy="258" r="280" fill="none" stroke="#2dd4bf" strokeOpacity="0.55" strokeWidth="14" strokeLinecap="round" strokeDasharray="150 1610" strokeDashoffset="-880" />
        </g>
        <image href="/images/logo-vendza-loader.png" x="0" y="0" width="512" height="512" mask={`url(#${id})`} className="vz-loader-img" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
};
