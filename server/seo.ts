// SEO / lisibilité IA : rendu HTML serveur (sans I/O, testable). Les pages sont lisibles sans JavaScript.
export const SITE_ORIGIN = (process.env.SITE_URL || 'https://www.vendza.store').replace(/\/$/, '');
export const SOCIAL = ['https://www.instagram.com/vendzaplatform/'];

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
export const slugify = (s: string, fallback = 'page'): string =>
  (String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)) || fallback;
const UUID_END = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export const idFromSlug = (s: string): string | null => (String(s || '').match(UUID_END)?.[1] || '').toLowerCase() || null;
export const fmtPrice = (n: number): string => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const cleanCategory = (c?: string | null): string => (String(c || '').replace(/\bfont-bold\b/g, '').trim() || 'Autre');
const trunc = (s: string, n: number): string => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

export type Product = { id: string; vendor_id?: string | null; name: string; description?: string | null; price: number; old_price?: number | null; stock?: number | null;
  category?: string | null; image_url?: string | null; gallery?: any; created_at?: string | null; updated_at?: string | null; status?: string | null; is_active?: boolean | null;
  departement?: string | null; commune?: string | null; delivery_time?: string | null; archived?: boolean };
export type Shop = { id: string; vendor_id?: string | null; shop_name: string; description?: string | null; logo_url?: string | null; statut_verification?: string | null; created_at?: string | null; updated_at?: string | null };

export const productPath = (p: Pick<Product, 'id' | 'name'>) => `/produit/${slugify(p.name, 'produit')}-${p.id}`;
export const shopPath = (s: Pick<Shop, 'id' | 'shop_name'>) => `/boutique/${slugify(s.shop_name, 'boutique')}-${s.id}`;
export const categoryPath = (c: string) => `/categorie/${slugify(cleanCategory(c), 'categorie')}`;
export const abs = (path: string) => (/^https?:/i.test(path) ? path : `${SITE_ORIGIN}${path}`);
export const appUrlForProduct = (id: string) => `${SITE_ORIGIN}/?product=${id}`;

export const isAvailable = (p: Product) => !p.archived && p.is_active !== false && (p.status ?? 'published') === 'published' && (p.stock == null || Number(p.stock) > 0);
// Les images en base64 sont servies par /media/produit/<id>.jpg (jamais collées dans le HTML)
export const imageUrl = (p: Pick<Product, 'id' | 'image_url'>): string =>
  p.image_url && /^https?:/i.test(p.image_url) ? p.image_url : p.image_url ? `${SITE_ORIGIN}/media/produit/${p.id}.jpg` : `${SITE_ORIGIN}/og-image.jpg`;

const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
export const breadcrumb = (items: Array<[string, string]>) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })) });

export const NAV: Array<[string, string]> = [
  ['/marketplace-haiti', 'Marketplace Haïti'], ['/acheter-en-ligne-haiti', 'Acheter en ligne'], ['/vendre-en-ligne-haiti', 'Vendre en ligne'],
  ['/comment-ca-marche', 'Comment ça marche'], ['/faq', 'FAQ'],
];

