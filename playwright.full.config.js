/**
 * Full isolated E2E run (npm run test:e2e:full).
 *
 * Starts its own API on 4010 against the guarded caseverse_e2e database (the
 * server's e2e:server:fresh script runs fixture setup first) and its own Vite
 * on 5174 pointed at that API. It never reuses the dev app (5173) or dev API
 * (4002); any browser request to them fails the test. Global teardown runs
 * the server's scoped cleanup + verification even when tests fail.
 */
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(process.env.E2E_SERVER_DIR || path.join(here, '..', 'server'));
const require = createRequire(import.meta.url);
const { ACCOUNTS, passwordFor } = require(path.join(serverDir, 'scripts', 'e2e', 'fixtureData.js'));

const API_PORT = 4010;
const APP_PORT = 5174;
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
const BASE_URL = `http://127.0.0.1:${APP_PORT}`;

// Shared with workers, global setup/teardown and the E2E server process.
Object.assign(process.env, {
  E2E_FULL: '1',
  E2E_SERVER_DIR: serverDir,
  E2E_API_ORIGIN: API_ORIGIN,
  E2E_BASE_URL: BASE_URL,
});
if (!process.env.E2E_RUN_ID) {
  process.env.E2E_RUN_ID = `E2E-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
}
// Fixture accounts exist only in the *_e2e database (see server/scripts/e2e/fixtureData.js).
for (const [kind, prefix] of [['customerA', 'E2E_CUSTOMER'], ['customerB', 'E2E_CUSTOMER_B'], ['staff', 'E2E_STAFF'], ['limitedStaff', 'E2E_LIMITED_STAFF']]) {
  process.env[`${prefix}_EMAIL`] = ACCOUNTS[kind].email;
  process.env[`${prefix}_PASSWORD`] = passwordFor(kind);
}

export default defineConfig({
  ...base,
  testIgnore: [],
  timeout: 45_000,
  globalSetup: './tests/e2e/full/global-setup.js',
  globalTeardown: './tests/e2e/full/global-teardown.js',
  use: { ...base.use, baseURL: BASE_URL },
  webServer: [
    {
      command: 'npm run e2e:server:fresh',
      cwd: serverDir,
      url: `${API_ORIGIN}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      // Process env wins over client/.env, so the dev API URL is never used here.
      env: { VITE_API_URL: API_ORIGIN },
    },
  ],
});
