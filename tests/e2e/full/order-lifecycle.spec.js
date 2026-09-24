/**
 * Stale unpaid orders and catalog deletes, through the real UI against the
 * isolated E2E API. Time is moved with the server's guarded E2E helper
 * (scripts/e2e/expireOrder.js), never by waiting. Tokens stay in memory.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { essentialFailures, expectNoLeakedInternals } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const RUN_ID = process.env.E2E_RUN_ID;
const SLUG = 'bow-cherry-iconic';
const TIMEOUT_MESSAGE = 'This order was cancelled because payment was not confirmed in time.';

async function productOf(request) {
  const { data } = await (await request.get(`${API}/products/${SLUG}`)).json();
  return data;
}

/** Lapses the order's hold and runs the payment-timeout cancellation (E2E database only). */
function expireOrder(orderId) {
  const result = spawnSync(process.execPath, [path.join(process.env.E2E_SERVER_DIR, 'scripts', 'e2e', 'expireOrder.js'), `--order-id=${orderId}`], {
    cwd: process.env.E2E_SERVER_DIR,
    env: { ...process.env, NODE_ENV: 'e2e', E2E_ALLOW_DB_MUTATION: 'true' },
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain(`order ${orderId} | cancelled`);
}

async function guestOrder(request, variantId, label) {
  const response = await request.post(`${API}/guest-checkout/orders`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      items: [{ variant_id: variantId, quantity: 1 }],
      guest: { name: `E2E ${label}`, phone: '9800000016', province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu', area: 'E2E lane', notes: `${RUN_ID} ${label}`, parcelmoover_destination_id: 'e2e-kathmandu' },
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return { order: body.data, token: body.guest_token };
}

async function customerOrder(request, variantId) {
  const session = await apiLogin(request, 'customer');
  await request.delete(`${API}/cart`, { headers: bearer(session) });
  expect((await request.post(`${API}/cart/items`, { headers: bearer(session), data: { variant_id: variantId, quantity: 1 } })).status()).toBe(201);
  const addresses = await (await request.get(`${API}/addresses`, { headers: bearer(session) })).json();
  const placed = await request.post(`${API}/orders`, { headers: bearer(session), data: { shipping_address_id: addresses.data[0].id, parcelmoover_destination_id: 'e2e-kathmandu' } });
  expect(placed.status()).toBe(201);
  return { order: (await placed.json()).data, session };
}

test('a stale unpaid order is cancelled for payment timeout and every audience sees why, without stock moving', async ({ page, request, browser }) => {
  const failures = essentialFailures(page);
  const product = await productOf(request);
  const variant = product.variants[0];
  const manager = await apiLogin(request, 'limitedStaff');
  const physical = async () => (await (await request.get(`${API}/admin/products/${product.id}`, { headers: bearer(manager) })).json()).data.variants.find((v) => v.id === variant.id);
  const before = await physical();

  // Guest order: hold placed, then the payment window lapses.
  const guest = await guestOrder(request, variant.id, 'timeout-guest');
  expect((await physical()).available_quantity).toBe(before.available_quantity - 1);
  expireOrder(guest.order.id);
  expect(await physical()).toMatchObject({ stock_quantity: before.stock_quantity, reserved_quantity: before.reserved_quantity, available_quantity: before.available_quantity });

  await page.goto(`/order/guest/${guest.token}`);
  await expect(page.getByTestId('order-cancelled')).toContainText(TIMEOUT_MESSAGE);
  await expect(page.getByText('Payment confirmation closed')).toBeVisible();
  await expectNoLeakedInternals(page, expect);
  await expect(page.locator('body')).not.toContainText(/reservation|expires_at|payment_timeout/i);

  // Signed-in customer order: same message on the account order page.
  const { order, session } = await customerOrder(request, variant.id);
  expireOrder(order.id);
  const customerContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  const customerPage = await customerContext.newPage();
  await useSession(customerPage, session);
  await customerPage.goto(`/account/orders/${order.id}`);
  await expect(customerPage.getByTestId('order-cancelled')).toContainText(TIMEOUT_MESSAGE);
  await customerContext.close();

  // Staff see a system cancellation, distinct from a customer's own.
  const staffContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  const staffPage = await staffContext.newPage();
  await useSession(staffPage, await apiLogin(request, 'staff'));
  await staffPage.goto(`/admin/orders/${guest.order.id}`);
  await expect(staffPage.getByTestId('cancellation-reason')).toHaveText('Cancelled automatically: payment was not confirmed before the reserved stock expired.');

  const selfCancelled = await guestOrder(request, variant.id, 'timeout-self-cancel');
  expect((await request.post(`${API}/guest-checkout/orders/${selfCancelled.token}/cancel`)).status()).toBe(200);
  await staffPage.goto(`/admin/orders/${selfCancelled.order.id}`);
  await expect(staffPage.getByTestId('cancellation-reason')).toHaveText('Cancelled by the guest customer.');
  await staffContext.close();

  expect(await physical()).toMatchObject({ stock_quantity: before.stock_quantity, reserved_quantity: before.reserved_quantity });
  expect(failures).toEqual([]);
});

test('deleting a product or variant with order history explains how to deactivate it instead', async ({ page, request }) => {
  const failures = essentialFailures(page, { allow: [{ url: /\/api\/admin\/products\/\d+(\/variants\/\d+)?$/, status: 409 }] });
  const product = await productOf(request);
  const variant = product.variants[0];
  // Guarantee order history for this product (a cancelled order still counts).
  const history = await guestOrder(request, variant.id, 'delete-history');
  expect((await request.post(`${API}/guest-checkout/orders/${history.token}/cancel`)).status()).toBe(200);

  await useSession(page, await apiLogin(request, 'limitedStaff'));
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/admin/products');
  await page.getByPlaceholder('Search products…').fill(product.name);
  await page.getByPlaceholder('Search products…').press('Enter');
  const row = page.getByRole('row', { name: new RegExp(product.name) });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('delete-conflict')).toHaveText('This product has order history and cannot be deleted. Deactivate it instead: open it and set Status to inactive.');
  await expect(row).toBeVisible();
  await expectNoLeakedInternals(page, expect);
  await expect(page.locator('body')).not.toContainText(/Something went wrong|FOREIGN KEY|constraint|order_items/i);

  await page.goto(`/admin/products/${product.id}`);
  const variantRow = page.getByTestId(`variant-row-${variant.id}`);
  await variantRow.getByRole('button', { name: 'Delete' }).click();
  await expect(variantRow.getByTestId('delete-conflict')).toHaveText('This variant has order history and cannot be deleted. Deactivate it instead: untick Active and save.');
  await expect(page.locator('body')).not.toContainText(/Something went wrong|FOREIGN KEY|constraint|order_items/i);

  const still = await (await request.get(`${API}/products/${SLUG}`)).json();
  expect(still.data.variants.some((v) => v.id === variant.id)).toBe(true);
  expect(failures).toEqual([]);
});