const CSS = `:root{--g:#0f766e;--g2:#059669;--ink:#0f172a;--mut:#475569;--bg:#f8fafc;--card:#fff;--line:#e2e8f0}
@media(prefers-color-scheme:dark){:root{--ink:#f1f5f9;--mut:#94a3b8;--bg:#0b1220;--card:#111a2e;--line:#1e293b;--g:#2dd4bf}}
*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
a{color:var(--g)}header,footer,main{max-width:980px;margin:0 auto;padding:16px 20px}header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:22px;text-decoration:none;color:var(--ink)}.brand img{width:40px;height:40px}
nav{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px}h1{font-size:30px;line-height:1.2;margin:8px 0 12px}h2{font-size:21px;margin:28px 0 8px}
.btn{display:inline-block;background:var(--g2);color:#fff!important;padding:12px 20px;border-radius:12px;font-weight:700;text-decoration:none;margin:6px 8px 6px 0}
.btn.alt{background:transparent;color:var(--g)!important;border:2px solid var(--g)}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;padding:0;list-style:none}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}.card a{text-decoration:none;color:inherit;display:block}.card img{width:100%;aspect-ratio:1;object-fit:cover;background:var(--line)}
.card div{padding:10px 12px}.card b{display:block;font-size:15px}.price{color:var(--g);font-weight:800}.old{color:var(--mut);text-decoration:line-through;font-size:13px;margin-left:6px}
.crumbs{font-size:13px;color:var(--mut)}.pill{display:inline-block;background:var(--card);border:1px solid var(--line);border-radius:99px;padding:3px 12px;font-size:13px;margin:0 6px 6px 0;text-decoration:none}
.hero img{max-width:100%;border-radius:16px;border:1px solid var(--line)}footer{font-size:13px;color:var(--mut);border-top:1px solid var(--line);margin-top:32px}footer a{margin-right:12px;white-space:nowrap}`;

export type FooterData = { categories: string[]; shops: Shop[] };
function chrome(body: string, f?: FooterData): string {
  const cats = (f?.categories || []).map(c => `<a href="${esc(categoryPath(c))}">${esc(c)}</a>`).join(' ');
  const shops = (f?.shops || []).slice(0, 12).map(s => `<a href="${esc(shopPath(s))}">${esc(s.shop_name)}</a>`).join(' ');
  return `<header><a class="brand" href="/"><img src="/logo-vendza-512.png" alt="Logo Vendza" width="40" height="40"/>Vendza</a>
<nav aria-label="Navigation principale">${NAV.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join('')}<a class="btn" href="/" style="padding:6px 14px;margin:0">Ouvrir le marché</a></nav></header>
<main>${body}</main>
<footer><p><b>Vendza</b> — marketplace sécurisé en Haïti : paiement en séquestre, livraison validée par QR Code.</p>
<p>${NAV.map(([h, l]) => `<a href="${h}">${esc(l)}</a>`).join('')}<a href="/a-propos">À propos</a><a href="/paiement-moncash-carte-haiti">MonCash &amp; carte</a><a href="/achte-sou-entenet-ayiti">Kreyòl</a></p>
${cats ? `<p>Catégories : ${cats}</p>` : ''}${shops ? `<p>Boutiques : ${shops}</p>` : ''}
<p><a href="/llms.txt">llms.txt</a><a href="/catalogue.json">Catalogue JSON</a><a href="/sitemap.xml">Plan du site</a></p></footer>`;
}

