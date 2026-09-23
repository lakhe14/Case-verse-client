import { expect, test } from '@playwright/test';
import { openPdp } from './helpers/catalog.js';
import { essentialFailures } from './helpers/monitor.js';
import { VIEWPORT_MATRIX, expectNoHorizontalOverflow } from './helpers/viewport.js';
import {
  json, mockDestinations, mockStaffSession, seedGuestCart, syntheticLine, syntheticPreview,
} from './helpers/mocks.js';

// Layout smoke only. Deep interaction flows run at the representative
// mobile/tablet/desktop sizes in the other specs.
const guestLine = {
  variant_id: syntheticLine.variant_id,
  quantity: 1,
  product: syntheticLine.product,
  sku: syntheticLine.sku,
  unit_price: 699,
  compare_at_price: null,
  stock_quantity: 5,
};

async function expectNavbar(page) {
  await expect(page.locator('.brand')).toBeVisible();
  const primary = page.getByRole('navigation', { name: 'Primary' });
  const toggle = page.getByRole('button', { name: 'Open menu' });
  expect((await primary.isVisible()) || (await toggle.isVisible()), 'primary nav or menu toggle visible').toBe(true);
}

for (const viewport of VIEWPORT_MATRIX) {
  test(`layout smoke at ${viewport.name}`, async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedGuestCart(page, [guestLine]);
    await page.route('**/api/guest-checkout/preview', (route) => json(route, { data: syntheticPreview() }));
    await mockDestinations(page);

    await page.goto('/');
    await expectNavbar(page);
    const featured = page.locator('section[aria-labelledby="featured-cases-title"]');
    await featured.scrollIntoViewIfNeeded();
    await expect(featured.getByText('Pink Floral', { exact: true })).toBeVisible();
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await expect(page.locator('.site-footer')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await openPdp(page, 'pink-love-bow');
    await expect(page.getByRole('group', { name: 'Phone Model' }).getByRole('button')).toHaveCount(6);
    await expectNoHorizontalOverflow(page);

    await page.goto('/cart');
    await expect(page.locator('.cart-line')).toContainText('QA synthetic cover');
    await expect(page.locator('.cart-summary')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible();
    await expect(page.locator('.checkout-summary .summary-total')).toContainText('799.00');
    await expectNoHorizontalOverflow(page);

    await mockStaffSession(page, ['manage_order_payments']);
    await page.route('**/api/admin/payment-confirmations', (route) => json(route, { data: [] }));
    await page.goto('/admin/payment-confirmations');
    await expect(page.getByRole('heading', { name: 'Payment review' })).toBeVisible();
    if (viewport.width <= 900) {
      await expect(page.locator('.admin-side')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
    } else {
      await expect(page.locator('.admin-side')).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    expect(failures).toEqual([]);
  });
}
