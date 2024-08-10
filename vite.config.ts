import path from "path"
import alias from '@rollup/plugin-alias';
import Inspect from 'vite-plugin-inspect'
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';

// https://vitejs.dev/config/
export default defineConfig({
  // define: {
  //   "global": {},
  // },
  optimizeDeps: {
      esbuildOptions: {
          // Node.js global to browser globalThis
          define: {
              global: 'globalThis'
          },
          // Enable esbuild polyfill plugins
          plugins: [
              NodeGlobalsPolyfillPlugin({
                  buffer: true
              })
          ]
      }
  },
  plugins: [
    react(),
    Inspect(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: 'cardano-lightning-demo',
        short_name: 'cld',
        description: 'Cardano\'s hottest L2',
        theme_color: '#ffffff',
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
        navigateFallback: 'index.html',
        suppressWarnings: true,
        type: 'module',
      },
    }
    )],
  resolve: {
    alias: [
      { find: /@emurgo\/cardano-message-signing-nodejs/,
        replacement: '@emurgo/cardano-message-signing-asmjs'
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ]
  }
})
