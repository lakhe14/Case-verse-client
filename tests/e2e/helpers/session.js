/**
 * QA accounts come only from environment variables. Credentials and tokens are
 * never logged, written to disk, or saved as Playwright storage state.
 *
 *   E2E_CUSTOMER_EMAIL / E2E_CUSTOMER_PASSWORD            QA customer A
 *   E2E_CUSTOMER_B_EMAIL / E2E_CUSTOMER_B_PASSWORD        optional QA customer B
 *   E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD                  staff with manage_order_payments
 *   E2E_LIMITED_STAFF_EMAIL / E2E_LIMITED_STAFF_PASSWORD  staff without manage_order_payments
 */
import { expect } from '@playwright/test';

export const API_ORIGIN = process.env.E2E_API_ORIGIN || 'http://127.0.0.1:4002';
export const API = `${API_ORIGIN}/api`;

const ACCOUNTS = {
  customer: { prefix: 'E2E_CUSTOMER', type: 'customer' },
  customerB: { prefix: 'E2E_CUSTOMER_B', type: 'customer' },
  staff: { prefix: 'E2E_STAFF', type: 'staff' },
  limitedStaff: { prefix: 'E2E_LIMITED_STAFF', type: 'staff' },
};

export function credentials(kind) {
  const { prefix } = ACCOUNTS[kind];
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  return email && password ? { email, password } : null;
}

/** Skip reason when any of the accounts is missing, otherwise null. */
export function notConfigured(...kinds) {
  const missing = kinds.filter((kind) => !credentials(kind)).map((kind) => `${ACCOUNTS[kind].prefix}_EMAIL/_PASSWORD`);
  return missing.length ? `NOT CONFIGURED: set ${missing.join(', ')} for a dedicated local QA account, or run npm run test:e2e:full (isolated E2E fixtures)` : null;
}

// Per-worker cache keeps logins well inside the server's 20-per-15-minutes limiter.
const sessions = new Map();

export async function apiLogin(request, kind) {
  if (sessions.has(kind)) return sessions.get(kind);
  const creds = credentials(kind);
  if (!creds) throw new Error(notConfigured(kind));
  const path = ACCOUNTS[kind].type === 'staff' ? '/staff/login' : '/auth/login';
  const response = await request.post(`${API}${path}`, { data: creds });
  // Status only: the body carries tokens and must never be echoed.
  expect(response.status(), `${kind} QA login`).toBe(200);
  const body = await response.json();
  const session = { accessToken: body.accessToken, refreshToken: body.refreshToken, profile: body.user || body.staff };
  sessions.set(kind, session);
  return session;
}

export const bearer = (session) => ({ Authorization: `Bearer ${session.accessToken}` });

/** Seeds the SPA's token storage once per tab, before the app boots. */
export async function useSession(page, session) {
  await page.addInitScript(({ access, refresh }) => {
    if (sessionStorage.getItem('cv_e2e_seeded')) return;
    localStorage.setItem('cv_access', access);
    if (refresh) localStorage.setItem('cv_refresh', refresh);
    sessionStorage.setItem('cv_e2e_seeded', '1');
  }, { access: session.accessToken, refresh: session.refreshToken || '' });
}

async function fillLogin(page, creds) {
  await page.getByLabel('Email').fill(creds.email);
  await page.locator('input[name="password"]').fill(creds.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

export async function uiCustomerLogin(page, kind = 'customer') {
  await page.goto('/login');
  await fillLogin(page, credentials(kind));
  await expect(page.getByRole('button', { name: 'Log out' }).first()).toBeAttached();
}

export async function uiStaffLogin(page, kind = 'staff', destination = '/admin') {
  await page.goto(destination);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await fillLogin(page, credentials(kind));
}

export async function uiLogout(page) {
  const visibleLogout = page.getByRole('button', { name: 'Log out' }).filter({ visible: true });
  if (!(await visibleLogout.count())) await page.getByRole('button', { name: 'Open menu' }).click();
  await visibleLogout.first().click();
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeAttached();
  expect(await page.evaluate(() => localStorage.getItem('cv_access'))).toBeNull();
}
