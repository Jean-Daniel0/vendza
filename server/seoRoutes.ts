// Routes SEO : pages lisibles par Google et les IA (produits, boutiques, catégories, pages d'info), sitemap, llms.txt, catalogue, IndexNow.
import fs from 'fs';
import path from 'path';
import type { Express, Request, Response, NextFunction } from 'express';
import {
  SITE_ORIGIN, Product, Shop, LANDINGS, FooterData, abs, cleanCategory, slugify, idFromSlug, imageUrl, isAvailable, productPath, shopPath, categoryPath,
  productPage, shopPage, categoryPage, landingPage, layout, homeFallback, buildSitemap, buildLlmsTxt, buildLlmsFull, buildCatalogJson, robotsTxt,
  HOME_MARK_START, HOME_MARK_END, SitemapEntry
} from './seo';

export const INDEXNOW_KEY = 'b6f1d2c93a7e4f58a1c0d9e27b3f6a41';
const PRODUCT_COLS = 'id,vendor_id,name,description,price,old_price,stock,category,image_url,gallery,created_at,updated_at,status,is_active,departement,commune,delivery_time';
const SHOP_COLS = 'id,vendor_id,shop_name,description,logo_url,statut_verification,created_at,updated_at'; // jamais de données privées (pièces d'identité, banque…)

type Catalog = { products: Product[]; shops: Shop[]; categories: string[]; at: number };
let cache: Catalog | null = null;

async function loadCatalog(db: any, force = false): Promise<Catalog> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache;
  const [p, a, s] = await Promise.all([
    db.from('products').select(PRODUCT_COLS).limit(5000),
    db.from('products_archive').select('id,vendor_id,name,description,price,category,image_url,departement,commune,created_at,deleted_at').limit(5000),
    db.from('shops').select(SHOP_COLS).limit(2000),
  ]);
  const live: Product[] = (p.data || []).filter((x: any) => (x.status ?? 'published') === 'published');
  const liveIds = new Set(live.map(x => x.id));
  const archived: Product[] = (a.data || []).filter((x: any) => !liveIds.has(x.id)).map((x: any) => ({ ...x, stock: 0, status: 'archived', updated_at: x.deleted_at, archived: true }));
  const shops: Shop[] = (s.data || []).filter((x: any) => x.shop_name);
  const products = [...live, ...archived].sort((x, y) => new Date(y.created_at || 0).getTime() - new Date(x.created_at || 0).getTime());
  const categories = [...new Set(live.map(x => cleanCategory(x.category)))].sort();
  cache = { products, shops, categories, at: Date.now() };
  return cache;
}

const footerOf = (c: Catalog): FooterData => ({ categories: c.categories, shops: c.shops });
const html = (res: Response, status: number, body: string) =>
  res.status(status).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' }).send(body);
