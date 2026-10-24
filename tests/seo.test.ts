import assert from 'node:assert/strict';
import express from 'express';
import { registerSeoRoutes } from '../server/seoRoutes';
import { slugify, idFromSlug, productPath, esc } from '../server/seo';

const V = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const P1 = '11111111-1111-4111-8111-111111111111', P2 = '22222222-2222-4222-8222-222222222222', PA = '33333333-3333-4333-8333-333333333333', P3 = '44444444-4444-4444-8444-444444444444';
const tables: Record<string, any[]> = {
  products: [
    { id: P1, vendor_id: V, name: 'Robe Élégante <script>alert(1)</script>', description: 'Belle robe', price: 2500, old_price: 3500, stock: 4, category: 'Mode', image_url: 'https://img.example/robe.jpg', gallery: [], status: 'published', is_active: true, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-20T00:00:00Z', commune: 'Pétion-Ville', departement: 'Ouest' },
    { id: P2, vendor_id: V, name: 'Casque Audio', description: '', price: 5000, stock: 0, category: 'Audio', image_url: 'data:image/png;base64,iVBORw0KGgo=', status: 'published', is_active: true, created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-21T00:00:00Z' },
    { id: P3, vendor_id: V, name: 'Brouillon', price: 1, category: 'Mode', status: 'draft', is_active: true },
  ],
  products_archive: [{ id: PA, vendor_id: V, name: 'Ancien Sac', description: 'Vendu', price: 900, category: 'Mode', image_url: null, created_at: '2026-09-01T00:00:00Z', deleted_at: '2026-10-05T00:00:00Z' }],
  shops: [{ id: V, vendor_id: V, shop_name: 'Boutique Lala', description: 'Mode et audio', logo_url: null, statut_verification: 'verified', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }],
};
const db = { from: (n: string) => { let rows = tables[n] || []; const api: any = { select: () => api, limit: () => api, eq: (c: string, v: any) => { rows = rows.filter(r => r[c] === v); return api; },
  maybeSingle: async () => ({ data: rows[0] || null, error: null }), then: (res: any, rej: any) => Promise.resolve({ data: rows, error: null }).then(res, rej) }; return api; } };

(async () => {
  // utilitaires
  assert.equal(slugify('Robe Élégante !'), 'robe-elegante'); assert.equal(idFromSlug(`robe-${P1}`), P1); assert.equal(idFromSlug('nimportequoi'), null);
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');

  const app = express(); registerSeoRoutes(app, db as any);
  const server = app.listen(0); const port = (server.address() as any).port; const get = (p: string, o: any = {}) => fetch(`http://127.0.0.1:${port}${p}`, { redirect: 'manual', ...o });
  try {
    // page produit
    let r = await get(productPath({ id: P1, name: 'Robe Élégante <script>alert(1)</script>' })); let h = await r.text();
    assert.equal(r.status, 200); assert.match(h, /<link rel="canonical" href="https:\/\/www\.vendza\.store\/produit\/robe-elegante-script-alert-1-script-11111111/);
    assert.ok(!h.includes('<script>alert(1)</script>'), 'XSS échappé'); assert.match(h, /<h1>Robe Élégante &lt;script&gt;/);
    const lds = [...h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));   // JSON-LD valide
    const prod = lds.find(x => x['@type'] === 'Product'); assert.equal(prod.offers.priceCurrency, 'HTG'); assert.equal(prod.offers.price, 2500); assert.equal(prod.offers.availability, 'https://schema.org/InStock');
    assert.equal(prod.offers.seller.name, 'Boutique Lala'); assert.ok(lds.some(x => x['@type'] === 'BreadcrumbList'));
    // mauvais slug => redirection 301 vers l'URL unique
    r = await get(`/produit/mauvais-nom-${P1}`); assert.equal(r.status, 301); assert.match(r.headers.get('location')!, /^\/produit\/robe-elegante/);
    // produit épuisé : page 200, indisponible, image base64 servie via /media
    r = await get(`/produit/casque-audio-${P2}`); h = await r.text(); assert.equal(r.status, 200); assert.match(h, /OutOfStock/); assert.match(h, /\/media\/produit\/2222/);
    r = await get(`/media/produit/${P2}.jpg`); assert.equal(r.headers.get('content-type'), 'image/png'); assert.ok((await r.arrayBuffer()).byteLength > 0);
    // produit supprimé : toujours accessible (archive), marqué Discontinued
    r = await get(`/produit/ancien-sac-${PA}`); h = await r.text(); assert.equal(r.status, 200); assert.match(h, /Discontinued/); assert.match(h, /retiré de la vente/);
    // brouillon et inconnu : 404 + noindex
    r = await get(`/produit/brouillon-${P3}`); assert.equal(r.status, 404); assert.match(await r.text(), /noindex/);
    r = await get('/produit/rien'); assert.equal(r.status, 404);
    // boutique, catégorie, pages d'info
    r = await get(`/boutique/boutique-lala-${V}`); h = await r.text(); assert.equal(r.status, 200); assert.match(h, /"@type":"Store"/); assert.match(h, /Robe/);
    r = await get('/categorie/mode'); h = await r.text(); assert.equal(r.status, 200); assert.match(h, /ItemList/);
    r = await get('/categorie/inconnue'); assert.equal(r.status, 404);
    for (const p of ['/marketplace-haiti', '/acheter-en-ligne-haiti', '/vendre-en-ligne-haiti', '/comment-ca-marche', '/paiement-moncash-carte-haiti', '/a-propos', '/faq', '/achte-sou-entenet-ayiti']) {
      r = await get(p); h = await r.text(); assert.equal(r.status, 200, p); assert.match(h, /<h1>/); assert.match(h, new RegExp(`rel="canonical" href="https://www.vendza.store${p}"`)); }
    assert.match(await (await get('/faq')).text(), /FAQPage/); assert.match(await (await get('/achte-sou-entenet-ayiti')).text(), /<html lang="ht">/);
    // sitemap : tout y est (présents, épuisés, supprimés), pas les brouillons, https, pas de fragments
    const sm = await (await get('/sitemap.xml')).text();
    assert.match(sm, /\/produit\/robe-elegante/); assert.match(sm, /casque-audio-2222/); assert.match(sm, /ancien-sac-3333/); assert.ok(!sm.includes('44444444')); assert.ok(!/<loc>[^<]*#/.test(sm) && !/<loc>http:\/\//.test(sm));
    assert.match(sm, /\/boutique\/boutique-lala/); assert.match(sm, /\/categorie\/mode/); assert.match(sm, /\/faq/); assert.match(sm, /image:loc/);
    // robots, IA
    const rb = await (await get('/robots.txt')).text(); assert.match(rb, /User-agent: GPTBot\nAllow: \//); assert.match(rb, /User-agent: ClaudeBot/); assert.match(rb, /Sitemap: https:\/\/www\.vendza\.store\/sitemap\.xml/);
    const llms = await (await get('/llms.txt')).text(); assert.match(llms, /^# Vendza/); assert.match(llms, /catalogue\.json/);
    const cat = await (await get('/catalogue.json')).json() as any; assert.equal(cat.currency, 'HTG'); assert.equal(cat.products.length, 3); assert.ok(cat.products.some((p: any) => p.archived));
    assert.match(await (await get('/llms-full.txt')).text(), /Robe Élégante/);
    assert.equal((await (await get('/b6f1d2c93a7e4f58a1c0d9e27b3f6a41.txt')).text()), 'b6f1d2c93a7e4f58a1c0d9e27b3f6a41');
  } finally { server.close(); }
  console.log('  ✓ seo: 60+ assertions OK');
})().catch(e => { console.error(e); process.exit(1); });
