import { expect, test } from '@playwright/test';
import { essentialFailures } from './helpers/monitor.js';
import { REPRESENTATIVE } from './helpers/viewport.js';
import { json, mockCustomerSession, mockStaffSession } from './helpers/mocks.js';

const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));

test.describe('route scroll behaviour', () => {
  for (const [label, viewport] of Object.entries({ mobile: REPRESENTATIVE.mobile, desktop: REPRESENTATIVE.desktop })) {
    test(`a link from the bottom of one page opens the next page at the top (${label})`, async ({ page }) => {
      const failures = essentialFailures(page);
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.locator('.site-footer').scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(() => scrollY(page)).toBeGreaterThan(400);

      await page.locator('.site-footer').getByRole('link', { name: 'Shipping & delivery' }).click();
      await expect(page).toHaveURL(/\/shipping$/);
      await expect.poll(() => scrollY(page)).toBe(0);

      // Same again between two info pages (same layout, different pathname).
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.locator('.site-footer').getByRole('link', { name: 'Privacy policy' }).click();
      await expect(page).toHaveURL(/\/privacy$/);
      await expect.poll(() => scrollY(page)).toBe(0);
      expect(failures).toEqual([]);
    });
  }

  test('back returns to the previous page without forcing it to the top', async ({ page }) => {
    await page.setViewportSize(REPRESENTATIVE.desktop);
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => scrollY(page)).toBeGreaterThan(400);
    await page.locator('.site-footer').getByRole('link', { name: 'FAQ' }).click();
    await expect.poll(() => scrollY(page)).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    // Browser restoration: never snapped to the top by the router.
    await expect.poll(() => scrollY(page), { timeout: 8000 }).toBeGreaterThan(0);
  });

  test('a URL with a hash scrolls to that element once the page has rendered', async ({ page }) => {
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await page.goto('/#featured-cases-title');
    const target = page.locator('#featured-cases-title');
    await expect(target).toBeVisible();
    await expect.poll(() => scrollY(page)).toBeGreaterThan(100);
    await expect.poll(() => target.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(200);
  });
});

test.describe('admin route guards', () => {
  test('a signed-in customer visiting /admin/* is sent to their account', async ({ page }) => {
    const failures = essentialFailures(page);
    await mockCustomerSession(page);
    await page.route('**/api/auth/profile', (route) => json(route, { data: { id: 990401, name: 'QA Customer', email: 'qa-customer@example.invalid' } }));
    let adminCalls = 0;
    page.on('request', (request) => { if (/\/api\/admin\//.test(request.url())) adminCalls += 1; });
    for (const path of ['/admin', '/admin/orders', '/admin/payment-confirmations', '/admin/login']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/account$/);
    }
    await expect(page.getByRole('heading', { name: 'Staff sign in' })).toHaveCount(0);
    expect(adminCalls).toBe(0);
    expect(failures).toEqual([]);
  });

  test('a guest visiting /admin/* is sent to staff sign-in', async ({ page }) => {
    for (const path of ['/admin', '/admin/customers']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
    }
  });

  test('authorized staff stay on the admin page they asked for', async ({ page }) => {
    await page.setViewportSize(REPRESENTATIVE.desktop);
    await mockStaffSession(page, ['manage_order_payments']);
    await page.route('**/api/admin/payment-confirmations', (route) => json(route, { data: [] }));
    await page.goto('/admin/payment-confirmations');
    await expect(page).toHaveURL(/\/admin\/payment-confirmations$/);
    await expect(page.getByRole('heading', { name: 'Payment review' })).toBeVisible();
  });
});
