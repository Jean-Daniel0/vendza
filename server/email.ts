// E-mails transactionnels de Vendza via Resend (API REST, sans SDK).
// Sans RESEND_API_KEY et EMAIL_FROM, rien n'est envoyé et rien ne casse : la plateforme fonctionne comme avant.
export type EmailConfig = { apiKey: string; from: string; replyTo?: string; siteUrl: string };

export function loadEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = (env.RESEND_API_KEY || '').trim();
  const from = (env.EMAIL_FROM || '').trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, replyTo: (env.EMAIL_REPLY_TO || '').trim() || undefined, siteUrl: (env.BASE_URL || 'https://www.vendza.store').replace(/\/+$/, '') };
}

/** Tout texte venant d'un utilisateur (nom, produit, adresse) est échappé avant d'entrer dans le HTML. */
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const oneLine = (s: unknown): string => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
export const gdes = (n: unknown): string => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} Gdes`;
export const shortRef = (id: unknown): string => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();

export type Rendered = { subject: string; html: string; text: string };
export type MailItem = { name: string; qty: number; price: number };

export function normalizeItems(raw: unknown): MailItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i: any) => ({
    name: oneLine(i?.productNom ?? i?.product_name ?? i?.nom ?? i?.name ?? 'Article'),
    qty: Number(i?.qte ?? i?.quantity ?? i?.qty ?? 1) || 1,
    price: Number(i?.prix ?? i?.price ?? i?.unit_price ?? 0) || 0,
  }));
}

const BRAND = '#0f766e';
function layout(siteUrl: string, title: string, bodyHtml: string, cta?: { label: string; path: string }, footerHtml = ''): string {
  const button = cta ? `<p style="margin:24px 0 0"><a href="${esc(siteUrl + cta.path)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px">${esc(cta.label)}</a></p>` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${BRAND};padding:18px 24px;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:.5px">Vendza</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55"><h1 style="margin:0 0 14px;font-size:19px">${esc(title)}</h1>${bodyHtml}${button}</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5">Vendza, la marketplace haïtienne. Vos paiements sont protégés jusqu'à la livraison.<br><a href="${esc(siteUrl)}" style="color:#64748b">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a>${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 12px">${t}</p>`;
function itemsTable(items: MailItem[], total: number, shipping: number): string {
  const rows = items.map(i => `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${esc(i.name)}${i.qty > 1 ? ` x${i.qty}` : ''}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #e2e8f0;white-space:nowrap">${esc(gdes(i.price * i.qty))}</td></tr>`).join('');
  const ship = shipping > 0 ? `<tr><td style="padding:6px 0;color:#64748b">Livraison</td><td align="right" style="padding:6px 0;color:#64748b">${esc(gdes(shipping))}</td></tr>` : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;font-size:14px">${rows}${ship}<tr><td style="padding:10px 0 0;font-weight:bold">Total</td><td align="right" style="padding:10px 0 0;font-weight:bold">${esc(gdes(total))}</td></tr></table>`;
}
const itemsText = (items: MailItem[], total: number, shipping: number) =>
  [...items.map(i => `- ${i.name}${i.qty > 1 ? ` x${i.qty}` : ''} : ${gdes(i.price * i.qty)}`), shipping > 0 ? `Livraison : ${gdes(shipping)}` : '', `Total : ${gdes(total)}`].filter(Boolean).join('\n');

export type OrderMail = { siteUrl: string; orderId: string; items: MailItem[]; total: number; shipping: number; commune?: string; name?: string; vendorName?: string };
const hello = (n?: string) => (n ? `Bonjour ${esc(oneLine(n))},` : 'Bonjour,');
const helloT = (n?: string) => (n ? `Bonjour ${oneLine(n)},` : 'Bonjour,');

