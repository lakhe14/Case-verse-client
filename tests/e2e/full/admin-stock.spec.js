/**
 * Admin stock editing respects active reservations (physical >= reserved),
 * through the real admin UI against the isolated E2E API. Uses a variant no
 * other browser suite touches and restores its stock afterwards.
 */
import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { essentialFailures, expectNoLeakedInternals } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';
import { expectNoHorizontalOverflow } from '../helpers/viewport.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const RUN_ID = process.env.E2E_RUN_ID;
const SLUG = 'pink-floral';
const MODEL = 'iPhone 15 Pro';
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 400, height: 689 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
];

async function target(request) {
  const { data } = await (await request.get(`${API}/products/${SLUG}`)).json();
  const variant = data.variants.find((v) => v.attributes.some((a) => a.value === MODEL));
  return { productId: data.id, variantId: variant.id };
}

async function adminStock(request, productId, variantId) {
  const manager = await apiLogin(request, 'limitedStaff'); // Product Manager: manage_products
  const { data } = await (await request.get(`${API}/admin/products/${productId}`, { headers: bearer(manager) })).json();
  const v = data.variants.find((x) => x.id === variantId);
  return { physical: v.stock_quantity, reserved: v.reserved_quantity, available: v.available_quantity };
}

async function hold(request, variantId, quantity, label) {
  const response = await request.post(`${API}/guest-checkout/orders`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      items: [{ variant_id: variantId, quantity }],
      guest: { name: `E2E ${label}`, phone: '9800000015', province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu', area: 'E2E lane', notes: `${RUN_ID} ${label}`, parcelmoover_destination_id: 'e2e-kathmandu' },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).guest_token;
}

async function expectNumbers(row, { physical, reserved, available }) {
  await expect(row.getByTestId('inv-physical')).toHaveText(String(physical));
  await expect(row.getByTestId('inv-reserved')).toHaveText(String(reserved));
  await expect(row.getByTestId('inv-available')).toHaveText(String(available));
}

test('staff see physical, reserved and available stock and cannot set physical below reserved', async ({ page, request }) => {
  const failures = essentialFailures(page, { allow: [{ url: /\/api\/admin\/products\/\d+\/variants\/\d+$/, status: 409 }] });
  const { productId, variantId } = await target(request);
  const start = await adminStock(request, productId, variantId);
  expect(start.reserved).toBe(0);
  expect(start.physical).toBeGreaterThanOrEqual(8);
  const tokens = [];

  try {
    tokens.push(await hold(request, variantId, 6, 'admin-stock-hold'));
    const physical = start.physical;

    await useSession(page, await apiLogin(request, 'limitedStaff'));
    await page.goto(`/admin/products/${productId}`);
    const row = page.getByTestId(`variant-row-${variantId}`);
    const stock = row.getByLabel('Physical stock');
    const save = row.getByRole('button', { name: 'Save changes' });

    // 1. Numbers and the reserved warning.
    await expectNumbers(row, { physical, reserved: 6, available: physical - 6 });
    await expect(row.getByTestId('reserved-warning')).toHaveText('6 units are reserved by pending orders. Physical stock cannot be reduced below 6.');
    await expect(stock).toHaveAttribute('min', '6');

    // 2. Below the visible floor: the browser refuses to submit; no request is sent.
    let puts = 0;
    page.on('request', (r) => { if (r.method() === 'PUT' && r.url().includes('/variants/')) puts += 1; });
    await stock.fill('5');
    await save.click();
    expect(await stock.evaluate((el) => el.validity.rangeUnderflow)).toBe(true);
    expect(puts).toBe(0);
    expect((await adminStock(request, productId, variantId)).physical).toBe(physical);

    // 3. The server is authoritative: more stock is reserved after the page loaded,
    //    so a value above the page's floor is still refused, with a safe message.
    tokens.push(await hold(request, variantId, 2, 'admin-stock-late'));
    await stock.fill('7');
    await save.click();
    await expect(row.getByTestId('stock-floor-error')).toHaveText('Stock cannot be set below 8. That many units are now reserved by pending orders.');
    await expectNoLeakedInternals(page, expect);
    await expect(row).not.toContainText(/order[_ ]?id|CV-\d{8}|reservation_id|E2E admin-stock/i);
    expect(await adminStock(request, productId, variantId)).toEqual({ physical, reserved: 8, available: physical - 8 });

    // 4. A valid change succeeds and the numbers refresh.
    await stock.fill(String(physical + 2));
    await save.click();
    await expect(row.getByRole('button', { name: 'Saved' })).toBeVisible();
    await expectNumbers(row, { physical: physical + 2, reserved: 8, available: physical - 6 });
    await expect(row.getByTestId('stock-floor-error')).toHaveCount(0);

    // 5. Usable at phone, tablet and laptop widths.
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto(`/admin/products/${productId}`);
      await expectNumbers(row, { physical: physical + 2, reserved: 8, available: physical - 6 });
      await expect(row.getByTestId('reserved-warning')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const card = await row.boundingBox();
      for (const part of [row.getByTestId('variant-inventory'), row.getByTestId('reserved-warning'), stock, row.getByRole('button', { name: 'Saved' })]) {
        const box = await part.boundingBox();
        expect(box.x, `${viewport.width}px`).toBeGreaterThanOrEqual(card.x - 1);
        expect(box.x + box.width, `${viewport.width}px`).toBeLessThanOrEqual(card.x + card.width + 1);
      }
    }
  } finally {
    for (const token of tokens) await request.post(`${API}/guest-checkout/orders/${token}/cancel`);
    const manager = await apiLogin(request, 'limitedStaff');
    const restored = await request.put(`${API}/admin/products/${productId}/variants/${variantId}`, { headers: bearer(manager), data: { stock_quantity: start.physical } });
    expect(restored.status()).toBe(200);
  }
  expect(await adminStock(request, productId, variantId)).toEqual(start);
  expect(failures).toEqual([]);
});