export type PageOpts = { title: string; description: string; path: string; body: string; jsonld?: unknown[]; image?: string; lang?: string; ogType?: string; footer?: FooterData; noindex?: boolean };
export function layout(o: PageOpts): string {
  const url = abs(o.path), lang = o.lang || 'fr', title = trunc(o.title, 70), desc = trunc(o.description, 160), img = o.image || `${SITE_ORIGIN}/og-image.jpg`;
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"/><link rel="canonical" href="${esc(url)}"/>
<meta name="robots" content="${o.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}"/>
<link rel="alternate" hreflang="${esc(lang)}" href="${esc(url)}"/><link rel="alternate" hreflang="x-default" href="${esc(url)}"/>
<meta property="og:type" content="${esc(o.ogType || 'website')}"/><meta property="og:site_name" content="Vendza"/><meta property="og:locale" content="${lang === 'ht' ? 'ht_HT' : 'fr_HT'}"/>
<meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(desc)}"/><meta property="og:url" content="${esc(url)}"/><meta property="og:image" content="${esc(img)}"/>
<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${esc(title)}"/><meta name="twitter:description" content="${esc(desc)}"/><meta name="twitter:image" content="${esc(img)}"/>
<link rel="icon" href="/favicon.ico" sizes="any"/><link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png"/><link rel="apple-touch-icon" href="/apple-touch-icon.png"/><meta name="theme-color" content="#0f766e"/>
<style>${CSS}</style>${(o.jsonld || []).map(ld).join('')}</head><body>${chrome(o.body, o.footer)}</body></html>`;
}

// ---------- blocs réutilisables ----------
export const productCard = (p: Product): string => `<li class="card"><a href="${esc(productPath(p))}"><img src="${esc(imageUrl(p))}" alt="${esc(p.name)}" loading="lazy" width="300" height="300"/><div><b>${esc(trunc(p.name, 60))}</b>
<span class="price">${fmtPrice(p.price)} Gdes</span>${p.old_price && Number(p.old_price) > Number(p.price) ? `<span class="old">${fmtPrice(p.old_price)} Gdes</span>` : ''}</div></a></li>`;
export const productGrid = (ps: Product[]) => ps.length ? `<ul class="grid">${ps.map(productCard).join('')}</ul>` : '';
const itemList = (ps: Product[]) => ({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: ps.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(productPath(p)), name: p.name })) });

const SELLING = 'Sur Vendza, votre paiement est gardé en séquestre : le vendeur n\'est payé qu\'après la validation de la livraison par QR Code.';
export function productAbout(p: Product, shop: Shop | null | undefined): string {
  const lieu = [p.commune, p.departement].filter(Boolean).join(', ');
  return `${p.name} est proposé sur Vendza, la marketplace sécurisée en Haïti, dans la catégorie ${cleanCategory(p.category)}${shop ? ` par la boutique ${shop.shop_name}` : ''}${lieu ? ` (${lieu})` : ''}. Prix : ${fmtPrice(p.price)} Gdes. ${SELLING}`;
}

export function productPage(p: Product, shop: Shop | null | undefined, related: Product[], footer?: FooterData): string {
  const cat = cleanCategory(p.category), path = productPath(p), ok = isAvailable(p);
  const desc = trunc((p.description || '').trim() || productAbout(p, shop), 155);
  const gallery: string[] = Array.isArray(p.gallery) ? p.gallery.filter((g: any) => typeof g === 'string' && /^https?:/i.test(g)).slice(0, 5) : [];
  const images = [imageUrl(p), ...gallery];
  const offer: any = { '@type': 'Offer', url: abs(path), priceCurrency: 'HTG', price: Number(p.price) || 0,
    availability: p.archived ? 'https://schema.org/Discontinued' : ok ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition',
    areaServed: { '@type': 'Country', name: 'Haïti' } };
  if (shop) offer.seller = { '@type': 'Organization', name: shop.shop_name, url: abs(shopPath(shop)) };
  const product: any = { '@context': 'https://schema.org', '@type': 'Product', '@id': abs(path) + '#product', name: p.name, description: (p.description || productAbout(p, shop)).slice(0, 5000),
    sku: p.id, image: images, category: cat, url: abs(path), offers: offer };
  if (shop) product.brand = { '@type': 'Brand', name: shop.shop_name };
  const body = `<p class="crumbs"><a href="/">Accueil</a> › <a href="${esc(categoryPath(cat))}">${esc(cat)}</a> › ${esc(p.name)}</p>
<div class="hero"><img src="${esc(images[0])}" alt="${esc(p.name)}" width="640" height="640"/></div>
<h1>${esc(p.name)}</h1>
<p><span class="price" style="font-size:24px">${fmtPrice(p.price)} Gdes</span>${p.old_price && Number(p.old_price) > Number(p.price) ? `<span class="old">${fmtPrice(p.old_price)} Gdes</span>` : ''}
 — ${p.archived ? 'Produit retiré de la vente' : ok ? 'Disponible' : 'Momentanément indisponible'}</p>
