// Détecte le sous-domaine Sellerex. En local : http://localhost:3000/?sellerex=1
export function isSellerexHost(loc: Pick<Location, 'hostname' | 'search'> | undefined = typeof window !== 'undefined' ? window.location : undefined): boolean {
  if (!loc) return false;
  const host = String(loc.hostname || '').toLowerCase();
  if (host.startsWith('sellerex.')) return true;
  return (host === 'localhost' || host === '127.0.0.1') && new URLSearchParams(loc.search || '').get('sellerex') === '1';
}
