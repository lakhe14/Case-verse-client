/**
 * Real, DB-backed transactional flows. Runs only under playwright.full.config.js
 * against the isolated E2E API (caseverse_e2e); every order created here is
 * E2E-owned and removed by global teardown. Representative viewports only.
 */
import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { addToCartFromPdp } from '../helpers/catalog.js';
import { essentialFailures } from '../helpers/monitor.js';
import { API, apiLogin, bearer, uiCustomerLogin, useSession } from '../helpers/session.js';
import { REPRESENTATIVE } from '../helpers/viewport.js';
import { files } from '../helpers/mocks.js';
import { chooseDestination } from '../helpers/destination.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
// Guest order pages carry the raw token in their URL: no traces, screenshots or video for this file.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const RUN_ID = process.env.E2E_RUN_ID;
const money = (value) => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function variantId(request, slug) {
  const { data } = await (await request.get(`${API}/products/${slug}`)).json();
  return data.variants[0].id;
}

/** Real customer order through the API (cart -> place). */
async function apiCustomerOrder(request, kind, slug) {
  const session = await apiLogin(request, kind);
  await request.delete(`${API}/cart`, { headers: bearer(session) });
  const add = await request.post(`${API}/cart/items`, { headers: bearer(session), data: { variant_id: await variantId(request, slug), quantity: 1 } });
  expect(add.status()).toBe(201);
  const addresses = await (await request.get(`${API}/addresses`, { headers: bearer(session) })).json();
  const placed = await request.post(`${API}/orders`, { headers: bearer(session), data: { shipping_address_id: addresses.data[0].id, parcelmoover_destination_id: 'e2e-kathmandu' } });
  expect(placed.status()).toBe(201);
  return (await placed.json()).data;
}

/** Real guest order through the API. The token is returned to the caller only. */
async function apiGuestOrder(request, label) {
  const response = await request.post(`${API}/guest-checkout/orders`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: {
      items: [{ variant_id: await variantId(request, 'pink-love-bow'), quantity: 1 }],
      guest: { name: `E2E ${label}`, phone: '9800000011', province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu', area: 'E2E lane', notes: `${RUN_ID} ${label}`, parcelmoover_destination_id: 'e2e-kathmandu' },
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return { order: body.data, token: body.guest_token };
}

async function openStaffQueue(browser, request) {
  const staff = await apiLogin(request, 'staff');
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  const page = await context.newPage();
  await useSession(page, staff);
  await page.goto('/admin/payment-confirmations');
  await expect(page.getByRole('heading', { name: 'Payment review' })).toBeVisible();
  return { page, context };
}

test.describe('customer A order placement', () => {
  test('places exactly one real order from the UI despite rapid repeat clicks', async ({ page, request }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.desktop);
    const session = await apiLogin(request, 'customer');
    const countBefore = (await (await request.get(`${API}/orders`, { headers: bearer(session) })).json()).pagination.total;

    await uiCustomerLogin(page);
    await addToCartFromPdp(page, 'glossy-white');
    await page.goto('/checkout');
    await expect(page.locator('input[name="ship"]:checked')).toHaveCount(1);
    await chooseDestination(page, 'Inside Valley', 'Inside Valley, Kathmandu');

    // Server-authoritative totals: the page must show exactly what the API computes.
    const addresses = await (await request.get(`${API}/addresses`, { headers: bearer(session) })).json();
    const preview = await (await request.post(`${API}/orders/preview`, { headers: bearer(session), data: { shipping_address_id: addresses.data[0].id, parcelmoover_destination_id: 'e2e-kathmandu' } })).json();
    await expect(page.locator('.checkout-summary .summary-total')).toContainText(money(preview.data.total_amount));
    expect(preview.data).toMatchObject({ subtotal: 699, shipping_amount: 100, total_amount: 799, advance_amount: 100 });

    let placeRequests = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url() === `${API}/orders`) placeRequests += 1; });
    const place = page.getByRole('button', { name: 'Place order & continue to payment' });
    await place.dblclick();
    await page.getByRole('button', { name: /Placing order|Place order/ }).click({ force: true, timeout: 1_000 }).catch(() => {});
    await expect(page).toHaveURL(/\/account\/orders\/\d+$/);
    const orderId = Number(page.url().split('/').pop());
    await expect(page.getByRole('heading', { name: 'Confirm your order' })).toBeVisible();

    expect(placeRequests).toBe(1);
    const after = await (await request.get(`${API}/orders`, { headers: bearer(session) })).json();
    expect(after.pagination.total).toBe(countBefore + 1);
    const persisted = (await (await request.get(`${API}/orders/${orderId}`, { headers: bearer(session) })).json()).data;
    await expect(page.getByRole('heading', { name: persisted.order_number })).toBeVisible();
    expect(persisted).toMatchObject({ status: 'pending', subtotal_amount: '699.00', shipping_amount: '100.00', total_amount: '799.00', courier_destination_id: 'e2e-kathmandu' });
    expect(persisted.items).toHaveLength(1);
    expect(persisted.items[0]).toMatchObject({ quantity: 1, unit_price: '699.00', sku_snap: 'CV-GLOSSY-WHITE-IPHONE-14' });
    expect(persisted.paymentConfirmation).toMatchObject({ status: 'pending', advance_amount: '100.00' });
    expect(failures).toEqual([]);
  });

  test('customer B cannot open or act on customer A\'s order', async ({ page, request }) => {
    const order = await apiCustomerOrder(request, 'customer', 'flame-silver');
    const b = await apiLogin(request, 'customerB');
    expect((await request.get(`${API}/orders/${order.id}`, { headers: bearer(b) })).status()).toBe(404);
    expect((await request.post(`${API}/orders/${order.id}/cancel`, { headers: bearer(b) })).status()).toBe(404);
    expect((await request.post(`${API}/orders/${order.id}/payment-method/cod`, { headers: bearer(b) })).status()).toBe(404);
    expect((await request.post(`${API}/orders/${order.id}/payment-proof`, { headers: bearer(b), multipart: { proof: files.validPng } })).status()).toBe(404);
    expect((await request.get(`${API}/admin/payment-confirmations/${order.paymentConfirmation.id}/proof`, { headers: bearer(b) })).status()).toBe(403);

    const failures = essentialFailures(page, { allow: [{ url: new RegExp(`/api/orders/${order.id}$`), status: 404 }] });
    await useSession(page, b);
    await page.goto(`/account/orders/${order.id}`);
    await expect(page.locator('.alert.error')).toBeVisible();
    await expect(page.getByText(order.order_number)).toHaveCount(0);
    expect(failures).toEqual([]);
  });
});