export function orderConfirmedBuyer(d: OrderMail): Rendered {
  const ref = shortRef(d.orderId);
  const html = layout(d.siteUrl, 'Votre commande est confirmée',
    p(hello(d.name)) + p(`Votre paiement a bien été reçu pour la commande <b>#${esc(ref)}</b>${d.vendorName ? ` chez <b>${esc(oneLine(d.vendorName))}</b>` : ''}. Il est placé en sécurité : le vendeur ne sera payé qu'après votre confirmation de réception.`)
    + itemsTable(d.items, d.total, d.shipping) + (d.commune ? p(`Livraison : ${esc(oneLine(d.commune))}`) : '')
    + p('À la livraison, le vendeur vous montre un QR code : scannez-le depuis votre ticket sur Vendza pour confirmer la réception.'),
    { label: 'Voir ma commande', path: '/client/tableau-de-bord-client' });
  const text = `${helloT(d.name)}\n\nVotre paiement a bien été reçu pour la commande #${ref}. Il est placé en sécurité : le vendeur ne sera payé qu'après votre confirmation de réception.\n\n${itemsText(d.items, d.total, d.shipping)}\n\nÀ la livraison, scannez le QR code du vendeur depuis votre ticket sur Vendza pour confirmer la réception.\n${d.siteUrl}/client/tableau-de-bord-client`;
  return { subject: `Commande #${ref} confirmée`, html, text };
}

export function newOrderVendor(d: OrderMail): Rendered {
  const ref = shortRef(d.orderId);
  const html = layout(d.siteUrl, 'Nouvelle commande à préparer',
    p(hello(d.name)) + p(`Vous avez reçu la commande <b>#${esc(ref)}</b>. Le paiement est confirmé et sécurisé : préparez le colis et livrez-le.`)
    + itemsTable(d.items, d.total, d.shipping) + (d.commune ? p(`Zone de livraison : ${esc(oneLine(d.commune))}`) : '')
    + p("À la remise du colis, ouvrez le ticket de la commande et montrez le QR code à l'acheteur : vous êtes payé dès qu'il le scanne."),
    { label: 'Ouvrir mes commandes', path: '/vendeur/tableau-de-bord-vendeur' });
  const text = `${helloT(d.name)}\n\nVous avez reçu la commande #${ref}. Le paiement est confirmé et sécurisé : préparez le colis et livrez-le.\n\n${itemsText(d.items, d.total, d.shipping)}\n\nÀ la remise du colis, montrez le QR code du ticket à l'acheteur : vous êtes payé dès qu'il le scanne.\n${d.siteUrl}/vendeur/tableau-de-bord-vendeur`;
  return { subject: `Nouvelle commande #${ref} à préparer`, html, text };
}

export function deliveryConfirmedBuyer(d: OrderMail): Rendered {
  const ref = shortRef(d.orderId);
  const html = layout(d.siteUrl, 'Réception confirmée', p(hello(d.name)) + p(`Vous avez confirmé la réception de la commande <b>#${esc(ref)}</b>. Le vendeur est maintenant payé. Merci d'avoir acheté sur Vendza.`) + itemsTable(d.items, d.total, d.shipping),
    { label: 'Mes commandes', path: '/client/tableau-de-bord-client' });
  return { subject: `Réception confirmée : commande #${ref}`, html, text: `${helloT(d.name)}\n\nVous avez confirmé la réception de la commande #${ref}. Le vendeur est maintenant payé. Merci d'avoir acheté sur Vendza.\n\n${itemsText(d.items, d.total, d.shipping)}` };
}

export function deliveryConfirmedVendor(d: OrderMail): Rendered {
  const ref = shortRef(d.orderId);
  const html = layout(d.siteUrl, "L'acheteur a confirmé la réception", p(hello(d.name)) + p(`La commande <b>#${esc(ref)}</b> est confirmée livrée. Votre virement MonCash est en cours de traitement : vous recevrez un nouvel e-mail dès qu'il est envoyé.`),
    { label: 'Voir mes ventes', path: '/vendeur/tableau-de-bord-vendeur' });
  return { subject: `Commande #${ref} livrée : virement en cours`, html, text: `${helloT(d.name)}\n\nLa commande #${ref} est confirmée livrée. Votre virement MonCash est en cours de traitement : vous recevrez un nouvel e-mail dès qu'il est envoyé.` };
}

