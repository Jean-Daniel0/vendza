import { generateSitemapXml, DEFAULT_SITE_URL } from '../../lib/generate-sitemap.mjs';

const ANON_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpYWtqZWFud2VraXBudnlobHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzc3NDUsImV4cCI6MjA2ODk1Mzc0NX0.HIFGP05gEXGYClb9vAVf0QIl7D6zbWRxB5o84HtwAgg';

export async function handler(event) {
  try {
    const host = event && event.headers && (event.headers.host || event.headers.Host);
    const proto = event && event.headers && (event.headers['x-forwarded-proto'] || 'https');
    const siteUrl = process.env.SITE_URL || process.env.URL || (host ? `${proto}://${host}` : DEFAULT_SITE_URL);

    const xml = await generateSitemapXml({
      siteUrl,
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || ANON_FALLBACK
    });

    const cacheControl = (event.queryStringParameters && event.queryStringParameters.refresh === '1')
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=3600, s-maxage=3600';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': cacheControl
      },
      body: xml
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Erreur génération sitemap: ' + (err && err.message ? err.message : String(err))
    };
  }
}
