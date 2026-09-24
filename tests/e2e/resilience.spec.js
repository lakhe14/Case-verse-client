import { expect, test } from '@playwright/test';
import { essentialFailures, expectNoLeakedInternals } from './helpers/monitor.js';
import { REPRESENTATIVE } from './helpers/viewport.js';
import { chooseDestination, destinationInput } from './helpers/destination.js';
import {
  delay, json, mockCustomerSession, mockDestinations, seedGuestCart, serverError, syntheticCart, syntheticLine, syntheticPreview,
} from './helpers/mocks.js';

const guestLine = {
  variant_id: syntheticLine.variant_id,
  quantity: 1,
  product: syntheticLine.product,
  sku: syntheticLine.sku,
  unit_price: 699,
  compare_at_price: null,
  stock_quantity: 5,
};

async function fillGuestAddress(page) {
  await page.getByLabel('Full name').fill('QA Guest');
  await page.getByLabel('Phone number').fill('9800000000');
  await page.getByLabel('Province').fill('Bagmati');
  await page.getByLabel('District').fill('Kathmandu');
  await page.getByLabel('Municipality / City').fill('Kathmandu');
  await page.getByLabel('Area / Street').fill('QA test street');
}

const summary = (page) => page.locator('.checkout-summary');
const placeButton = (page) => page.getByRole('button', { name: /Place order & continue to payment|Placing order/ });

test.describe('slow network', () => {
  test('delayed cart fetch shows a loading state, then the cart', async ({ page }) => {
    const failures = essentialFailures(page);
    await mockCustomerSession(page);
    await page.route('**/api/cart', async (route) => { await delay(1500); return json(route, { data: syntheticCart }); });
    await page.goto('/cart');
    await expect(page.locator('.spinner').first()).toBeVisible();
    await expect(page.locator('.cart-line')).toContainText('QA synthetic cover');
    expect(failures).toEqual([]);
  });

  test('delayed destinations keep the destination field disabled and the order blocked until they arrive', async ({ page }) => {
    const failures = essentialFailures(page);
    await seedGuestCart(page, [guestLine]);
    await page.route('**/api/guest-checkout/preview', (route) => json(route, { data: syntheticPreview() }));
    await mockDestinations(page, { delayMs: 1500 });
    await page.goto('/checkout');
    const destination = destinationInput(page);
    await expect(destination).toBeDisabled();
    await expect(placeButton(page)).toBeDisabled();
    await expect(destination).toBeEnabled();
    await destination.fill('qa');
    await expect(page.getByRole('option')).toHaveCount(2);
    expect(failures).toEqual([]);
  });

  test('a slower re-quote hides the previous total instead of showing it as current', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.tablet);
    await mockCustomerSession(page);
    await mockDestinations(page);
    await page.route('**/api/orders/preview', async (route) => {
      const outside = route.request().postDataJSON().parcelmoover_destination_id === 'qa-dest-outside';
      if (outside) await delay(1500);
      return json(route, { data: syntheticPreview({ shipping: outside ? 200 : 100 }) });
    });
    await page.goto('/checkout');
    await chooseDestination(page, 'inside', 'Qa Inside Valley, Kathmandu');
    await expect(summary(page).locator('.summary-total')).toContainText('799.00');
    await expect(placeButton(page)).toBeEnabled();

    await chooseDestination(page, 'pokhara', 'Qa Pokhara, Kaski');
    await expect(summary(page).locator('.spinner')).toBeVisible();
    await expect(summary(page)).not.toContainText('799.00');
    await expect(placeButton(page)).toBeDisabled();
    await expect(summary(page).locator('.summary-total')).toContainText('899.00');
    await expect(placeButton(page)).toBeEnabled();
    expect(failures).toEqual([]);
  });

  test('delayed guest preview preserves typed details and blocks submission', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await seedGuestCart(page, [guestLine]);
    await mockDestinations(page);
    let placeRequests = 0;
    await page.route('**/api/guest-checkout/orders', (route) => { placeRequests += 1; return route.abort('blockedbyclient'); });
    await page.route('**/api/guest-checkout/preview', async (route) => {
      if (route.request().postDataJSON().guest) await delay(1500);
      return json(route, { data: syntheticPreview() });
    });
    await page.goto('/checkout');
    await fillGuestAddress(page);
    await chooseDestination(page, 'inside', 'Qa Inside Valley, Kathmandu');
    await expect(placeButton(page)).toBeDisabled();
    await page.getByLabel('Full name').press('Enter');
    await expect(summary(page).locator('.summary-total')).toContainText('799.00');
    await expect(page.getByLabel('Full name')).toHaveValue('QA Guest');
    await expect(page.getByLabel('Area / Street')).toHaveValue('QA test street');
    await expect(placeButton(page)).toBeEnabled();
    expect(placeRequests).toBe(0);
    expect(failures).toEqual([]);
  });
});

