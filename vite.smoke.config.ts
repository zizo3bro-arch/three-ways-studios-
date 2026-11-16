import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    ssr: 'scripts/smoke.tsx',
    outDir: '.smoke',
    emptyOutDir: true,
    minify: false,
    rollupOptions: { output: { format: 'es', entryFileNames: 'smoke.mjs' } },
  },
});
