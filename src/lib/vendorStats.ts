import { useEffect, useState } from 'react';

export type VendorStats = { completed: number; cancelled: number; delivery_rate: number | null };
const cache = new Map<string, VendorStats>();

// Statistiques réelles d'une boutique (commandes terminées, taux de livraison réussie), calculées par le serveur
export function useVendorStats(vendorId?: string): VendorStats | null {
  const [stats, setStats] = useState<VendorStats | null>(vendorId ? cache.get(vendorId) || null : null);
  useEffect(() => {
    if (!vendorId || !/^[0-9a-f-]{36}$/i.test(vendorId)) { setStats(null); return; }
    const hit = cache.get(vendorId); if (hit) { setStats(hit); return; }
    let alive = true;
    fetch(`/api/public/vendor-stats/${vendorId}`).then(r => (r.ok ? r.json() : null)).then(j => {
      if (!alive || !j) return; cache.set(vendorId, j); setStats(j);
    }).catch(() => {});
    return () => { alive = false; };
  }, [vendorId]);
  return stats;
}
