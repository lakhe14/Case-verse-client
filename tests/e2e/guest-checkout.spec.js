import { expect, test } from '@playwright/test';
import { addToCartFromPdp } from './helpers/catalog.js';
import { essentialFailures, expectNoLeakedInternals } from './helpers/monitor.js';
import { API } from './helpers/session.js';
import { REPRESENTATIVE, expectNoHorizontalOverflow } from './helpers/viewport.js';
import { SYNTHETIC_GUEST_TOKEN, delay, json, syntheticOrder } from './helpers/mocks.js';
import { chooseDestination } from './helpers/destination.js';

async function fillGuestDetails(page) {
  await page.getByLabel('Full name').fill('QA Guest');
  await page.getByLabel('Phone number').fill('9800000000');
  await page.getByLabel('Province').fill('Bagmati');
  await page.getByLabel('District').fill('Kathmandu');
  await page.getByLabel('Municipality / City').fill('Kathmandu');
  await page.getByLabel('Area / Street').fill('QA test street');
  await page.getByLabel('Landmark (optional)').fill('QA landmark');
  await page.getByLabel('Delivery notes (optional)').fill('Synthetic Playwright order, do not ship');
}

test.describe('guest checkout', () => {
  for (const [label, viewport] of Object.entries(REPRESENTATIVE)) {
    test(`signed-out shopper reaches a live-priced guest checkout (${label})`, async ({ page }) => {
      const failures = essentialFailures(page);
      await page.setViewportSize(viewport);
      await addToCartFromPdp(page, 'pink-love-bow', 'iPhone 14 Pro Max');

      await page.goto('/cart');
      await expect(page.getByRole('heading', { name: 'Cart', exact: true })).toBeVisible();
      await expect(page.locator('.cart-line')).toHaveCount(1);
      await expect(page.locator('.cart-line')).toContainText('SKU CV-PINK-LOVE-BOW-');
      await page.locator('.cart-summary').getByRole('button', { name: 'Checkout' }).click();

      await expect(page).toHaveURL(/\/checkout$/);
      await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Delivery address' })).toBeVisible();
      await fillGuestDetails(page);

      // Live ParcelMoover destinations from the real API; the rate is quoted server-side.
      await chooseDestination(page, 'Pokhara', /^Pokhara, Kaski/);

      const summary = page.locator('.checkout-summary');
      await expect(summary.locator('.summary-total')).toBeVisible({ timeout: 15_000 });
      await expect(summary).toContainText('Pink love bow');
      await expect(summary).toContainText('Shipping');
      await expect(summary.locator('.checkout-price-lines')).not.toBeEmpty();
      await expect(page.locator('.checkout-payment-note')).toContainText(/100\.00 eSewa advance/);
      await expect(page.getByRole('button', { name: 'Place order & continue to payment' })).toBeEnabled();
      await expectNoHorizontalOverflow(page);
      expect(failures).toEqual([]);
      // Stops before submission: this suite also runs against the dev API.
      // Real guest orders run only in the isolated E2E environment
      // (full/transactions.spec.js); the mocked test below covers the UI lock.
    });
  }

  test('guest order submission is sent once and lands on the tokenised order page', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await addToCartFromPdp(page, 'flame-silver');
    await page.goto('/checkout');
    await fillGuestDetails(page);
    await chooseDestination(page, 'Pokhara', /^Pokhara, Kaski/);
    await expect(page.locator('.checkout-summary .summary-total')).toBeVisible({ timeout: 15_000 });

    // Order creation is intercepted: the request never reaches the server.
    let placeRequests = 0;
    let sentGuest = null;
    let sentKey = null;
    await page.route('**/api/guest-checkout/orders', async (route) => {
      placeRequests += 1;
      sentGuest = route.request().postDataJSON().guest;
      sentKey = route.request().headers()['idempotency-key'];
      await delay(800);
      await json(route, { data: { id: 990001, order_number: 'QA-E2E-0001' }, guest_token: SYNTHETIC_GUEST_TOKEN }, 201);
    });
    await page.route(`**/api/guest-checkout/orders/${SYNTHETIC_GUEST_TOKEN}`, (route) => json(route, { data: syntheticOrder({ guest: true }) }));

    const submit = page.locator('.checkout-summary button[type="submit"]');
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText('Placing order');
    // A second attempt (Enter in a field) must not submit again.
    await page.getByLabel('Full name').press('Enter');
    await expect(page).toHaveURL(/\/order\/guest\//);
    expect(placeRequests).toBe(1);
    expect(sentGuest).toMatchObject({ name: 'QA Guest', phone: '9800000000', province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu', area: 'QA test street', landmark: 'QA landmark' });
    expect(sentGuest.parcelmoover_destination_id).toBeTruthy();
    expect(sentKey).toMatch(/^[A-Za-z0-9_-]{36,128}$/);

    await expect(page.getByRole('heading', { name: 'QA-E2E-0001' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Confirm your order' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('caseverse_guest_cart'))).toBe('[]');
    expect(failures).toEqual([]);
  });
});

test.describe('guest token isolation', () => {
  test('random and malformed guest tokens reveal nothing', async ({ page, request }) => {
    const failures = essentialFailures(page, { allow: [{ url: /\/api\/guest-checkout\/orders\//, status: [404, 422] }] });
    // Well-formed but never issued.
    const randomToken = `qa${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    const random = await request.get(`${API}/guest-checkout/orders/${randomToken}`);
    expect(random.status()).toBe(404);
    expect(JSON.stringify(await random.json())).not.toMatch(/guest_phone|guest_name|order_number/);
    const malformed = await request.get(`${API}/guest-checkout/orders/short`);
    expect(malformed.status()).toBe(422);
    const tampered = await request.post(`${API}/guest-checkout/orders/${randomToken}/payment-method/cod`);
    expect(tampered.status()).toBe(404);

    for (const token of [randomToken, 'short', '%27%20OR%201%3D1']) {
      await page.goto(`/order/guest/${token}`);
      await expect(page.getByRole('heading', { name: "We couldn't find that order" })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Confirm your order' })).toHaveCount(0);
      await expectNoLeakedInternals(page, expect);
    }
    expect(failures).toEqual([]);
  });

  test('a real QA guest token opens its own order', async ({ request }) => {
    const token = process.env.E2E_GUEST_ORDER_TOKEN;
    test.skip(!token, 'NOT CONFIGURED: set E2E_GUEST_ORDER_TOKEN, or run npm run test:e2e:full which seeds one');
    const response = await request.get(`${API}/guest-checkout/orders/${token}`);
    // Status only: the token and the order body are never printed.
    expect(response.status(), 'QA guest token lookup').toBe(200);
  });
});
