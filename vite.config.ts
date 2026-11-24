import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' permite publicar en cualquier subcarpeta (GitHub Pages, Vercel, dominio propio).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'REAP Asistencia',
        short_name: 'REAP',
        description: 'Control de asistencia con reconocimiento facial y geolocalización',
        lang: 'es-PE',
        start_url: './#/app',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0F2A44',
        background_color: '#0B1A2B',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Modelos de reconocimiento facial (~13 MB): se guardan en el celular la primera vez.
            urlPattern: ({ url }) => url.pathname.includes('/models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'reap-modelos-faciales', expiration: { maxEntries: 30 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.includes('basemaps.cartocdn.com') || url.hostname.includes('tile.openstreetmap.org'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'reap-mapas', expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com'),
            handler: 'CacheFirst',
            options: { cacheName: 'reap-fuentes', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 2500,
  },
});
