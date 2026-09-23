import { expect, test } from '@playwright/test';

const essentialFailures = (page) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    // Google Fonts is cosmetic and intentionally blocked in the restricted
    // local browser environment. Local API/image failures still fail below.
    if (message.type() === 'error' && !message.text().includes('net::ERR_NETWORK_ACCESS_DENIED')) failures.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    const url = response.url();
    if (response.status() >= 400 && (url.includes('/api/') || url.includes('/assets/'))) failures.push(`HTTP ${response.status()}: ${url}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.startsWith('http://localhost:5173/') || url.startsWith('http://127.0.0.1:4002/')) {
      failures.push(`network: ${request.failure()?.errorText || 'request failed'}: ${url}`);
    }
  });
  return failures;
};

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function openPdp(page, slug) {
  await page.goto(`/p/${slug}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
}

test('homepage shows curated featured products without essential browser failures', async ({ page }) => {
  const failures = essentialFailures(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  const featured = page.locator('section[aria-labelledby="featured-cases-title"]');
  await featured.scrollIntoViewIfNeeded();
  await expect(featured.getByText('Pink Floral', { exact: true })).toBeVisible();
  await expect(featured.getByText('Bow cherry iconic', { exact: true })).toBeVisible();
  await expect(featured.getByText('Chetah iconic', { exact: true })).toBeVisible();
  await expect(featured.getByRole('link', { name: /Explore all covers/i })).toBeVisible();
  const firstCard = featured.locator('.featured-case').first();
  await firstCard.hover();
  await expect(firstCard).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(failures).toEqual([]);
});

test('multi-model PDP keeps selection, SKU, stock, and cart control valid', async ({ page }) => {
  const failures = essentialFailures(page);
  await openPdp(page, 'pink-love-bow');
  const modelGroup = page.getByRole('group', { name: 'Phone Model' });
  await expect(modelGroup).toBeVisible();
  const modelButtons = modelGroup.getByRole('button');
  await expect(modelButtons).toHaveCount(6);
  await modelGroup.getByRole('button', { name: 'iPhone 14 Pro Max' }).click();
  await expect(modelGroup.getByRole('button', { name: 'iPhone 14 Pro Max' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/^SKU CV-PINK-LOVE-BOW-/)).toBeVisible();
  await expect(page.getByText(/In stock|Only \d+ left/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(failures).toEqual([]);
});

test('single-model PDPs expose their automatically selected compatibility chips', async ({ page }) => {
  const failures = essentialFailures(page);
  await openPdp(page, 'flame-silver');
  const flameModel = page.getByRole('group', { name: 'Phone Model' }).getByRole('button', { name: 'iPhone 11 Pro' });
  await expect(flameModel).toBeVisible();
  await expect(flameModel).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('SKU CV-FLAME-SILVER-IPHONE-11-PRO')).toBeVisible();
  await openPdp(page, 'glossy-white');
  const glossyModel = page.getByRole('group', { name: 'Phone Model' }).getByRole('button', { name: 'iPhone 14' });
  await expect(glossyModel).toBeVisible();
  await expect(glossyModel).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('SKU CV-GLOSSY-WHITE-IPHONE-14')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(failures).toEqual([]);
});

test('catalog pages fit the required viewport matrix', async ({ page }) => {
  const failures = essentialFailures(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 400, height: 689 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    await openPdp(page, 'flame-silver');
    await expect(page.getByRole('group', { name: 'Phone Model' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto('/');
    const featured = page.locator('section[aria-labelledby="featured-cases-title"]');
    await featured.scrollIntoViewIfNeeded();
    await expect(featured.getByText('Pink Floral', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  expect(failures).toEqual([]);
});

test('PDP retains a loading state during a delayed catalog response', async ({ page }) => {
  await page.route('**/api/products/flame-silver', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/p/flame-silver');
  await expect(page.locator('.spinner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
});
