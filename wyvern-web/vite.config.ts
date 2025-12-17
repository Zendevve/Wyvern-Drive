import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',  // Changed from 'autoUpdate' - don't reload page without user consent
      includeAssets: ['wyvern.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Wyvern Drive',
        short_name: 'Wyvern',
        description: 'Discord Cloud Storage with End-to-End Encryption',
        theme_color: '#5e6ad2',
        background_color: '#0d0d14',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // Cache API responses (but NOT share/stream downloads)
            urlPattern: ({ url }) => {
              // Match supabase functions except share and stream endpoints
              if (!url.hostname.includes('supabase.co')) return false
              if (!url.pathname.includes('/functions/')) return false
              // Exclude share downloads and streaming - they need CORS passthrough
              if (url.pathname.includes('/share/')) return false
              if (url.pathname.includes('/stream/')) return false
              return true
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            // Cache static assets
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        // Pre-cache app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  }
})
