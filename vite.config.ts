import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const isE2BSandbox = env?.E2B_SANDBOX === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    cors: true,
    ...(isE2BSandbox
      ? {
          hmr: {
            clientPort: 443,
          },
        }
      : {}),
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    cors: true,
  },
});
