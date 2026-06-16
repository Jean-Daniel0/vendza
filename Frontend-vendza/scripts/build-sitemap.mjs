/**
 * Génère sitemap.xml statique (tous les produits publiés).
 * Usage : node scripts/build-sitemap.mjs
 * Variables : SITE_URL, SUPABASE_ANON_KEY
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSitemapXml, DEFAULT_SITE_URL } from '../lib/generate-sitemap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'sitemap.xml');

const siteUrl = process.env.SITE_URL || DEFAULT_SITE_URL;
let anonKey = process.env.SUPABASE_ANON_KEY || '';
if (!anonKey) {
  try {
    const cfg = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
    const m = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
    if (m) anonKey = m[1];
  } catch (_) {}
}

const xml = await generateSitemapXml({ siteUrl, anonKey });
fs.writeFileSync(out, xml, 'utf8');
console.log('Sitemap écrit :', out);
