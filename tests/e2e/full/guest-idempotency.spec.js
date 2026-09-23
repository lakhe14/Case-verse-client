/**
 * Guest order idempotency in the real browser against the isolated E2E API.
 * Guest order URLs carry tokens: no traces, screenshots or video here.
 */
import { expect, test } from '@playwright/test';
import { addToCartFromPdp } from '../helpers/catalog.js';
import { essentialFailures } from '../helpers/monitor.js';
import { API, apiLogin, bearer } from '../helpers/session.js';
import { REPRESENTATIVE } from '../helpers/viewport.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const RUN_ID = process.env.E2E_RUN_ID;

async function fillGuest(page, name) {
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Phone number').fill('9800000013');
  await page.getByLabel('ParcelMoover delivery destination').selectOption('e2e-kathmandu');
  await page.getByLabel('Province').fill('Bagmati');
  await page.getByLabel('District').fill('Kathmandu');
  await page.getByLabel('Municipality / City').fill('Kathmandu');
  await page.getByLabel('Area / Street').fill('E2E lane');
  await page.getByLabel('Delivery notes (optional)').fill(`${RUN_ID} ${name}`);
  await expect(page.locator('.checkout-summary .summary-total')).toBeVisible();
}

/** Server-side truth: how many orders exist for this guest name (staff API, read-only). */
async function ordersNamed(request, name) {
  const staff = await apiLogin(request, 'staff');
  const list = await (await request.get(`${API}/admin/orders?limit=50`, { headers: bearer(staff) })).json();
  return list.data.filter((order) => order.guest_name === name);
}

function watchPlacements(page) {
  const keys = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url() === `${API}/guest-checkout/orders`) keys.push(r.headers()['idempotency-key']);
  });
  return keys;
}

test('a lost response is retried with the same key and yields exactly one order', async ({ page, request }) => {
  const name = `E2E lost-response ${RUN_ID}`;
  const failures = essentialFailures(page, { allow: [{ url: /\/api\/guest-checkout\/orders$/, network: true }] });
  await page.setViewportSize(REPRESENTATIVE.desktop);
  await addToCartFromPdp(page, 'bow-cherry-iconic');
  await page.goto('/checkout');
  await fillGuest(page, name);

  const keys = watchPlacements(page);
  let first = true;
  await page.route('**/api/guest-checkout/orders', async (route) => {
    if (!first) return route.continue();
    first = false;
    // Let the server create the order, then drop the response before the browser sees it.
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    return route.abort('failed');
  });

  await page.locator('.checkout-summary button[type="submit"]').click();
  await expect(page).toHaveURL(/\/order\/guest\//);
  await expect(page.getByRole('heading', { name: 'Confirm your order' })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{36,128}$/);
  expect(keys[1]).toBe(keys[0]);
  const orders = await ordersNamed(request, name);
  expect(orders).toHaveLength(1);
  await expect(page.getByRole('heading', { name: orders[0].order_number })).toBeVisible();
  expect(failures).toEqual([]);
});

test('double click plus Enter submits one key and creates one order', async ({ page, request }) => {
  const name = `E2E double-submit ${RUN_ID}`;
  const failures = essentialFailures(page);
  await page.setViewportSize(REPRESENTATIVE.mobile);
  await addToCartFromPdp(page, 'chetah-iconic');
  await page.goto('/checkout');
  await fillGuest(page, name);

  const keys = watchPlacements(page);
  await page.route('**/api/guest-checkout/orders', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return route.continue();
  });
  const submit = page.locator('.checkout-summary button[type="submit"]');
  await submit.dblclick();
  await page.getByLabel('Full name').press('Enter');
  await expect(page).toHaveURL(/\/order\/guest\//);
  expect(new Set(keys).size).toBe(1);
  expect(await ordersNamed(request, name)).toHaveLength(1);
  expect(failures).toEqual([]);
});
