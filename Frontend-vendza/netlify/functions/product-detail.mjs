import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { injectProductMetaIntoHtml } from '../../lib/product-meta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANON_FALLBACK = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpYWtqZWFud2VraXBudnlobHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzc3NDUsImV4cCI6MjA2ODk1Mzc0NX0.HIFGP05gEXGYClb9vAVf0QIl7D6zbWRxB5o84HtwAgg';

export async function handler(event) {
  try {
    const host = event && event.headers && (event.headers.host || event.headers.Host);
    const proto = event && event.headers && (event.headers['x-forwarded-proto'] || 'https');
    const siteUrl = process.env.SITE_URL || process.env.URL || (host ? proto + '://' + host : 'https://vendza.ht');
    const productId = event.queryStringParameters && event.queryStringParameters.id;

    const htmlPath = path.join(__dirname, '..', '..', 'detail-produit.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    if (productId && ANON_FALLBACK) {
      html = await injectProductMetaIntoHtml(html, productId, {
        siteUrl,
        anonKey: ANON_FALLBACK
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': productId ? 'public, max-age=300' : 'public, max-age=3600'
      },
      body: html
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Erreur page produit: ' + (err && err.message ? err.message : String(err))
    };
  }
}
