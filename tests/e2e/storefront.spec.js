import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import { essentialFailures } from './helpers/monitor.js';

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

test('homepage uses and plays the dedicated animated WebP hero at launch viewports', async ({ page }) => {
  const failures = essentialFailures(page);
  const frameSignature = async (hero) => crypto.createHash('sha256')
    .update(await hero.screenshot({ animations: 'allow' }))
    .digest('hex');

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const hero = page.locator('.hero-product');
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute('src', '/assets/caseverse/case-rotation.webp');
    await expect.poll(() => hero.evaluate((img) => ({ width: img.naturalWidth, height: img.naturalHeight })))
      .toEqual({ width: 800, height: 600 });
    await expectNoHorizontalOverflow(page);

    const signatures = new Set();
    for (let sample = 0; sample < 4; sample += 1) {
      signatures.add(await frameSignature(hero));
      await page.waitForTimeout(180);
    }
    expect(signatures.size, `animated WebP advances at ${viewport.width}x${viewport.height}`).toBeGreaterThan(1);
  }
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
  await expect(page.getByText(/\d+ in stock|Only \d+ left/)).toBeVisible();
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
  // Glossy white gained a second model (iPhone 13 Pro) in the 2026-09-30 stock
  // reconciliation and is no longer single-model; cherry-bow still is.
  await openPdp(page, 'cherry-bow');
  const cherryModel = page.getByRole('group', { name: 'Phone Model' }).getByRole('button', { name: 'iPhone 15' });
  await expect(cherryModel).toBeVisible();
  await expect(cherryModel).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('SKU CV-CHERRY-BOW-IPHONE-15')).toBeVisible();
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

test('a campaign window more than ~25 days out never causes a request storm (useCampaign setTimeout overflow)', async ({ page }) => {
  // setTimeout silently fires almost immediately past the 32-bit signed int
  // max delay (~24.8 days). A campaign ending further out than that used to
  // make useCampaign() refetch in a tight infinite loop (see src/hooks/useCampaign.js).
  let hits = 0;
  await page.route('**/api/campaign/dashain', (route) => {
    hits += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          code: 'DASHAIN_2026',
          name: 'Dashain Trio Offer',
          active: true,
          starts_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          ends_at: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
          required_case_quantity: 2,
          bundle_price: 1199,
          free_holder_quantity: 1,
          free_holder_name: 'FREE Suction Phone Holder',
        },
      }),
    });
  });
  await openPdp(page, 'flame-silver');
  await page.waitForTimeout(1500);
  expect(hits).toBeLessThanOrEqual(2);
});