${p.archived || !ok ? `<p><b>Ce produit n'est plus disponible pour le moment.</b> Découvrez des produits similaires ci-dessous.</p>` : ''}
<p><a class="btn" href="${esc(appUrlForProduct(p.id))}">${ok ? 'Acheter sur Vendza' : 'Voir sur Vendza'}</a><a class="btn alt" href="${esc(appUrlForProduct(p.id))}">Contacter le vendeur</a></p>
<h2>Description</h2><p>${esc((p.description || '').trim() || productAbout(p, shop)).replace(/\n/g, '<br/>')}</p>
<h2>Détails</h2><ul><li>Catégorie : <a href="${esc(categoryPath(cat))}">${esc(cat)}</a></li>${shop ? `<li>Boutique : <a href="${esc(shopPath(shop))}">${esc(shop.shop_name)}</a></li>` : ''}
${p.commune || p.departement ? `<li>Lieu : ${esc([p.commune, p.departement].filter(Boolean).join(', '))}</li>` : ''}${p.delivery_time ? `<li>Délai de livraison : ${esc(p.delivery_time)}</li>` : ''}</ul>
<h2>Acheter en toute sécurité en Haïti</h2><p>${esc(SELLING)} Paiement par MonCash ou carte bancaire. <a href="/comment-ca-marche">Comment ça marche</a>.</p>
${related.length ? `<h2>Produits similaires</h2>${productGrid(related)}` : ''}`;
  return layout({ title: `${p.name} – ${fmtPrice(p.price)} Gdes | Vendza Haïti`, description: desc, path, body, image: images[0], ogType: 'product', footer,
    jsonld: [product, breadcrumb([['Accueil', '/'], [cat, categoryPath(cat)], [p.name, path]])] });
}

export function shopPage(s: Shop, products: Product[], footer?: FooterData): string {
  const path = shopPath(s), verified = /verif|valid|approuv/i.test(String(s.statut_verification || ''));
  const desc = trunc((s.description || '').trim() || `${s.shop_name} : boutique sur Vendza, la marketplace sécurisée en Haïti. ${products.length} produit(s) avec paiement en séquestre.`, 155);
  const store: any = { '@context': 'https://schema.org', '@type': 'Store', '@id': abs(path) + '#store', name: s.shop_name, url: abs(path), description: s.description || desc,
    areaServed: { '@type': 'Country', name: 'Haïti' }, parentOrganization: { '@type': 'Organization', name: 'Vendza', url: SITE_ORIGIN + '/' } };
  if (s.logo_url && /^https?:/i.test(s.logo_url)) store.image = s.logo_url;
  const body = `<p class="crumbs"><a href="/">Accueil</a> › Boutiques › ${esc(s.shop_name)}</p><h1>${esc(s.shop_name)}</h1>
<p>${esc((s.description || '').trim() || `${s.shop_name} vend sur Vendza, la marketplace sécurisée en Haïti.`)}</p>${verified ? '<p><b>✔ Boutique vérifiée</b></p>' : ''}
<p><a class="btn" href="/">Voir la boutique sur Vendza</a></p><h2>Produits de ${esc(s.shop_name)} (${products.length})</h2>${products.length ? productGrid(products) : '<p>Aucun produit publié pour le moment.</p>'}`;
  return layout({ title: `${s.shop_name} – Boutique en ligne en Haïti | Vendza`, description: desc, path, body, footer, image: s.logo_url && /^https?:/i.test(s.logo_url) ? s.logo_url : undefined,
    jsonld: [store, itemList(products), breadcrumb([['Accueil', '/'], [s.shop_name, path]])] });
}

export function categoryPage(label: string, products: Product[], footer?: FooterData): string {
  const path = categoryPath(label), n = products.length;
  const desc = `${label} en Haïti : ${n} produit${n > 1 ? 's' : ''} à acheter en ligne sur Vendza avec paiement sécurisé en séquestre (MonCash, carte bancaire).`;
  const body = `<p class="crumbs"><a href="/">Accueil</a> › ${esc(label)}</p><h1>${esc(label)} : acheter en ligne en Haïti</h1><p>${esc(desc)}</p>