const text = (res: Response, type: string, body: string, maxAge = 600) =>
  res.status(200).set({ 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': `public, max-age=${maxAge}` }).send(body);

export function allSeoUrls(c: Catalog): SitemapEntry[] {
  const latest = (ps: Product[]) => ps.reduce<string | null>((m, x) => (x.updated_at && (!m || x.updated_at > m) ? x.updated_at : m), null);
  const out: SitemapEntry[] = [{ loc: `${SITE_ORIGIN}/`, priority: 1.0, lastmod: latest(c.products) || new Date().toISOString() }];
  LANDINGS.forEach(l => out.push({ loc: abs(l.path), priority: 0.8 }));
  c.categories.forEach(cat => out.push({ loc: abs(categoryPath(cat)), priority: 0.7, lastmod: latest(c.products.filter(p => cleanCategory(p.category) === cat)) }));
  c.shops.forEach(s => out.push({ loc: abs(shopPath(s)), priority: 0.7, lastmod: s.updated_at || s.created_at }));
  c.products.forEach(p => out.push({ loc: abs(productPath(p)), priority: p.archived || !isAvailable(p) ? 0.4 : 0.8, lastmod: p.updated_at || p.created_at, images: [imageUrl(p)] }));
  return out;
}

export async function submitIndexNow(urls: string[]): Promise<{ submitted: number; status?: number }> {
  const urlList = [...new Set(urls)].slice(0, 10000);
  if (!urlList.length) return { submitted: 0 };
  const host = new URL(SITE_ORIGIN).host;
  const r = await fetch('https://api.indexnow.org/IndexNow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`, urlList }) });
  return { submitted: urlList.length, status: r.status };
}

// Tâche planifiée : prévient Bing/Yandex/… (et donc les assistants IA qui s'appuient sur eux) des pages nouvelles ou modifiées
export async function runIndexNow(db: any, all = false, sinceMs = 45 * 60_000) {
  const c = await loadCatalog(db, true);
  const cutoff = Date.now() - sinceMs;
  const urls = allSeoUrls(c).filter(e => all || (e.lastmod && new Date(e.lastmod).getTime() >= cutoff)).map(e => e.loc);
  if (!urls.length) return { status: 'skipped' as const, reason: 'aucune page modifiée' };
  const r = await submitIndexNow(urls);
  return { status: 'sent' as const, recipients: r.submitted, details: { http: r.status } };
}

export function registerSeoRoutes(app: Express, db: any) {
  const safe = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(err => { console.error('[seo]', req.path, err?.message); if (!res.headersSent) res.status(500).type('text/plain').send('Erreur temporaire'); });
  const catalog = () => loadCatalog(db);

  app.get('/robots.txt', (_req, res) => text(res, 'text/plain', robotsTxt(), 3600));
  app.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => text(res, 'text/plain', INDEXNOW_KEY, 86400));
  app.get('/llms.txt', (_req, res) => text(res, 'text/plain', buildLlmsTxt(), 3600));
  app.get('/llms-full.txt', safe(async (_req, res) => { const c = await catalog(); text(res, 'text/plain', buildLlmsFull(c.products, c.shops), 600); }));
  app.get('/catalogue.json', safe(async (_req, res) => { const c = await catalog(); text(res, 'application/json', JSON.stringify(buildCatalogJson(c.products, c.shops)), 600); }));
  app.get('/sitemap.xml', safe(async (_req, res) => { const c = await catalog(); text(res, 'application/xml', buildSitemap(allSeoUrls(c)), 600); }));

  LANDINGS.forEach(l => app.get(l.path, safe(async (_req, res) => html(res, 200, landingPage(l, footerOf(await catalog()))))));

  app.get('/produit/:slug', safe(async (req, res) => {
    const id = idFromSlug(req.params.slug); const c = await catalog();
    let p = c.products.find(x => x.id === id);
    if (!p && id) { // produit créé depuis moins d'une minute
      const { data } = await db.from('products').select(PRODUCT_COLS).eq('id', id).maybeSingle();
      if (data && (data.status ?? 'published') === 'published') p = data;
      else { const { data: a } = await db.from('products_archive').select('*').eq('id', id).maybeSingle(); if (a) p = { ...a, stock: 0, archived: true }; }
    }
    if (!p) return html(res, 404, layout({ title: 'Produit introuvable | Vendza', description: 'Ce produit n\'existe pas.', path: req.path, noindex: true, footer: footerOf(c),
      body: '<h1>Produit introuvable</h1><p>Ce produit n\'existe pas. <a href="/">Retourner à la marketplace Vendza</a>.</p>' }));
    if (req.params.slug !== productPath(p).split('/').pop()) return res.redirect(301, productPath(p)); // une seule URL par produit
    const shop = c.shops.find(s => s.vendor_id === p!.vendor_id) || null;
    const related = c.products.filter(x => x.id !== p!.id && !x.archived && isAvailable(x) && cleanCategory(x.category) === cleanCategory(p!.category)).slice(0, 6);
    html(res, 200, productPage(p, shop, related.length ? related : c.products.filter(x => x.id !== p!.id && isAvailable(x)).slice(0, 6), footerOf(c)));
  }));

  app.get('/boutique/:slug', safe(async (req, res) => {
    const id = idFromSlug(req.params.slug); const c = await catalog(); const s = c.shops.find(x => x.id === id);
    if (!s) return html(res, 404, layout({ title: 'Boutique introuvable | Vendza', description: 'Cette boutique n\'existe pas.', path: req.path, noindex: true, footer: footerOf(c),
      body: '<h1>Boutique introuvable</h1><p><a href="/">Retourner à la marketplace Vendza</a>.</p>' }));
    if (req.params.slug !== shopPath(s).split('/').pop()) return res.redirect(301, shopPath(s));
    html(res, 200, shopPage(s, c.products.filter(p => p.vendor_id === s.vendor_id && isAvailable(p)), footerOf(c)));
  }));

  app.get('/categorie/:slug', safe(async (req, res) => {
    const c = await catalog(); const label = c.categories.find(x => slugify(x, 'categorie') === req.params.slug);
    if (!label) return html(res, 404, layout({ title: 'Catégorie introuvable | Vendza', description: 'Cette catégorie n\'existe pas.', path: req.path, noindex: true, footer: footerOf(c),
      body: '<h1>Catégorie introuvable</h1><p><a href="/">Retourner à la marketplace Vendza</a>.</p>' }));
    html(res, 200, categoryPage(label, c.products.filter(p => cleanCategory(p.category) === label && isAvailable(p)), footerOf(c)));
  }));

  // Images enregistrées en base64 : servies comme de vraies images (Google Images, aperçus de partage)
  app.get('/media/produit/:file', safe(async (req, res) => {
    const id = idFromSlug(req.params.file.replace(/\.\w+$/, '')); if (!id) return res.status(404).end();
    const c = await catalog(); const p = c.products.find(x => x.id === id); const src = p?.image_url || '';
    if (/^https?:/i.test(src)) return res.redirect(302, src);
    const m = src.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i); if (!m) return res.status(404).end();
    res.set({ 'Content-Type': m[1], 'Cache-Control': 'public, max-age=86400' }).send(Buffer.from(m[2], 'base64'));
  }));

  // Accueil : même application, mais avec un contenu réel (catégories, produits, boutiques) lisible sans JavaScript
  app.get('/', safe(async (req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || req.query.product || req.query.p || req.query.id) return next();
    const file = path.join(process.cwd(), 'dist', 'index.html'); if (!fs.existsSync(file)) return next();
    const c = await catalog(); let page = fs.readFileSync(file, 'utf-8');
    const re = new RegExp(`${HOME_MARK_START}[\\s\\S]*?${HOME_MARK_END}`);
    if (!re.test(page)) return next();
    page = page.replace(re, () => homeFallback(c.products.filter(p => !p.archived), c.shops, c.categories));
    res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' }).send(page);
  }));
}
