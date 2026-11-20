import {defineConfig} from '@playwright/test';

// Without TRUCO_TEST_URL, tests run against an isolated local server that uses the file store
// (never the Supabase project in .env.local), so fixtures can write rooms directly.
const local = !process.env.TRUCO_TEST_URL;
if (local) process.env.TRUCO_TEST_URL = 'http://localhost:3002';
export default defineConfig({
  testDir: './tests', timeout: 240000, workers: 1, use: {headless: true},
  webServer: local ? {
    // Production build: `next dev` compiles on first visit and was flaky for timing-sensitive tests.
    command: 'npm run build && npm run start -- --port 3002', url: 'http://localhost:3002', reuseExistingServer: false, timeout: 600000,
    env: {SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', TRUCO_BUILD_DIR: '.next-e2e', ALLOW_LOCAL_STORE: '1'},
  } : undefined,
});
