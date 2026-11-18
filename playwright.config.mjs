import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  workers: 1,
  timeout: 60_000,
  outputDir: '.verify/results',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4184',
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--disable-dev-shm-usage'],
    },
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      'vite build --outDir .verify/e2e-site --emptyOutDir && vite preview --outDir .verify/e2e-site --host 0.0.0.0 --port 4184 --strictPort',
    url: 'http://127.0.0.1:4184',
    reuseExistingServer: false,
    timeout: 90_000,
    env: {
      VITE_SUPABASE_URL: 'https://studio-fixture.invalid',
      VITE_SUPABASE_ANON_KEY: 'test-public-key',
    },
  },
});
