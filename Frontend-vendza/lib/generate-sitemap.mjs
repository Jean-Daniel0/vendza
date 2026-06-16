const SUPABASE_URL = process.env.SUPABASE_URL || 'https://giakjeanwekipnvyhlxm.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
const DEFAULT_SITE_URL = process.env.SITE_URL || process.env.URL || 'https://vendza.ht';

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/a-propos', changefreq: 'monthly', priority: '0.7' },
  { path: '/connexion', changefreq: 'monthly', priority: '0.6' },
  { path: '/inscription', changefreq: 'monthly', priority: '0.6' },
  { path: '/panier', changefreq: 'weekly', priority: '0.8' },
  { path: '/profil-client', changefreq: 'weekly', priority: '0.5' },
  { path: '/tableau-de-bord-client', changefreq: 'weekly', priority: '0.5' },
  { path: '/historique-commandes', changefreq: 'weekly', priority: '0.5' },
  { path: '/mes-messages', changefreq: 'weekly', priority: '0.5' },
  { path: '/profil-vendeur', changefreq: 'weekly', priority: '0.6' },
  { path: '/mon-profil-vendeur', changefreq: 'weekly', priority: '0.5' },
  { path: '/tableau-de-bord', changefreq: 'weekly', priority: '0.6' },
  { path: '/mes-produits', changefreq: 'weekly', priority: '0.6' },
  { path: '/boite-reception', changefreq: 'daily', priority: '0.6' },
  { path: '/commandes-recues', changefreq: 'daily', priority: '0.6' },
  { path: '/abonnement', changefreq: 'monthly', priority: '0.7' }
];

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeSiteUrl(siteUrl) {
  const base = String(siteUrl || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  return base || DEFAULT_SITE_URL;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function isPublishedProduct(row) {
  if (!row || !row.id) return false;
  const status = String(row.status || '').trim().toLowerCase();
  if (!status) return true;
  if (status === 'draft' || status === 'brouillon' || status === 'archived' || status === 'deleted') {
    return false;
  }
  return true;
}

export async function fetchPublishedProducts(supabaseUrl, anonKey) {
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY manquant pour le sitemap');
  }

  const products = [];
  const pageSize = 1000;
  let offset = 0;
  const base = String(supabaseUrl || SUPABASE_URL).replace(/\/+$/, '');

  for (let page = 0; page < 50; page += 1) {
    const query = new URLSearchParams({
      select: 'id,updated_at,created_at,status',
      order: 'updated_at.desc',
      limit: String(pageSize),
      offset: String(offset)
    });

    const url = `${base}/rest/v1/products?${query.toString()}`;
    const resp = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json'
      }
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Supabase ${resp.status}: ${text.slice(0, 200)}`);
    }

    const batch = await resp.json();
    if (!Array.isArray(batch) || !batch.length) break;

    batch.forEach(function (row) {
      if (isPublishedProduct(row)) products.push(row);
    });

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return products;
}

export function buildSitemapXml(siteUrl, products) {
  const base = normalizeSiteUrl(siteUrl);
  const urls = [];

  STATIC_ROUTES.forEach(function (route) {
    urls.push(
      '  <url>' +
        '<loc>' + escapeXml(base + route.path) + '</loc>' +
        '<changefreq>' + route.changefreq + '</changefreq>' +
        '<priority>' + route.priority + '</priority>' +
      '</url>'
    );
  });

  (products || []).forEach(function (p) {
    const lastmod = toIsoDate(p.updated_at || p.created_at);
    urls.push(
      '  <url>' +
        '<loc>' + escapeXml(base + '/detail-produit?id=' + encodeURIComponent(String(p.id))) + '</loc>' +
        '<lastmod>' + lastmod + '</lastmod>' +
        '<changefreq>weekly</changefreq>' +
        '<priority>0.85</priority>' +
      '</url>'
    );
  });

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n' +
    '</urlset>\n'
  );
}

export async function generateSitemapXml(options) {
  const siteUrl = normalizeSiteUrl(options && options.siteUrl);
  const supabaseUrl = (options && options.supabaseUrl) || SUPABASE_URL;
  const anonKey = (options && options.anonKey) || SUPABASE_ANON_KEY;
  const products = await fetchPublishedProducts(supabaseUrl, anonKey);
  return buildSitemapXml(siteUrl, products);
}

export { DEFAULT_SITE_URL, SUPABASE_URL };
