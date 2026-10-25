import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  const isProd = process.env.NODE_ENV === 'production';
  // Les icônes PWA viennent des fichiers du dépôt (dossier public/), plus de Supabase Storage.

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        filename: 'OneSignalSDKWorker.js',
        registerType: 'prompt', // la nouvelle version attend le clic du client : aucun rechargement automatique
        injectRegister: isProd ? 'inline' : null,
        devOptions: {
          enabled: false,
        },
        workbox: {
          importScripts: ['/sw-pre.js', 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'],
          skipWaiting: false,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api/,
            /supabase\.co/,
            /supabase/,
            // pages SEO rendues par le serveur (jamais remplacées par le shell de l'application)
            /^\/(produit|boutique|categorie|media)\//,
            /^\/(marketplace-haiti|acheter-en-ligne-haiti|vendre-en-ligne-haiti|comment-ca-marche|paiement-moncash-carte-haiti|a-propos|faq|achte-sou-entenet-ayiti|devenir-vendeur|forfaits-vendeurs|creer-un-compte|se-connecter|en-savoir-plus|contact|ventes-flash|apropos|about|contactez-nous|connexion|login|inscription|register|signup|vendeur|become-seller|flash-sales|ventes-flashs|aide|help|marketplace|marche)$/,
            /^\/(sitemap\.xml|robots\.txt|llms\.txt|llms-full\.txt|catalogue\.json|[0-9a-f]{32}\.txt)$/
          ],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api') || url.hostname.includes('supabase'),
              handler: 'NetworkOnly'
            },
            {
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'documents-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 86400 * 7 // 1 week
                }
              }
            },
            {
              urlPattern: ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 86400 * 30 // 30 days
                }
              }
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 86400 * 30 // 30 days
                }
              }
            }
          ]
        },
        manifest: {
          name: 'Vendza',
          short_name: 'Vendza',
          description: 'Achetez et vendez en toute sécurité en Haïti',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''),
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
