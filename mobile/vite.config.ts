import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'AirType',
        short_name: 'AirType',
        description:
          'Jadikan Smartphone Keyboard Nirkabel untuk Desktop',
        // Must match the app's light-first shell in index.html/index.css so the
        // install splash and browser chrome do not flash a dark navy frame.
        theme_color: '#eef3f9',
        background_color: '#eef3f9',
        display: 'standalone',
        start_url: '/connect',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
