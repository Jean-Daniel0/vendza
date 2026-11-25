// Désinscription des e-mails promotionnels (profiles.newsletter = false).
// Le lien contient un jeton signé (HMAC) : impossible de désinscrire quelqu'un d'autre sans le secret du serveur.
// Le secret sert uniquement de clé de signature : il n'est jamais écrit dans un e-mail, un log ou une réponse.
import crypto from 'node:crypto';
import type { Express } from 'express';

export const unsubToken = (userId: string, secret: string): string => crypto.createHmac('sha256', secret).update(`unsub:${userId}`).digest('hex').slice(0, 40);

export function verifyUnsubToken(userId: string, token: string, secret: string): boolean {
  if (!secret || !userId || !token) return false;
  const a = Buffer.from(unsubToken(userId, secret)); const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const unsubscribeUrl = (siteUrl: string, userId: string, secret: string): string =>
  `${siteUrl.replace(/\/+$/, '')}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubToken(userId, secret)}`;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const page = (title: string, body: string, form = '') => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><div style="max-width:420px;margin:48px auto;background:#fff;border-radius:16px;padding:24px;text-align:center"><h1 style="font-size:20px;margin:0 0 12px">${title}</h1><p style="font-size:15px;line-height:1.5;margin:0 0 16px">${body}</p>${form}</div></body></html>`;

export function registerUnsubscribeRoutes(app: Express, { supabase, secret }: { supabase: any; secret: string }) {
  const path = '/api/email/unsubscribe';
  // Les logiciels de messagerie ouvrent parfois les liens à l'avance : la page (GET) ne change rien, seul le bouton (POST) désinscrit.
  app.get(path, (req, res) => {
    const u = String(req.query.u || ''), t = String(req.query.t || '');
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    if (!isUuid(u) || !verifyUnsubToken(u, t, secret)) return res.status(400).type('html').send(page('Lien invalide', 'Ce lien de désinscription n’est pas valide.'));
    res.type('html').send(page('Se désinscrire', 'Vous ne recevrez plus nos e-mails promotionnels. Vos e-mails de commande restent actifs.',
      `<form method="post" action="${path}?u=${encodeURIComponent(u)}&amp;t=${encodeURIComponent(t)}"><button style="background:#0f766e;color:#fff;border:0;border-radius:12px;padding:12px 22px;font-weight:bold;font-size:15px;cursor:pointer">Confirmer la désinscription</button></form>`));
  });
  app.post(path, async (req, res) => {
    const u = String(req.query.u || ''), t = String(req.query.t || '');
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    if (!isUuid(u) || !verifyUnsubToken(u, t, secret)) return res.status(400).type('html').send(page('Lien invalide', 'Ce lien de désinscription n’est pas valide.'));
    try {
      const { error } = await supabase.from('profiles').update({ newsletter: false }).eq('id', u);
      if (error) throw error;
      res.type('html').send(page('Désinscription confirmée', 'Vous ne recevrez plus d’e-mails promotionnels de Vendza.'));
    } catch { res.status(500).type('html').send(page('Erreur', 'Impossible de traiter la demande pour le moment. Réessayez plus tard.')); }
  });
}