<p><a class="btn" href="/">Parcourir tout le marché</a></p>${productGrid(products)}`;
  return layout({ title: `${label} en Haïti – Acheter en ligne | Vendza`, description: desc, path, body, footer, image: products[0] ? imageUrl(products[0]) : undefined,
    jsonld: [itemList(products), breadcrumb([['Accueil', '/'], [label, path]])] });
}

// ---------- pages d'information (mots-clés : vendza, marketplace Haïti, acheter en ligne en Haïti…) ----------
export type Landing = { path: string; title: string; description: string; h1: string; lang?: string; sections: Array<{ h2: string; p: string[] }>; faq?: Array<[string, string]> };
export const FAQ: Array<[string, string]> = [
  ['Qu\'est-ce que Vendza ?', 'Vendza est une marketplace haïtienne : des boutiques vendent leurs produits et les acheteurs paient en sécurité. L\'argent est gardé en séquestre jusqu\'à la validation de la livraison.'],
  ['Comment acheter en ligne en Haïti sur Vendza ?', 'Choisissez un produit, payez par MonCash ou carte bancaire, puis recevez votre commande. Vous confirmez la livraison avec un QR Code : seulement alors le vendeur est payé.'],
  ['Comment fonctionne le paiement en séquestre ?', 'Votre paiement n\'est pas versé tout de suite au vendeur. Il reste protégé par Vendza jusqu\'à ce que vous validiez la réception de votre commande.'],
  ['Quels moyens de paiement sont acceptés ?', 'MonCash et les cartes bancaires.'],
  ['Comment vendre sur Vendza ?', 'Créez un compte vendeur, ouvrez votre boutique, publiez vos produits avec photos et prix, puis recevez vos commandes. Votre paiement est libéré après la validation de la livraison par l\'acheteur.'],
  ['Puis-je discuter avec le vendeur avant d\'acheter ?', 'Oui. Depuis la page d\'un produit, vous pouvez écrire au vendeur : le produit concerné est mentionné automatiquement dans votre message.'],
  ['Qu\'est-ce que les Ventes Flash ?', 'Chaque jour de 8h à 20h (heure d\'Haïti), Vendza met en avant les produits en promotion.'],
];
export const LANDINGS: Landing[] = [
  { path: '/marketplace-haiti', title: 'Marketplace Haïti : acheter et vendre en ligne | Vendza', description: 'Vendza est la marketplace sécurisée en Haïti : boutiques vérifiées, paiement MonCash et carte, argent gardé en séquestre jusqu\'à la livraison.',
    h1: 'Vendza, la marketplace sécurisée en Haïti', sections: [
      { h2: 'Une marketplace pensée pour Haïti', p: ['Vendza réunit des boutiques haïtiennes et des acheteurs sur une seule plateforme. Vous trouvez de la mode, de l\'électronique, de la beauté, des accessoires et des articles pour la maison, avec le prix en gourdes (Gdes).', 'Chaque achat est protégé : votre argent reste en séquestre et n\'est libéré au vendeur qu\'après la validation de la livraison.'] },
      { h2: 'Pourquoi choisir Vendza', p: ['Paiement par MonCash ou carte bancaire. Messagerie intégrée pour parler au vendeur. Ventes Flash tous les jours de 8h à 20h. Des boutiques que vous pouvez consulter et contacter directement.'] }] },
  { path: '/acheter-en-ligne-haiti', title: 'Acheter en ligne en Haïti en toute sécurité | Vendza', description: 'Achetez en ligne en Haïti sans risque : paiement en séquestre, MonCash ou carte, validation de la livraison par QR Code. Découvrez Vendza.',
    h1: 'Acheter en ligne en Haïti sans risque d\'arnaque', sections: [
      { h2: 'Comment acheter en ligne en Haïti avec Vendza', p: ['1. Choisissez un produit et écrivez au vendeur si vous avez une question. 2. Payez par MonCash ou carte bancaire : votre argent est gardé en séquestre. 3. Recevez votre commande. 4. Validez la livraison avec le QR Code : le vendeur est alors payé.'] },
      { h2: 'Ce qui vous protège', p: ['Le vendeur ne reçoit jamais l\'argent avant que vous ayez validé la réception. Si la livraison n\'a pas lieu, la commande peut être annulée et remboursée selon les règles de la plateforme.'] }] },
  { path: '/vendre-en-ligne-haiti', title: 'Vendre en ligne en Haïti : ouvrir sa boutique | Vendza', description: 'Ouvrez votre boutique en ligne en Haïti avec Vendza : publiez vos produits, recevez des paiements sécurisés MonCash et carte, touchez plus de clients.',
    h1: 'Vendre en ligne en Haïti avec Vendza', sections: [
      { h2: 'Ouvrez votre boutique en quelques minutes', p: ['Créez un compte vendeur, présentez votre boutique, ajoutez vos produits avec photos et prix en gourdes. Vos produits sont visibles par tous les acheteurs de la marketplace et indexés par les moteurs de recherche.'] },
      { h2: 'Soyez payé en sécurité', p: ['Les clients paient à l\'avance : le montant est gardé en séquestre puis libéré dès que l\'acheteur valide la livraison par QR Code. Moins d\'impayés, plus de confiance.'] }] },
  { path: '/comment-ca-marche', title: 'Comment ça marche : paiement en séquestre et QR Code | Vendza', description: 'Découvrez le fonctionnement de Vendza : paiement en séquestre, livraison validée par QR Code, remboursement si la commande est annulée.',
    h1: 'Comment fonctionne Vendza', sections: [
      { h2: 'Le paiement en séquestre', p: ['Quand vous payez, l\'argent n\'est pas envoyé au vendeur. Vendza le garde jusqu\'à la fin de la transaction.'] },
      { h2: 'La validation par QR Code', p: ['À la livraison, vous présentez ou scannez le QR Code de la commande. Cette validation physique libère le paiement au vendeur. Sans validation, le vendeur n\'est pas payé.'] },
      { h2: 'Annulation et remboursement', p: ['Une commande annulée est remboursée selon les règles de la plateforme, et le montant retenu côté vendeur est annulé.'] }] },
  { path: '/paiement-moncash-carte-haiti', title: 'Payer en ligne en Haïti : MonCash et carte bancaire | Vendza', description: 'Payez vos achats en ligne en Haïti avec MonCash ou carte bancaire sur Vendza. Paiement protégé par séquestre.',
    h1: 'Payer avec MonCash ou carte bancaire sur Vendza', sections: [
      { h2: 'MonCash', p: ['Payez avec votre compte MonCash directement lors de la commande. Votre paiement est enregistré et protégé jusqu\'à la validation de la livraison.'] },
      { h2: 'Carte bancaire', p: ['Les cartes bancaires sont acceptées avec un paiement sécurisé. Là aussi, l\'argent reste en séquestre jusqu\'à la livraison.'] }] },
  { path: '/a-propos', title: 'À propos de Vendza : la marketplace haïtienne de confiance', description: 'Vendza (vendza.store) est une marketplace haïtienne qui sécurise les achats et les ventes en ligne grâce au séquestre et à la validation par QR Code.',
    h1: 'À propos de Vendza', sections: [
      { h2: 'Notre mission', p: ['Rendre le commerce en ligne en Haïti sûr et simple, pour les acheteurs comme pour les vendeurs. Vendza (vendza.store) protège chaque transaction avec un paiement en séquestre et une validation de livraison par QR Code.'] },
      { h2: 'Nous suivre', p: ['Instagram : vendzaplatform. Site : www.vendza.store.'] }] },
  { path: '/faq', title: 'FAQ Vendza : questions fréquentes sur acheter et vendre en Haïti', description: 'Réponses aux questions fréquentes : comment acheter en ligne en Haïti, payer avec MonCash, vendre sur Vendza, séquestre et QR Code.',
    h1: 'Questions fréquentes sur Vendza', sections: [], faq: FAQ },
  { path: '/achte-sou-entenet-ayiti', lang: 'ht', title: 'Achte ak vann sou entènèt an Ayiti | Vendza', description: 'Vendza se makèt sou entènèt ki an sekirite an Ayiti : peye ak MonCash oswa kat, lajan an rete an sekirite jiskaske ou resevwa kòmand lan.',
    h1: 'Achte ak vann sou entènèt an Ayiti ak Vendza', sections: [
      { h2: 'Ki sa Vendza ye ?', p: ['Vendza se yon makèt ayisyen sou entènèt kote boutik yo vann pwodwi yo. Ou ka achte rad, elektwonik, bote ak plis ankò, ak pri an goud.'] },
      { h2: 'Kijan ou peye an sekirite', p: ['Ou peye ak MonCash oswa kat bancaire. Lajan an rete an sekirite (sekestr) jiskaske ou valide livrezon an ak yon QR Code. Se apre sa vandè a touche.'] },
      { h2: 'Vle vann ?', p: ['Louvri boutik ou sou Vendza, mete pwodwi ou yo, epi resevwa lajan ou an sekirite.'] }] },
];

export function landingPage(l: Landing, footer?: FooterData): string {
  const body = `<p class="crumbs"><a href="/">Accueil</a> › ${esc(l.h1)}</p><h1>${esc(l.h1)}</h1>
