import { expect, test } from '@playwright/test';
import { essentialFailures } from './helpers/monitor.js';
import { REPRESENTATIVE } from './helpers/viewport.js';
import { json } from './helpers/mocks.js';
import { openPdp } from './helpers/catalog.js';

test.describe('contact navigation', () => {
  test('desktop nav: Contact goes to /contact, WhatsApp is a distinct labeled action', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.desktop);
    await page.goto('/');
    const nav = page.locator('.nav');
    await nav.getByRole('link', { name: 'Contact', exact: true }).click();
    await expect(page).toHaveURL(/\/contact$/);

    await page.goto('/');
    const whatsapp = nav.getByRole('link', { name: 'WhatsApp' });
    await expect(whatsapp).toBeVisible();
    await expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(await whatsapp.getAttribute('href')).toMatch(/wa\.me|whatsapp/i);
    expect(failures).toEqual([]);
  });

  test('mobile menu: Contact goes to /contact, WhatsApp is separately labeled', async ({ page }) => {
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.locator('.nav-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
    await drawer.getByRole('link', { name: 'Contact', exact: true }).click();
    await expect(page).toHaveURL(/\/contact$/);
  });

  test('footer contact links are unambiguous', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('.site-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
    await expect(footer.getByRole('link', { name: 'Message us on WhatsApp' })).toHaveAttribute('target', '_blank');
  });
});

test.describe('logo', () => {
  test('never underlines on hover or focus', async ({ page }) => {
    await page.goto('/');
    const brand = page.locator('.nav .brand');
    await brand.hover();
    await expect(brand).toHaveCSS('text-decoration-line', 'none');
    await brand.focus();
    await expect(brand).toHaveCSS('text-decoration-line', 'none');
  });
});

test.describe('sticky navbar', () => {
  for (const [label, viewport] of Object.entries({ mobile: REPRESENTATIVE.mobile, desktop: REPRESENTATIVE.desktop })) {
    test(`stays visible while scrolling the homepage (${label})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const nav = page.locator('.nav');
      await expect(nav).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 1600));
      await page.waitForTimeout(200);
      await expect(nav).toBeVisible();
      // Fixed to the viewport: never scrolls away with the page (1600px of
      // scroll consumed), only recedes a few px within the banner/nav stack.
      const top = await nav.evaluate((el) => el.getBoundingClientRect().top);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThan(120);
    });
  }
});

test.describe('footer stays at the bottom on short pages', () => {
  for (const path of ['/contact', '/faq']) {
    test(`${path} footer's bottom edge reaches the viewport bottom, not mid-screen`, async ({ page }) => {
      await page.setViewportSize(REPRESENTATIVE.desktop);
      await page.goto(path);
      const footerBottom = await page.locator('.site-footer').evaluate((el) => el.getBoundingClientRect().bottom);
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      // Short content: the flex layout stretches <main> so the footer's own
      // bottom edge lands on the viewport bottom instead of floating mid-page.
      expect(footerBottom).toBeGreaterThanOrEqual(viewportHeight - 2);
    });
  }
});

test.describe('/covers layout', () => {
  test('desktop shows a left filter sidebar; the mobile toggle stays hidden', async ({ page }) => {
    await page.setViewportSize(REPRESENTATIVE.desktop);
    await page.goto('/covers');
    await expect(page.locator('.shop-filters')).toBeVisible();
    await expect(page.locator('.shop-filters-toggle')).toBeHidden();
    const [filtersX, resultsX] = await Promise.all([
      page.locator('.shop-filters').evaluate((el) => el.getBoundingClientRect().left),
      page.locator('.shop-results').evaluate((el) => el.getBoundingClientRect().left),
    ]);
    expect(filtersX).toBeLessThan(resultsX);
  });

  test('mobile hides the sidebar behind an accessible Filters toggle', async ({ page }) => {
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await page.goto('/covers');
    await expect(page.locator('.shop-filters')).toBeHidden();
    const toggle = page.getByRole('button', { name: /^Filters/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const drawer = page.locator('#shop-filters-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel('Sort', { exact: true })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toBeHidden();
  });
});

test.describe('empty review state', () => {
  test('shows a CTA that scrolls to and focuses the write-a-review section', async ({ page }) => {
    // Not signed in for this run, so WriteReview never calls the eligibility
    // endpoint — only the product's review list needs to come back empty.
    await page.route('**/api/reviews/product/*', (route) => json(route, { data: [], summary: { count: 0, average: 0 } }));
    await openPdp(page, 'flame-silver');
    const cta = page.getByRole('button', { name: /first to review/i });
    await expect(cta).toBeVisible();
    await cta.click();

    const writeReview = page.locator('#write-review');
    await expect(writeReview).toBeVisible();
    await expect.poll(() => writeReview.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= -1 && r.top < window.innerHeight;
    })).toBe(true);
    // Not signed in on this run: the CTA should land focus on the sign-in prompt.
    await expect(writeReview.getByRole('link', { name: 'Sign in' })).toBeFocused();
  });
});
