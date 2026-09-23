import { expect, test } from '@playwright/test';
import { addToCartFromPdp } from './helpers/catalog.js';
import { essentialFailures } from './helpers/monitor.js';
import { restoreCart, snapshotCart } from './helpers/qa-cleanup.js';
import { API, apiLogin, bearer, notConfigured, uiCustomerLogin, uiLogout, useSession } from './helpers/session.js';
import { REPRESENTATIVE, expectNoHorizontalOverflow } from './helpers/viewport.js';
import {
  SYNTHETIC_ORDER_ID, delay, json, mockCustomerSession, mockDestinations, syntheticOrder, syntheticPreview,
} from './helpers/mocks.js';

test.describe('authenticated checkout', () => {
  test('QA customer signs in, adds a real cover, and reaches a priced checkout', async ({ page, request }) => {
    const reason = notConfigured('customer');
    test.skip(Boolean(reason), reason);
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.desktop);
    const session = await apiLogin(request, 'customer');
    const cartBefore = await snapshotCart(request, session);
    try {
      await uiCustomerLogin(page);
      await addToCartFromPdp(page, 'pink-love-bow', 'iPhone 14 Pro Max');

      await page.getByRole('button', { name: /^Cart/ }).first().click();
      const miniCart = page.getByRole('dialog', { name: 'Your cart' });
      await expect(miniCart).toContainText('SKU CV-PINK-LOVE-BOW-');
      await miniCart.getByRole('link', { name: 'Checkout' }).click();

      await expect(page).toHaveURL(/\/checkout$/);
      await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Shipping address' })).toBeVisible();
      await expect(page.locator('input[name="ship"]:checked')).toHaveCount(1);
      await expect(page.getByText('Billing address same as shipping')).toBeVisible();

      const destination = page.getByLabel('ParcelMoover delivery destination');
      await expect.poll(() => destination.locator('option').count()).toBeGreaterThan(1);
      const placeOrder = page.getByRole('button', { name: 'Place order & continue to payment' });
      await expect(placeOrder).toBeDisabled();
      await destination.selectOption({ index: 1 });

      const summary = page.locator('.checkout-summary');
      await expect(summary.locator('.summary-total')).toBeVisible({ timeout: 15_000 });
      await expect(summary.locator('.checkout-price-lines')).toContainText(/× 1/);
      await expect(summary).toContainText('Subtotal');
      await expect(summary).toContainText('Shipping');
      await expect(page.locator('.checkout-payment-note')).toContainText(/100\.00 eSewa advance/);
      await expect(placeOrder).toBeEnabled();
      await expectNoHorizontalOverflow(page);
      // Stops here: no disposable-order cleanup exists, so a real order is never placed.

      await uiLogout(page);
      expect(failures).toEqual([]);
    } finally {
      await restoreCart(request, session, cartBefore);
    }
  });

  test('order placement is sent once and opens the payment step (synthetic order)', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await mockCustomerSession(page);
    await mockDestinations(page);
    await page.route('**/api/orders/preview', (route) => json(route, { data: syntheticPreview() }));
    let placeRequests = 0;
    await page.route('**/api/orders', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      placeRequests += 1;
      await delay(800);
      return json(route, { data: { id: SYNTHETIC_ORDER_ID, order_number: 'QA-E2E-0001' } }, 201);
    });
    await page.route(`**/api/orders/${SYNTHETIC_ORDER_ID}`, (route) => json(route, { data: syntheticOrder() }));

    await page.goto('/checkout');
    await page.getByLabel('ParcelMoover delivery destination').selectOption('qa-dest-inside');
    await expect(page.locator('.checkout-summary .summary-total')).toContainText('799.00');
    const placeOrder = page.getByRole('button', { name: 'Place order & continue to payment' });
    await placeOrder.click();
    await expect(page.getByRole('button', { name: 'Placing order' })).toBeDisabled();
    await page.getByRole('button', { name: 'Placing order' }).click({ force: true }).catch(() => {});
    await expect(page).toHaveURL(new RegExp(`/account/orders/${SYNTHETIC_ORDER_ID}$`));
    await expect(page.getByRole('heading', { name: 'Confirm your order' })).toBeVisible();
    expect(placeRequests).toBe(1);
    expect(failures).toEqual([]);
  });
});

test.describe('ownership isolation', () => {
  test('a customer cannot read an order that belongs to someone else', async ({ page, request }) => {
    const reason = notConfigured('customer', 'staff');
    test.skip(Boolean(reason), reason);
    const customer = await apiLogin(request, 'customer');
    const staff = await apiLogin(request, 'staff');
    const me = await (await request.get(`${API}/auth/me`, { headers: bearer(customer) })).json();
    // Read-only discovery of an order the QA customer does not own.
    const all = await request.get(`${API}/admin/orders?limit=50`, { headers: bearer(staff) });
    expect(all.status()).toBe(200);
    const foreign = (await all.json()).data.find((order) => order.user_id !== me.user.id);
    test.skip(!foreign, 'NOT CONFIGURED: no order owned by another account exists to probe');

    const direct = await request.get(`${API}/orders/${foreign.id}`, { headers: bearer(customer) });
    expect(direct.status()).toBe(404);
    const mine = await (await request.get(`${API}/orders?limit=50`, { headers: bearer(customer) })).json();
    expect(mine.data.map((order) => order.id)).not.toContain(foreign.id);

    const failures = essentialFailures(page, { allow: [{ url: new RegExp(`/api/orders/${foreign.id}$`), status: 404 }] });
    await useSession(page, customer);
    await page.goto(`/account/orders/${foreign.id}`);
    await expect(page.locator('.alert.error')).toBeVisible();
    await expect(page.getByText(foreign.order_number)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Confirm your order' })).toHaveCount(0);
    expect(failures).toEqual([]);
  });

  test('customer B cannot read customer A\'s order', async ({ request }) => {
    const reason = notConfigured('customer', 'customerB');
    test.skip(Boolean(reason), reason);
    const customerA = await apiLogin(request, 'customer');
    const customerB = await apiLogin(request, 'customerB');
    const ordersA = await (await request.get(`${API}/orders?limit=1`, { headers: bearer(customerA) })).json();
    test.skip(!ordersA.data.length, 'NOT CONFIGURED: QA customer A has no order to probe');
    const response = await request.get(`${API}/orders/${ordersA.data[0].id}`, { headers: bearer(customerB) });
    expect(response.status()).toBe(404);
  });
});
