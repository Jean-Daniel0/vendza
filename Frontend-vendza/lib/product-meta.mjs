const SUPABASE_URL = process.env.SUPABASE_URL || 'https://giakjeanwekipnvyhlxm.supabase.co';
const DEFAULT_SITE_URL = process.env.SITE_URL || process.env.URL || 'https://vendza.ht';

export function getSiteBaseUrl(siteUrl) {
  const base = String(siteUrl || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  return base || DEFAULT_SITE_URL;
}

export function productPageUrl(siteUrl, productId) {
  const base = getSiteBaseUrl(siteUrl);
  const path = '/detail-produit';
  if (!productId) return base + path;
  return base + path + '?id=' + encodeURIComponent(String(productId));
}

export function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function stripText(value, maxLen) {
  let text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLen && text.length > maxLen) {
    text = text.slice(0, Math.max(0, maxLen - 1)).trim() + '…';
  }
  return text;
}

function normalizeImagePath(value) {
  if (!value || typeof value !== 'string') return '';
  let p = value.trim();
  if (!p) return '';
  p = p.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/images\//i, '');
  p = p.replace(/^images\//i, '').replace(/^\/+/, '');
  return p;
}

export function resolveProductImageUrl(product, supabaseUrl) {
  const base = String(supabaseUrl || SUPABASE_URL).replace(/\/+$/, '');
  const fields = [
    product?.image_url,
    product?.image,
    product?.image_path,
    product?.storage_path,
    product?.product_image_path
  ];
  for (const field of fields) {
    if (!field || typeof field !== 'string') continue;
    const raw = field.trim();
    if (!raw) continue;
    if (/^https?:\/\//i.test(raw)) return raw;
    const path = normalizeImagePath(raw);
    if (path) return base + '/storage/v1/object/public/images/' + path;
  }
  return getSiteBaseUrl() + '/og-default.jpg';
}

export async function fetchProductById(productId, supabaseUrl, anonKey) {
  if (!productId || !anonKey) return null;
  const base = String(supabaseUrl || SUPABASE_URL).replace(/\/+$/, '');
  const query = new URLSearchParams({
    select: '*',
    id: 'eq.' + String(productId),
    limit: '1'
  });
  const url = base + '/rest/v1/products?' + query.toString();
  const resp = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + anonKey,
      Accept: 'application/json'
    }
  });
  if (!resp.ok) return null;
  const rows = await resp.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0];
}

export function buildProductMeta(product, siteUrl) {
  const name = product?.name || product?.title || product?.product_name || 'Produit';
  const price = Number(product?.price);
  const priceSuffix = Number.isFinite(price) && price > 0
    ? ' — ' + Math.round(price).toLocaleString('fr-FR') + ' Gdes'
    : '';
  const description = stripText(product?.description, 160)
    || ('Découvrez « ' + name + ' » sur Vendza, la marketplace haïtienne.');
  const image = resolveProductImageUrl(product);
  const url = productPageUrl(siteUrl, product?.id);
  return {
    title: name + priceSuffix + ' | Vendza',
    description,
    image,
    url,
    type: 'product',
    siteName: 'Vendza'
  };
}

export function injectMetaIntoHtml(html, meta) {
  let out = String(html || '');
  out = out.replace(/<!-- vendza-meta:start -->[\s\S]*?<!-- vendza-meta:end -->\s*/gi, '');
  out = out.replace(/<title>[^<]*<\/title>/i, '<title>' + escapeHtmlAttr(meta.title) + '</title>');
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '');

  const block =
    '<!-- vendza-meta:start -->\n' +
    '  <meta name="description" content="' + escapeHtmlAttr(meta.description) + '">\n' +
    '  <link rel="canonical" href="' + escapeHtmlAttr(meta.url) + '">\n' +
    '  <meta property="og:site_name" content="' + escapeHtmlAttr(meta.siteName) + '">\n' +
    '  <meta property="og:type" content="' + escapeHtmlAttr(meta.type) + '">\n' +
    '  <meta property="og:title" content="' + escapeHtmlAttr(meta.title) + '">\n' +
    '  <meta property="og:description" content="' + escapeHtmlAttr(meta.description) + '">\n' +
    '  <meta property="og:image" content="' + escapeHtmlAttr(meta.image) + '">\n' +
    '  <meta property="og:url" content="' + escapeHtmlAttr(meta.url) + '">\n' +
    '  <meta property="og:locale" content="fr_HT">\n' +
    '  <meta name="twitter:card" content="summary_large_image">\n' +
    '  <meta name="twitter:title" content="' + escapeHtmlAttr(meta.title) + '">\n' +
    '  <meta name="twitter:description" content="' + escapeHtmlAttr(meta.description) + '">\n' +
    '  <meta name="twitter:image" content="' + escapeHtmlAttr(meta.image) + '">\n' +
    '  <!-- vendza-meta:end -->\n';

  if (out.includes('</head>')) {
    return out.replace('</head>', block + '</head>');
  }
  return out;
}

export async function injectProductMetaIntoHtml(html, productId, options) {
  if (!productId) return html;
  const siteUrl = getSiteBaseUrl(options && options.siteUrl);
  const product = await fetchProductById(
    productId,
    options && options.supabaseUrl,
    options && options.anonKey
  );
  if (!product) return html;
  return injectMetaIntoHtml(html, buildProductMeta(product, siteUrl));
}
