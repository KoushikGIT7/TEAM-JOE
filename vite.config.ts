import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5174,
        host: '0.0.0.0',
        hmr: {
          host: 'localhost',
          port: 5174,
          protocol: 'ws',
        },
        strictPort: true,
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: ['JeoLogoFinal.png'],
          manifest: {
            name: 'CSE Cafeteria',
            short_name: 'CSE Cafe',
            description: 'Fast meals. Zero chaos.',
            theme_color: '#9333EA',
            background_color: '#0A0A0A',
            display: 'standalone',
            icons: [
              {
                src: '/JeoLogoFinal.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: '/JeoLogoFinal.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.ONESIGNAL_REST_API_KEY': JSON.stringify(env.ONESIGNAL_REST_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