export function payoutSentVendor(d: { siteUrl: string; orderId: string; amount: number; name?: string }): Rendered {
  const ref = shortRef(d.orderId);
  const html = layout(d.siteUrl, 'Votre paiement a été envoyé', p(hello(d.name)) + p(`Nous avons envoyé <b>${esc(gdes(d.amount))}</b> sur votre compte MonCash pour la commande <b>#${esc(ref)}</b>.`),
    { label: 'Voir mon portefeuille', path: '/vendeur/tableau-de-bord-vendeur' });
  return { subject: `${gdes(d.amount)} envoyés sur votre MonCash`, html, text: `${helloT(d.name)}\n\nNous avons envoyé ${gdes(d.amount)} sur votre compte MonCash pour la commande #${ref}.` };
}

export function payoutFailedAdmin(d: { siteUrl: string; orderId: string; reason?: string }): Rendered {
  const ref = shortRef(d.orderId);
  const html = layout(d.siteUrl, 'Virement vendeur échoué', p(`Le virement de la commande <b>#${esc(ref)}</b> a échoué chez Bazik${d.reason ? ` : ${esc(oneLine(d.reason))}` : ''}.`) + p('La commande réapparaît dans « Virements vendeurs » : vérifiez le solde Bazik et le numéro MonCash du vendeur, puis relancez.'),
    { label: 'Ouvrir les paiements', path: '/admin/paiements' });
  return { subject: `Virement échoué : commande #${ref}`, html, text: `Le virement de la commande #${ref} a échoué chez Bazik${d.reason ? ` : ${oneLine(d.reason)}` : ''}. Vérifiez le solde Bazik et le numéro MonCash du vendeur, puis relancez : ${d.siteUrl}/admin/paiements` };
}

export function refundPaidBuyer(d: { siteUrl: string; amount: number; reference?: string; name?: string; method?: 'moncash' | 'card' }): Rendered {
  const where = d.method === 'card' ? 'sur votre carte bancaire (le montant apparaît selon le délai de votre banque)' : 'sur votre compte MonCash';
  const html = layout(d.siteUrl, 'Votre remboursement est envoyé', p(hello(d.name)) + p(`Nous vous avons remboursé <b>${esc(gdes(d.amount))}</b> ${where}.${d.reference && d.method !== 'card' ? ` Référence de la transaction : <b>${esc(oneLine(d.reference))}</b>.` : ''}`));
  return { subject: `Remboursement de ${gdes(d.amount)} envoyé`, html, text: `${helloT(d.name)}\n\nNous vous avons remboursé ${gdes(d.amount)} ${where}.${d.reference && d.method !== 'card' ? ` Référence : ${oneLine(d.reference)}.` : ''}` };
}

export function welcome(d: { siteUrl: string; name?: string; vendor?: boolean }): Rendered {
  const html = layout(d.siteUrl, 'Bienvenue sur Vendza', p(hello(d.name)) + p(d.vendor ? 'Votre compte vendeur est créé. Complétez votre profil et votre boutique pour commencer à vendre.' : 'Votre compte est créé. Complétez votre profil (téléphone, adresse) pour commander plus vite.') + p('Chaque achat est protégé : le vendeur n\'est payé qu\'après votre confirmation de réception.'),
    { label: 'Compléter mon profil', path: d.vendor ? '/vendeur/tableau-de-bord-vendeur' : '/client/tableau-de-bord-client' });
  return { subject: 'Bienvenue sur Vendza', html, text: `${helloT(d.name)}\n\nVotre compte est créé. Complétez votre profil pour ${d.vendor ? 'commencer à vendre' : 'commander plus vite'} : ${d.siteUrl}` };
}

