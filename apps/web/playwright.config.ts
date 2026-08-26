import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: '../../.cache/playwright',
  snapshotPathTemplate: '{testDir}/snapshots/{projectName}/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'light',
    locale: 'en-US',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 } } },
    { name: 'laptop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // P2H-12: a Supabase project has to be configured for the sign-in screen to exist at all.
    // The values are fictional and every call to them is intercepted by the tests.
    env: {
      VITE_SUPABASE_URL: 'https://project.supabase.test',
      VITE_SUPABASE_ANON_KEY: 'anon-key-for-tests',
    },
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
