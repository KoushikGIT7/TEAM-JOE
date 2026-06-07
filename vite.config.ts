import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.REACT_APP_NOVU_APPLICATION_IDENTIFIER': JSON.stringify(env.REACT_APP_NOVU_APPLICATION_IDENTIFIER),
        'process.env.NOVU_BACKEND_URL': JSON.stringify(env.NOVU_BACKEND_URL),
        'process.env.NOVU_SOCKET_URL': JSON.stringify(env.NOVU_SOCKET_URL),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
