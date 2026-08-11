import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import os from 'os'

function getLocalLANIP() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}

function ceovaDevServerBannerPlugin() {
  return {
    name: 'ceova-dev-server-banner',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer.address()
        const port = typeof address === 'object' && address ? address.port : (process.env.PORT || 12827)
        const lanIP = getLocalLANIP()

        setTimeout(() => {
          console.log('\n\x1b[36m%s\x1b[0m', 'CEOVA Development Server')
          console.log('\n  \x1b[1mLocal:\x1b[0m   http://localhost:' + port)
          console.log('  \x1b[1mNetwork:\x1b[0m http://' + lanIP + ':' + port + '\n')
        }, 150)
      })
    }
  }
}

const DEV_PORT = parseInt(process.env.PORT || '12827', 10)
const DEV_HOST = process.env.HOST || '0.0.0.0'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ceovaDevServerBannerPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'CEOVA - AI Executive Assistant',
        short_name: 'CEOVA',
        description: 'Your AI Executive Assistant',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: '/ceova logo dark.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/ceova logo dark.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'TAURI_'],
  clearScreen: false,
  server: {
    port: DEV_PORT,
    strictPort: true,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/lucide')) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
        }
      }
    }
  }
})
