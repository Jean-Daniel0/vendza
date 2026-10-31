// Numéro MonCash : Bazik attend 8 ou 11 chiffres (sans « + », sans espaces). On envoie toujours la forme à 8 chiffres.
// Accepte : 37 12 34 56, 3712-3456, (509) 37123456, +509 3712 3456, 00509 37123456. Refuse le reste (lettres, longueur fausse).
export function normalizeMoncashNumber(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/[\s().\-]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  if (!/^\d+$/.test(s)) return null;
  if (/^509\d{8}$/.test(s)) return s.slice(3);
  if (/^\d{8}$/.test(s)) return s;
  return null;
}
