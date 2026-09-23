import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Transactional flows need the isolated E2E database: npm run test:e2e:full.
  testIgnore: ['**/full/**'],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  // One worker: QA fixtures share one local API, its login rate limiter and the
  // QA customer cart, so suites must not interleave.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
