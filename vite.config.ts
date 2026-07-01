import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  console.log('[DEBUG BUILD] VITE_SUPABASE_URL présente ?', !!process.env.VITE_SUPABASE_URL);
  console.log('[DEBUG BUILD] Longueur de la valeur :', (process.env.VITE_SUPABASE_URL || '').length);
  console.log('[DEBUG BUILD] Liste de TOUTES les variables contenant VITE ou SUPABASE :', Object.keys(process.env).filter(k => k.includes('VITE') || k.includes('SUPABASE')));

  const isProd = process.env.NODE_ENV === 'production';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://giakjeanwekipnvyhlxm.supabase.co';
  const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, '');
  const pwaIcon192 = supabaseUrl ? `${cleanSupabaseUrl}/storage/v1/object/public/images_systeme/pwa-icon-192.png` : '/pwa-icon-192.png';
  const pwaIcon512 = supabaseUrl ? `${cleanSupabaseUrl}/storage/v1/object/public/images_systeme/pwa-icon-512.png` : '/pwa-icon-512.png';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: isProd ? 'inline' : null,
        devOptions: {
          enabled: false,
        },
        workbox: {
          importScripts: ['/sw-pre.js', 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'],
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api/,
            /supabase\.co/,
            /supabase/
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
              src: pwaIcon192,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: pwaIcon512,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
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