test.describe('API failures', () => {
  test('product API 500 and network failure show a safe message on the PDP', async ({ page }) => {
    const failures = essentialFailures(page, { allow: [{ url: /\/api\/products\/flame-silver$/, status: 500, network: true }] });
    await page.route('**/api/products/flame-silver', serverError);
    await page.goto('/p/flame-silver');
    await expect(page.locator('.alert.error')).toHaveText('Something went wrong');
    await expectNoLeakedInternals(page, expect);

    await page.unroute('**/api/products/flame-silver');
    await page.route('**/api/products/flame-silver', (route) => route.abort('failed'));
    await page.reload();
    await expect(page.locator('.alert.error')).toBeVisible();
    await expectNoLeakedInternals(page, expect);
    await expect(page.locator('.site-footer')).toBeVisible();
    expect(failures).toEqual([]);
  });

  test('homepage survives failing catalog APIs', async ({ page }) => {
    const failures = essentialFailures(page, { allow: [{ url: /\/api\/products/, status: 500 }] });
    await page.route(/\/api\/products(\/bestsellers)?(\?.*)?$/, serverError);
    await page.route(/\/api\/products\/[^/?]+$/, serverError);
    await page.goto('/');
    await expect(page.locator('.brand')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
    await expectNoLeakedInternals(page, expect);
    expect(failures).toEqual([]);
  });

  test('ParcelMoover destination failure is explained and blocks the order', async ({ page }) => {
    const failures = essentialFailures(page, { allow: [{ url: /\/api\/shipping\/parcelmoover\/destinations$/, status: 500 }] });
    await seedGuestCart(page, [guestLine]);
    await page.route('**/api/guest-checkout/preview', (route) => json(route, { data: syntheticPreview() }));
    await mockDestinations(page, { fail: true });
    await page.goto('/checkout');
    await expect(page.getByText('Delivery destinations are temporarily unavailable. Please try again.')).toBeVisible();
    await expect(placeButton(page)).toBeDisabled();
    await expectNoLeakedInternals(page, expect);

    await mockCustomerSession(page);
    await page.evaluate(() => sessionStorage.removeItem('cv_e2e_seeded'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Shipping address' })).toBeVisible();
    await expect(page.getByText('Delivery destinations are temporarily unavailable. Please try again.')).toBeVisible();
    await expect(placeButton(page)).toBeDisabled();
    expect(failures).toEqual([]);
  });

  test('checkout preview failure is shown with a working retry', async ({ page }) => {
    const failures = essentialFailures(page, { allow: [{ url: /\/api\/orders\/preview$/, status: 500 }] });
    await mockCustomerSession(page);
    await mockDestinations(page);
    let previews = 0;
    await page.route('**/api/orders/preview', (route) => {
      previews += 1;
      return previews === 1 ? serverError(route) : json(route, { data: syntheticPreview() });
    });
    await page.goto('/checkout');
    await chooseDestination(page, 'inside', 'Qa Inside Valley, Kathmandu');
    await expect(summary(page).locator('.alert.error')).toHaveText('Something went wrong');
    await expect(summary(page).locator('.spinner')).toHaveCount(0);
    await expect(placeButton(page)).toBeDisabled();
    await expectNoLeakedInternals(page, expect);

    await summary(page).getByRole('button', { name: 'Try again' }).click();
    await expect(summary(page).locator('.summary-total')).toContainText('799.00');
    await expect(placeButton(page)).toBeEnabled();
    expect(previews).toBe(2);
    expect(failures).toEqual([]);
  });

  test('guest preview failure is shown and recovers when details change', async ({ page }) => {
    const failures = essentialFailures(page, { allow: [{ url: /\/api\/guest-checkout\/preview$/, status: 500 }] });
    await seedGuestCart(page, [guestLine]);
    await mockDestinations(page);
    let failNext = false;
    await page.route('**/api/guest-checkout/preview', (route) => {
      if (failNext) { failNext = false; return serverError(route); }
      return json(route, { data: syntheticPreview() });
    });
    await page.goto('/checkout');
    await fillGuestAddress(page);
    failNext = true;
    await chooseDestination(page, 'inside', 'Qa Inside Valley, Kathmandu');
    await expect(summary(page).locator('.alert.error')).toHaveText('Something went wrong');
    await expect(placeButton(page)).toBeDisabled();
    await expectNoLeakedInternals(page, expect);

    await page.getByLabel('Municipality / City').fill('Lalitpur');
    await expect(summary(page).locator('.summary-total')).toContainText('799.00');
    await expect(summary(page).locator('.alert.error')).toHaveCount(0);
    await expect(placeButton(page)).toBeEnabled();
    expect(failures).toEqual([]);
  });
});