test.describe('guest order and payment lifecycle', () => {
  test('guest places a real order, uploads proof, and payment staff approve it', async ({ page, request, browser }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await addToCartFromPdp(page, 'pink-love-bow', 'iPhone 16');
    await page.goto('/checkout');
    await page.getByLabel('Full name').fill(`E2E guest ${RUN_ID}`);
    await page.getByLabel('Phone number').fill('9800000012');
    await chooseDestination(page, 'Inside Valley', 'Inside Valley, Kathmandu');
    await page.getByLabel('Province').fill('Bagmati');
    await page.getByLabel('District').fill('Kathmandu');
    await page.getByLabel('Municipality / City').fill('Kathmandu');
    await page.getByLabel('Area / Street').fill('E2E lane');
    await page.getByLabel('Delivery notes (optional)').fill(`${RUN_ID} ui-guest`);
    await expect(page.locator('.checkout-summary .summary-total')).toContainText(money(799));

    const placed = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/guest-checkout/orders'));
    await page.locator('.checkout-summary button[type="submit"]').click();
    const response = await placed;
    expect(response.status()).toBe(201);
    const { data: order, guest_token: token } = await response.json();
    await expect(page.getByRole('heading', { name: order.order_number })).toBeVisible();

    // Token checks (status only; the token is never printed).
    expect((await request.get(`${API}/guest-checkout/orders/${token}`)).status()).toBe(200);
    expect((await request.get(`${API}/guest-checkout/orders/${token.slice(0, -4)}zzzz`)).status()).toBe(404);
    expect((await request.get(`${API}/guest-checkout/orders/not-a-token`)).status()).toBe(422);

    await page.locator('input[type="file"].upload-dropzone__input').setInputFiles(files.validPng);
    await page.getByRole('button', { name: 'Submit payment proof' }).click();
    await expect(page.getByRole('button', { name: 'Proof submitted' })).toBeDisabled();
    const afterUpload = (await (await request.get(`${API}/guest-checkout/orders/${token}`)).json()).data;
    expect(afterUpload.paymentConfirmation.status).toBe('proof_uploaded');
    await page.goto('about:blank');

    const { page: admin, context } = await openStaffQueue(browser, request);
    const staffFailures = essentialFailures(admin);
    const row = admin.getByRole('row', { name: new RegExp(order.order_number) });
    await expect(row).toContainText('proof_uploaded');
    await row.getByRole('button', { name: 'View proof' }).click();
    await expect(admin.getByRole('dialog', { name: 'Payment proof preview' }).locator('img')).toHaveAttribute('src', /^blob:/);
    await admin.getByRole('dialog', { name: 'Payment proof preview' }).click();
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(row).toHaveCount(0);
    await context.close();

    const approved = (await (await request.get(`${API}/guest-checkout/orders/${token}`)).json()).data;
    expect(approved.status).toBe('processing');
    expect(approved.paymentConfirmation.status).toBe('approved');
    expect(failures).toEqual([]);
    expect(staffFailures).toEqual([]);
  });

  test('WhatsApp COD stays pending until payment staff confirm it', async ({ page, request, browser }) => {
    const failures = essentialFailures(page);
    const { order, token } = await apiGuestOrder(request, 'cod');
    await page.addInitScript(() => {
      window.__opened = [];
      window.open = (url) => { window.__opened.push(String(url)); return null; };
    });
    const reviewCalls = [];
    page.on('request', (r) => { if (r.url().startsWith(API) && /\/admin\/|\/approve|\/reject/.test(r.url())) reviewCalls.push(r.url()); });
    await page.goto(`/order/guest/${token}`);
    await expect(page.locator('.payment-confirmation__message')).toContainText('NPR 100');
    await page.getByRole('button', { name: 'Request COD confirmation' }).click();
    await expect(page.getByText('Your COD request is awaiting staff confirmation.', { exact: false })).toBeVisible();
    const opened = await page.evaluate(() => window.__opened);
    for (const url of opened) expect(url).toMatch(/^https:\/\/wa\.me\//);
    expect(reviewCalls).toEqual([]);
    const pending = (await (await request.get(`${API}/guest-checkout/orders/${token}`)).json()).data;
    expect(pending.status).toBe('pending');
    expect(pending.paymentConfirmation).toMatchObject({ method: 'whatsapp_cod', status: 'cod_pending' });
    await page.goto('about:blank');

    const { page: admin, context } = await openStaffQueue(browser, request);
    const row = admin.getByRole('row', { name: new RegExp(order.order_number) });
    await row.getByRole('button', { name: 'Confirm COD' }).click();
    await expect(row).toHaveCount(0);
    await context.close();
    const confirmed = (await (await request.get(`${API}/guest-checkout/orders/${token}`)).json()).data;
    expect(confirmed.paymentConfirmation.status).toBe('cod_confirmed');
    expect(confirmed.status).toBe('processing');
    expect(failures).toEqual([]);
  });

  test('rejected proof shows the staff note to the customer', async ({ page, request, browser }) => {
    const order = await apiCustomerOrder(request, 'customer', 'chetah-iconic');
    const a = await apiLogin(request, 'customer');
    const upload = await request.post(`${API}/orders/${order.id}/payment-proof`, { headers: bearer(a), multipart: { proof: files.validPng } });
    expect(upload.status()).toBe(201);

    const { page: admin, context } = await openStaffQueue(browser, request);
    const row = admin.getByRole('row', { name: new RegExp(order.order_number) });
    await row.getByRole('button', { name: 'Reject' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Reject payment proof' });
    await dialog.getByLabel('Review note (optional)').fill('E2E: the amount is not visible');
    await dialog.getByRole('button', { name: 'Reject proof' }).click();
    await expect(row).toContainText('rejected');
    await context.close();

    const failures = essentialFailures(page);
    await useSession(page, a);
    await page.goto(`/account/orders/${order.id}`);
    await expect(page.getByText('Proof rejected: E2E: the amount is not visible')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit payment proof' })).toBeEnabled();
    expect(failures).toEqual([]);
  });
});
