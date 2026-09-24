/**
 * A coupon that was valid at preview but lost its last use before the
 * customer submits: the real server refuses the placement inside its
 * transaction, and checkout recovers without losing anything. Runs against the
 * isolated E2E API with the fixture coupon E2EBROWSERONCE (one use in total).
 * A single cover takes a coupon even while the Dashain window is open (only a
 * priced bundle blocks coupons), so nothing here is mocked.
 */
import { expect, test } from '@playwright/test';
import { essentialFailures, expectNoLeakedInternals } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';
import { chooseDestination, destinationInput } from '../helpers/destination.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const CODE = 'E2EBROWSERONCE';
const SLUG = 'pink-floral';

async function variantId(request) {
  const { data } = await (await request.get(`${API}/products/${SLUG}`)).json();
  return data.variants.find((v) => v.attributes.some((a) => a.value === 'iPhone 17 Pro')).id;
}

async function fillCart(request, session, id) {
  await request.delete(`${API}/cart`, { headers: bearer(session) });
  expect((await request.post(`${API}/cart/items`, { headers: bearer(session), data: { variant_id: id, quantity: 1 } })).status()).toBe(201);
}

const orderCount = async (request, session) => (await (await request.get(`${API}/orders`, { headers: bearer(session) })).json()).pagination.total;

test('a coupon that runs out between preview and placement is dropped cleanly and checkout continues', async ({ page, request }) => {
  const failures = essentialFailures(page, { allow: [{ url: /\/api\/orders$/, status: 400 }] });
  const id = await variantId(request);
  const customerA = await apiLogin(request, 'customer');
  const customerB = await apiLogin(request, 'customerB');
  await fillCart(request, customerA, id);
  const ordersBefore = await orderCount(request, customerA);

  await useSession(page, customerA);
  await page.goto('/checkout');
  await chooseDestination(page, 'Inside Valley', 'Inside Valley, Kathmandu');
  const total = page.locator('.checkout-summary .summary-total');
  await expect(total).toContainText('799');

  // 1. The coupon is valid at preview.
  await page.getByPlaceholder('Coupon code').fill(CODE.toLowerCase());
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(`“${CODE}” applied`)).toBeVisible();
  await expect(total).toContainText('749');

  // 2. Another customer takes its only use.
  await fillCart(request, customerB, id);
  const addressesB = await (await request.get(`${API}/addresses`, { headers: bearer(customerB) })).json();
  const taken = await request.post(`${API}/orders`, { headers: bearer(customerB), data: { shipping_address_id: addressesB.data[0].id, parcelmoover_destination_id: 'e2e-kathmandu', coupon_code: CODE } });
  expect(taken.status()).toBe(201);

  // 3. Customer A submits: refused, nothing placed, coupon dropped, total re-priced.
  await page.getByRole('button', { name: 'Place order & continue to payment' }).click();
  await expect(page.getByTestId('coupon-rejected')).toContainText(`“${CODE}” was not applied: Sorry, this coupon has reached its usage limit.`);
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText(`“${CODE}” applied`)).toHaveCount(0);
  await expect(total).toContainText('799');
  await expect(page.locator('.checkout-summary')).not.toContainText('Coupon');
  await expect(destinationInput(page)).toHaveAttribute('data-value', 'e2e-kathmandu');
  await expect(page.locator('input[name="ship"]:checked')).toHaveCount(1);
  expect(await orderCount(request, customerA)).toBe(ordersBefore);
  const cart = await (await request.get(`${API}/cart`, { headers: bearer(customerA) })).json();
  expect(cart.data.items).toHaveLength(1);
  await expectNoLeakedInternals(page, expect);

  // 4. The customer continues without the coupon: one order at the full price.
  await page.getByRole('button', { name: 'Place order & continue to payment' }).click();
  await expect(page).toHaveURL(/\/account\/orders\/\d+$/);
  const orderId = Number(page.url().split('/').pop());
  const persisted = (await (await request.get(`${API}/orders/${orderId}`, { headers: bearer(customerA) })).json()).data;
  expect(persisted).toMatchObject({ coupon_id: null, discount_amount: '0.00', total_amount: '799.00' });
  expect(await orderCount(request, customerA)).toBe(ordersBefore + 1);

  // Release both holds and the coupon use.
  expect((await request.post(`${API}/orders/${orderId}/cancel`, { headers: bearer(customerA) })).status()).toBe(200);
  expect((await request.post(`${API}/orders/${(await taken.json()).data.id}/cancel`, { headers: bearer(customerB) })).status()).toBe(200);
  expect(failures).toEqual([]);
});
