/**
 * Reserve on order, deduct on payment confirmation, seen through the real UI
 * against the isolated E2E API. Guest tokens stay in memory; no traces here.
 */
import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { essentialFailures } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const RUN_ID = process.env.E2E_RUN_ID;
const SLUG = 'flame-silver';

async function publicVariant(request) {
  const { data } = await (await request.get(`${API}/products/${SLUG}`)).json();
  return { productId: data.id, variant: data.variants[0] };
}

async function adminVariant(request, productId) {
  const manager = await apiLogin(request, 'limitedStaff'); // Product Manager: manage_products
  const { data } = await (await request.get(`${API}/admin/products/${productId}`, { headers: bearer(manager) })).json();
  return data.variants[0];
}

async function guestOrder(request, variantId, quantity, label) {
  const response = await request.post(`${API}/guest-checkout/orders`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      items: [{ variant_id: variantId, quantity }],
      guest: { name: `E2E ${label}`, phone: '9800000014', province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu', area: 'E2E lane', notes: `${RUN_ID} ${label}`, parcelmoover_destination_id: 'e2e-kathmandu' },
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return { order: body.data, token: body.guest_token };
}

async function expectPdpLeft(page, left) {
  await page.goto(`/p/${SLUG}`);
  await expect(page.getByText(`Only ${left} left`)).toBeVisible();
}

test('unpaid orders hold availability, confirmation deducts physical stock, cancellation returns availability', async ({ page, request, browser }) => {
  const failures = essentialFailures(page);
  const { productId, variant } = await publicVariant(request);
  const physical = (await adminVariant(request, productId)).stock_quantity;
  expect(variant.stock_quantity).toBeGreaterThan(4);
  const holdQty = variant.stock_quantity - 3;

  // 1. Unpaid order: storefront availability drops, physical stock does not.
  const first = await guestOrder(request, variant.id, holdQty, 'inventory-hold');
  await expectPdpLeft(page, 3);
  expect(await adminVariant(request, productId)).toMatchObject({ stock_quantity: physical, available_quantity: 3 });

  // 2. A second unpaid order holds one more.
  const second = await guestOrder(request, variant.id, 1, 'inventory-cancel');
  await expectPdpLeft(page, 2);

  // 3. COD request is not a confirmation: physical still unchanged.
  expect((await request.post(`${API}/guest-checkout/orders/${first.token}/payment-method/cod`)).status()).toBe(200);
  expect((await adminVariant(request, productId)).stock_quantity).toBe(physical);

  // 4. Staff confirm COD in the admin queue: physical is deducted once; availability unchanged.
  const staff = await apiLogin(request, 'staff');
  const adminContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  const admin = await adminContext.newPage();
  await useSession(admin, staff);
  await admin.goto('/admin/payment-confirmations');
  const row = admin.getByRole('row', { name: new RegExp(first.order.order_number) });
  await row.getByRole('button', { name: 'Confirm COD' }).click();
  await expect(row).toHaveCount(0);
  await adminContext.close();
  expect(await adminVariant(request, productId)).toMatchObject({ stock_quantity: physical - holdQty, reserved_quantity: 1, available_quantity: 2 });
  await expectPdpLeft(page, 2);

  // 5. Cancelling the unpaid order releases its hold: availability returns, physical unchanged.
  expect((await request.post(`${API}/guest-checkout/orders/${second.token}/cancel`)).status()).toBe(200);
  await expectPdpLeft(page, 3);
  expect(await adminVariant(request, productId)).toMatchObject({ stock_quantity: physical - holdQty, reserved_quantity: 0, available_quantity: 3 });

  // 6. The admin product screen shows the same numbers.
  const managerContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  const manager = await managerContext.newPage();
  await useSession(manager, await apiLogin(request, 'limitedStaff'));
  await manager.goto(`/admin/products/${productId}`);
  await expect(manager.getByTestId('variant-inventory').first()).toHaveText(`Physical ${physical - holdQty}, reserved by unpaid orders 0, available 3`);
  await managerContext.close();
  expect(failures).toEqual([]);
});