/** Invitation au programme fondateurs. Image de fond en JPEG (lue partout) ; le texte est posé en HTML, jamais dans l'image. */
export function founderInvite(d: { siteUrl: string; name?: string; remaining: number; unsubscribeUrl: string; total?: number; days?: number; minProducts?: number }): Rendered {
  const total = d.total ?? 50, days = d.days ?? 90, minProducts = d.minProducts ?? 5;
  const img = `${d.siteUrl}/images/programme-fondateurs-email.jpg`;
  const places = `${d.remaining} place${d.remaining > 1 ? 's' : ''} sur ${total}`;
  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0c1445" background="${esc(img)}" style="background-color:#0c1445;background-image:linear-gradient(to right,rgba(12,20,69,0.97) 0%,rgba(12,20,69,0.9) 55%,rgba(12,20,69,0.3) 75%,rgba(12,20,69,0) 90%),url('${esc(img)}');background-position:right center;background-size:cover;background-repeat:no-repeat;border-radius:12px"><tr><td width="66%" style="padding:22px 18px;color:#ffffff"><p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:2px;color:#fcd34d">PROGRAMME FONDATEURS</p><p style="margin:0 0 8px;font-size:19px;line-height:1.2;font-weight:bold;color:#ffffff">Rejoignez les ${total} premiers vendeurs de Vendza</p><p style="margin:0;font-size:13px;line-height:1.45;color:#dbeafe">Commission réduite de 90 % pendant ${days} jours. Il reste <b style="color:#fcd34d">${esc(places)}</b>.</p></td><td width="34%">&nbsp;</td></tr></table>`;
  const html = layout(d.siteUrl, 'Une place vous attend',
    p(hello(d.name)) + hero + `<div style="height:14px"></div>`
    + p(`Pendant ${days} jours, la commission de Vendza est réduite de 90 % sur vos ventes (par exemple 20 % devient 2 %). Les places sont limitées et réparties à parts égales entre les catégories.`)
    + p(`Pour en profiter : faites vérifier votre identité et publiez au moins ${minProducts} produits, puis réservez votre place depuis votre tableau de bord.`),
    { label: 'Réserver ma place', path: '/vendeur/tableau-de-bord-vendeur' },
    `<br><br>Vous recevez cet e-mail car les promotions sont activées sur votre compte. <a href="${esc(d.unsubscribeUrl)}" style="color:#64748b">Se désinscrire</a>`);
  const text = `${helloT(d.name)}\n\nProgramme fondateurs : rejoignez les ${total} premiers vendeurs de Vendza. Commission réduite de 90 % pendant ${days} jours. Il reste ${places}.\n\nPour en profiter : faites vérifier votre identité et publiez au moins ${minProducts} produits, puis réservez votre place :\n${d.siteUrl}/vendeur/tableau-de-bord-vendeur\n\nSe désinscrire : ${d.unsubscribeUrl}`;
  return { subject: `Il reste ${places} au programme fondateurs Vendza`, html, text };
}

export type SendResult = { ok: true; id?: string } | { ok: false; status: number; error: string };

/** Envoi via Resend. La clé d'idempotence évite un doublon si la même demande est rejouée (webhook rejoué). */
export async function sendViaResend(cfg: EmailConfig, msg: { to: string; rendered: Rendered; idempotencyKey?: string; headers?: Record<string, string> }, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const to = oneLine(msg.to);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return { ok: false, status: 0, error: 'adresse invalide' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json', ...(msg.idempotencyKey ? { 'Idempotency-Key': msg.idempotencyKey.slice(0, 250) } : {}) },
      body: JSON.stringify({ from: cfg.from, to: [to], subject: oneLine(msg.rendered.subject), html: msg.rendered.html, text: msg.rendered.text, ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}), ...(msg.headers && Object.keys(msg.headers).length ? { headers: msg.headers } : {}) }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: String(j?.message || j?.name || 'erreur Resend').slice(0, 200) };
    return { ok: true, id: typeof j?.id === 'string' ? j.id : undefined };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.name === 'AbortError' ? 'délai dépassé' : String(e?.message || 'réseau').slice(0, 200) };
  } finally { clearTimeout(timer); }
}