${l.sections.map(s => `<h2>${esc(s.h2)}</h2>${s.p.map(t => `<p>${esc(t)}</p>`).join('')}`).join('')}
${l.faq ? l.faq.map(([q, a]) => `<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join('') : ''}
<p><a class="btn" href="/">Découvrir la marketplace</a><a class="btn alt" href="/vendre-en-ligne-haiti">Vendre sur Vendza</a></p>`;
  const jsonld: unknown[] = [breadcrumb([['Accueil', '/'], [l.h1, l.path]])];
  if (l.faq) jsonld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: l.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  else jsonld.push({ '@context': 'https://schema.org', '@type': 'WebPage', name: l.title, description: l.description, url: abs(l.path), inLanguage: l.lang || 'fr', isPartOf: { '@id': SITE_ORIGIN + '/#website' } });
  return layout({ title: l.title, description: l.description, path: l.path, body, footer, lang: l.lang, jsonld });
}

// ---------- accueil : contenu lisible sans JS, injecté dans #root de l'application ----------
export const HOME_MARK_START = '<!--SEO_FALLBACK_START-->', HOME_MARK_END = '<!--SEO_FALLBACK_END-->';
export function homeFallback(products: Product[], shops: Shop[], categories: string[]): string {
  const live = products.filter(isAvailable).slice(0, 12);
  return `${HOME_MARK_START}<main style="font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:24px 20px;color:#0f172a">
<h1 style="font-size:28px;margin:0 0 12px">Vendza — Marketplace sécurisé en Haïti : acheter et vendre en ligne</h1>
<p>Achetez en ligne en Haïti avec paiement en séquestre (MonCash, carte bancaire) : le vendeur est payé seulement après la validation de la livraison par QR Code.</p>
<nav><a href="/marketplace-haiti">Marketplace Haïti</a> · <a href="/acheter-en-ligne-haiti">Acheter en ligne</a> · <a href="/vendre-en-ligne-haiti">Vendre en ligne</a> · <a href="/comment-ca-marche">Comment ça marche</a> · <a href="/faq">FAQ</a> · <a href="/achte-sou-entenet-ayiti">Kreyòl</a></nav>
${categories.length ? `<h2>Catégories</h2><p>${categories.map(c => `<a href="${esc(categoryPath(c))}">${esc(c)}</a>`).join(' · ')}</p>` : ''}
${live.length ? `<h2>Produits récents</h2><ul>${live.map(p => `<li><a href="${esc(productPath(p))}">${esc(p.name)}</a> — ${fmtPrice(p.price)} Gdes</li>`).join('')}</ul>` : ''}
${shops.length ? `<h2>Boutiques</h2><ul>${shops.map(s => `<li><a href="${esc(shopPath(s))}">${esc(s.shop_name)}</a></li>`).join('')}</ul>` : ''}
<noscript><p>Activez JavaScript pour utiliser la marketplace Vendza.</p></noscript></main>${HOME_MARK_END}`;
}

// ---------- sitemap, llms.txt, catalogue ----------
export type SitemapEntry = { loc: string; lastmod?: string | null; priority?: number; images?: string[] };
export function buildSitemap(entries: SitemapEntry[]): string {
  const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    entries.map(e => `  <url><loc>${x(e.loc)}</loc>${e.lastmod ? `<lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ''}${e.priority != null ? `<priority>${e.priority.toFixed(1)}</priority>` : ''}` +
      `${(e.images || []).filter(i => /^https?:/i.test(i)).slice(0, 5).map(i => `<image:image><image:loc>${x(i)}</image:loc></image:image>`).join('')}</url>`).join('\n') + `\n</urlset>\n`;
}

export function buildLlmsTxt(): string {
  return `# Vendza\n\n> Vendza (vendza.store) est une marketplace sécurisée en Haïti. Les acheteurs paient par MonCash ou carte bancaire ; l'argent est gardé en séquestre et n'est libéré au vendeur qu'après la validation de la livraison par QR Code. Prix en gourdes haïtiennes (HTG / Gdes). Langues : français et créole haïtien.\n\n` +
    `## Pages principales\n${LANDINGS.map(l => `- [${l.h1}](${abs(l.path)}): ${l.description}`).join('\n')}\n\n## Données ouvertes\n- [Catalogue complet (JSON)](${abs('/catalogue.json')}): produits, prix, boutiques, liens\n- [Catalogue en texte](${abs('/llms-full.txt')}): liste lisible de tous les produits\n- [Plan du site](${abs('/sitemap.xml')})\n\n## À savoir pour citer Vendza\n- Nom : Vendza. Site officiel : ${SITE_ORIGIN}/ . Instagram : vendzaplatform.\n- Chaque produit a une page : ${SITE_ORIGIN}/produit/<nom>-<id>. Chaque boutique : ${SITE_ORIGIN}/boutique/<nom>-<id>.\n`;
}
export function buildLlmsFull(products: Product[], shops: Shop[]): string {
  return `# Catalogue Vendza (mis à jour automatiquement)\n\n## Boutiques\n${shops.map(s => `- ${s.shop_name}: ${abs(shopPath(s))}${s.description ? ` — ${trunc(s.description, 140)}` : ''}`).join('\n')}\n\n## Produits\n` +
    products.map(p => `- ${p.name} — ${fmtPrice(p.price)} Gdes — ${cleanCategory(p.category)} — ${p.archived ? 'retiré' : isAvailable(p) ? 'disponible' : 'indisponible'} — ${abs(productPath(p))}`).join('\n') + '\n';
}
export function buildCatalogJson(products: Product[], shops: Shop[], now = new Date()) {
  const shopName = new Map(shops.map(s => [s.vendor_id, s.shop_name]));
  return { site: SITE_ORIGIN, currency: 'HTG', generated_at: now.toISOString(),
    shops: shops.map(s => ({ id: s.id, name: s.shop_name, url: abs(shopPath(s)), description: s.description || null })),
    products: products.map(p => ({ id: p.id, name: p.name, price: Number(p.price) || 0, old_price: p.old_price ? Number(p.old_price) : null, category: cleanCategory(p.category),
      shop: shopName.get(p.vendor_id) || null, available: isAvailable(p), archived: !!p.archived, url: abs(productPath(p)), image: imageUrl(p), description: trunc(p.description || '', 400) })) };
}

export function robotsTxt(): string {
  const ai = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'cohere-ai', 'Bytespider', 'Meta-ExternalAgent', 'Amazonbot', 'DuckAssistBot', 'MistralAI-User'];
  const priv = 'Disallow: /admin/\nDisallow: /api/\nDisallow: /checkout/\nDisallow: /panier/\n';
  return `User-agent: *\nAllow: /\n${priv}\n${ai.map(b => `User-agent: ${b}\nAllow: /\n${priv}`).join('\n')}\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}
