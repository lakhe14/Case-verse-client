/**
 * Phase 2 after-order UX against the real caseverse_e2e backend: public order
 * tracking (every payment/order state the backend has), the guest and
 * account links into it, and the staff-only invoice and parcel label.
 * Order states are driven through the real staff API; payment timeout uses
 * the server's guarded E2E clock helper. Tokens stay in memory.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { essentialFailures } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';
import { expectNoHorizontalOverflow } from '../helpers/viewport.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const RUN_ID = process.env.E2E_RUN_ID;
const TRACKING_SLUG = 'e2e-tracking-fixture';
const PHONE = '9800000017';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const npr = (value) => `NPR ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function variantId(request, slug, model) {
  const { data } = await (await request.get(`${API}/products/${slug}`)).json();
  return (model ? data.variants.find((v) => v.attributes.some((a) => a.value === model)) : data.variants[0]).id;
}

async function guestOrder(request, label, items) {
  const response = await request.post(`${API}/guest-checkout/orders`, {
    // A separate shopper (TEST-NET-3 address; the API trusts one proxy hop), so
    // these orders do not spend the per-IP guest-order budget other suites use.
    headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-Forwarded-For': `203.0.113.${1 + crypto.randomInt(250)}` },
    data: {
      // Own fixture product: these orders stay shipped/approved until teardown.
      items: items || [{ variant_id: await variantId(request, TRACKING_SLUG), quantity: 1 }],
      guest: { name: `E2E ${label}`, phone: PHONE, province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu', area: 'E2E after-order lane', landmark: 'Blue gate', notes: `${RUN_ID} ${label}`, parcelmoover_destination_id: 'e2e-kathmandu' },
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return { order: body.data, token: body.guest_token };
}

/**
 * Most orders here are signed-in customer orders: the guest-order endpoint is
 * rate-limited per IP (20 per 15 minutes) and the other suites need that
 * budget. Customer B's delivery phone is the tracker's second factor.
 */
async function customerOrder(request, items) {
  const session = await apiLogin(request, 'customerB');
  await request.delete(`${API}/cart`, { headers: bearer(session) });
  for (const item of items || [{ variant_id: await variantId(request, TRACKING_SLUG), quantity: 1 }]) {
    expect((await request.post(`${API}/cart/items`, { headers: bearer(session), data: item })).status()).toBe(201);
  }
  const address = (await (await request.get(`${API}/addresses`, { headers: bearer(session) })).json()).data[0];
  const placed = await request.post(`${API}/orders`, { headers: bearer(session), data: { shipping_address_id: address.id, parcelmoover_destination_id: 'e2e-kathmandu' } });
  expect(placed.status()).toBe(201);
  return { order: (await placed.json()).data, session, phone: address.phone, address };
}
const customerProof = (request, { order, session }) => request.post(`${API}/orders/${order.id}/payment-proof`, { headers: bearer(session), multipart: { proof: { name: 'p.png', mimeType: 'image/png', buffer: PNG } } });
const customerCod = (request, { order, session }) => request.post(`${API}/orders/${order.id}/payment-method/cod`, { headers: bearer(session) });

async function paymentId(request, orderId) {
  const staff = await apiLogin(request, 'staff');
  return (await (await request.get(`${API}/admin/orders/${orderId}`, { headers: bearer(staff) })).json()).data.paymentConfirmation.id;
}
async function review(request, orderId, action, note) {
  const staff = await apiLogin(request, 'staff');
  const res = await request.post(`${API}/admin/payment-confirmations/${await paymentId(request, orderId)}/${action}`, { headers: bearer(staff), data: note ? { note } : {} });
  expect(res.status()).toBe(200);
}
async function setStatus(request, orderId, status, note) {
  const staff = await apiLogin(request, 'staff');
  expect((await request.put(`${API}/admin/orders/${orderId}/status`, { headers: bearer(staff), data: { status, note } })).status()).toBe(200);
}
function expireOrder(orderId) {
  const result = spawnSync(process.execPath, [path.join(process.env.E2E_SERVER_DIR, 'scripts', 'e2e', 'expireOrder.js'), `--order-id=${orderId}`], {
    cwd: process.env.E2E_SERVER_DIR,
    env: { ...process.env, NODE_ENV: 'e2e', E2E_ALLOW_DB_MUTATION: 'true' },
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
}

async function track(page, orderNumber, phone = PHONE) {
  await page.goto('/track-order');
  await page.getByLabel('Order ID').fill(orderNumber.toLowerCase());
  await page.getByLabel('Phone number').fill(phone);
  await page.getByRole('button', { name: 'Track order' }).click();
}

const status = (page) => page.getByTestId('track-result').getByTestId('order-status');
const timelineLabels = async (page) => (await page.getByTestId('track-result').locator('.order-timeline-label').allInnerTexts()).map((t) => t.trim());

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1366, height: 768 }]) {
  test.describe(`public tracking (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('a guest finds their order with order ID + phone in any common format', async ({ page, request }) => {
      const failures = essentialFailures(page);
      const { order, phone, address } = await customerOrder(request);
      await track(page, order.order_number, `+977 ${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`);
      const result = page.getByTestId('track-result');
      await expect(result.getByTestId('order-number')).toHaveText(order.order_number);
      await expect(status(page)).toHaveAttribute('data-kind', 'payment_pending');
      await expect(status(page)).toContainText('Waiting for your payment');
      expect(await timelineLabels(page)).toEqual(['Order received', 'Payment pending', 'Processing', 'Shipped', 'Delivered']);
      await expect(result.getByTestId('order-due')).toContainText(npr(order.total_amount));
      await expect(result).toContainText('iPhone 12');
      // Summary only: the area, not the street or phone.
      await expect(result).toContainText(address.city);
      const text = await result.innerText();
      for (const hidden of [address.line1, phone]) expect(text).not.toContain(hidden);
      const box = await page.getByRole('button', { name: 'Track order' }).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalOverflow(page);
      expect(failures).toEqual([]);
    });
  });
}

test('tracking errors: invalid input, verification failure, rate limit and server trouble are told apart', async ({ page, request }) => {
  const failures = essentialFailures(page, { allow: [{ url: /\/api\/order-tracking$/, status: 404 }, { url: /\/api\/order-tracking$/, status: 429 }, { url: /\/api\/order-tracking$/, status: 500 }] });
  const { order, phone } = await customerOrder(request);
  const lookups = [];
  page.on('request', (r) => { if (r.url().endsWith('/api/order-tracking')) lookups.push(r.postDataJSON()); });

  // Malformed input never reaches the server.
  await track(page, '12345', phone);
  await expect(page.locator('#track-order-id-error')).toBeVisible();
  expect(lookups).toHaveLength(0);

  await track(page, order.order_number, '9811111111');
  const error = page.getByTestId('track-error');
  await expect(error).toHaveAttribute('data-kind', 'not_found');
  const wrongPhoneText = await error.innerText();
  await track(page, 'CV-20260101-ZZZZZZ', phone);
  await expect(error).toHaveAttribute('data-kind', 'not_found');
  expect(await error.innerText()).toBe(wrongPhoneText); // same answer: existence is never revealed
  expect(lookups.every((body) => !JSON.stringify(body).includes('token'))).toBe(true);

  await page.route('**/api/order-tracking', (route) => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Too many requests. Please try again later.', code: 'rate_limited' } }) }));
  await track(page, order.order_number, phone);
  await expect(error).toHaveAttribute('data-kind', 'rate_limited');
  await page.unroute('**/api/order-tracking');
  await page.route('**/api/order-tracking', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Something went wrong', code: 'internal_error' } }) }));
  await track(page, order.order_number, phone);
  await expect(error).toHaveAttribute('data-kind', 'server');
  await expect(error).not.toContainText('internal_error');
  expect(failures).toEqual([]);
});

test('every payment and order state reads correctly on the tracker', async ({ page, request }) => {
  test.setTimeout(120_000);
  const failures = essentialFailures(page);
  let phone;
  const check = async (order, kind, labels, extra) => {
    await track(page, order.order_number, phone);
    await expect(status(page)).toHaveAttribute('data-kind', kind);
    if (labels) expect(await timelineLabels(page)).toEqual(labels);
    if (extra) await extra();
  };

  const proofed = await customerOrder(request);
  phone = proofed.phone;
  expect((await customerProof(request, proofed)).status()).toBe(201);
  await check(proofed.order, 'proof_uploaded', ['Order received', 'Proof uploaded', 'Processing', 'Shipped', 'Delivered']);

  await review(request, proofed.order.id, 'reject', 'Screenshot was cropped');
  await check(proofed.order, 'proof_rejected', null, async () => {
    await expect(status(page)).toContainText('Payment proof rejected');
    await expect(status(page)).toContainText('Screenshot was cropped');
  });

  expect((await customerProof(request, proofed)).status()).toBe(201);
  await review(request, proofed.order.id, 'approve', 'E2E internal: matched eSewa ref 4411');
  await check(proofed.order, 'processing', ['Order received', 'Payment approved', 'Processing', 'Shipped', 'Delivered'], async () => {
    await expect(page.getByTestId('order-due')).toContainText(npr(Number(proofed.order.total_amount) - 100));
    await expect(page.getByTestId('track-result')).not.toContainText('E2E internal');
  });

  await setStatus(request, proofed.order.id, 'shipped', 'E2E staff-only rider note');
  await check(proofed.order, 'shipped', null, async () => {
    await expect(page.getByTestId('track-result')).not.toContainText('staff-only');
  });
  await setStatus(request, proofed.order.id, 'delivered');
  await check(proofed.order, 'delivered', ['Order received', 'Payment approved', 'Processing', 'Shipped', 'Delivered']);

  const cod = await customerOrder(request);
  expect((await customerCod(request, cod)).status()).toBe(200);
  await check(cod.order, 'cod_pending', ['Order received', 'COD pending', 'Processing', 'Shipped', 'Delivered']);
  await review(request, cod.order.id, 'approve');
  await check(cod.order, 'processing', ['Order received', 'COD confirmed', 'Processing', 'Shipped', 'Delivered'], async () => {
    await expect(page.getByTestId('order-due')).toContainText(npr(cod.order.total_amount));
  });

  const cancelled = await customerOrder(request);
  expect((await request.post(`${API}/orders/${cancelled.order.id}/cancel`, { headers: bearer(cancelled.session) })).status()).toBe(200);
  await check(cancelled.order, 'cancelled', null, async () => {
    await expect(page.getByTestId('order-cancelled')).toContainText('You cancelled this order.');
  });

  const lapsed = await customerOrder(request);
  expireOrder(lapsed.order.id);
  await check(lapsed.order, 'payment_timeout', null, async () => {
    await expect(page.getByTestId('track-result').locator('.badge')).toHaveText('Payment expired');
    await expect(page.getByTestId('order-cancelled')).toContainText('Payment was not confirmed in time');
  });
  expect(failures).toEqual([]);
});

test('the guest order link still works and links to tracking with the order ID prefilled', async ({ page, request }) => {
  const failures = essentialFailures(page);
  const { order, token } = await guestOrder(request, 'guest-link');
  await page.goto(`/order/guest/${token}`);
  await expect(page.getByTestId('order-number')).toHaveText(order.order_number);
  await expect(page.getByTestId('order-status')).toHaveAttribute('data-kind', 'payment_pending');
  await expect(page.getByRole('button', { name: 'Submit payment proof' })).toBeVisible();
  await expect(page.getByText('E2E after-order lane', { exact: false })).toBeVisible(); // the owner sees the full address
  await page.getByTestId('track-order-link').click();
  await expect(page).toHaveURL(new RegExp(`/track-order\\?order=${order.order_number}$`));
  expect(page.url()).not.toContain(token);
  await expect(page.getByLabel('Order ID')).toHaveValue(order.order_number);
  await expect(page.getByLabel('Phone number')).toBeFocused();
  await page.getByLabel('Phone number').fill(PHONE);
  await page.getByRole('button', { name: 'Track order' }).click();
  await expect(page.getByTestId('track-result')).toBeVisible();
  expect(failures).toEqual([]);
});

test('a signed-in customer order page keeps working and links to tracking', async ({ page, request }) => {
  const failures = essentialFailures(page);
  const session = await apiLogin(request, 'customer');
  await request.delete(`${API}/cart`, { headers: bearer(session) });
  expect((await request.post(`${API}/cart/items`, { headers: bearer(session), data: { variant_id: await variantId(request, 'chetah-iconic', 'iPhone 14'), quantity: 1 } })).status()).toBe(201);
  const address = (await (await request.get(`${API}/addresses`, { headers: bearer(session) })).json()).data[0];
  const placed = await request.post(`${API}/orders`, { headers: bearer(session), data: { shipping_address_id: address.id, parcelmoover_destination_id: 'e2e-kathmandu' } });
  expect(placed.status()).toBe(201);
  const order = (await placed.json()).data;
  try {
    await useSession(page, session);
    await page.goto(`/account/orders/${order.id}`);
    await expect(page.getByTestId('order-number')).toHaveText(order.order_number);
    await expect(page.getByTestId('order-status')).toHaveAttribute('data-kind', 'payment_pending');
    await expect(page.getByText('iPhone 14').first()).toBeVisible();
    await page.getByTestId('track-order-link').click();
    await page.getByLabel('Phone number').fill(address.phone);
    await page.getByRole('button', { name: 'Track order' }).click();
    await expect(page.getByTestId('track-result').getByTestId('order-number')).toHaveText(order.order_number);
  } finally {
    await request.post(`${API}/orders/${order.id}/cancel`, { headers: bearer(session) });
  }
  expect(failures).toEqual([]);
});

test.describe('staff print views', () => {
  test('invoice and label need a staff session with manage_orders', async ({ browser, request }) => {
    const { order } = await customerOrder(request);
    for (const view of ['invoice', 'label']) {
      const anon = await browser.newPage();
      await anon.goto(`/admin/print/orders/${order.id}/${view}`);
      await expect(anon).toHaveURL(/\/admin\/login$/);
      await expect(anon.getByTestId(`print-${view}`)).toHaveCount(0);
      await anon.close();

      const customer = await browser.newPage();
      await useSession(customer, await apiLogin(request, 'customer'));
      await customer.goto(`/admin/print/orders/${order.id}/${view}`);
      await expect(customer).toHaveURL(/\/account/);
      await customer.close();

      const limited = await browser.newPage();
      await useSession(limited, await apiLogin(request, 'limitedStaff'));
      await limited.goto(`/admin/print/orders/${order.id}/${view}`);
      await expect(limited.getByText('permission')).toBeVisible();
      await expect(limited.getByTestId(`print-${view}`)).toHaveCount(0);
      await limited.close();
    }
  });

  test('the invoice shows the order snapshot: lines, bundle discount, shipping, advance and remaining COD', async ({ page, request }) => {
    const campaign = (await (await request.get(`${API}/campaign/dashain`)).json()).data;
    // Two covers of one model: one line, and a Dashain pair while the campaign runs.
    const placed = await customerOrder(request, [{ variant_id: await variantId(request, TRACKING_SLUG), quantity: 2 }]);
    const { order, address } = placed;
    expect((await customerProof(request, placed)).status()).toBe(201);
    await review(request, order.id, 'approve');
    const staff = await apiLogin(request, 'staff');
    const snapshot = (await (await request.get(`${API}/admin/orders/${order.id}`, { headers: bearer(staff) })).json()).data;

    await useSession(page, staff);
    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByRole('link', { name: 'Print invoice' })).toHaveAttribute('href', `/admin/print/orders/${order.id}/invoice`);
    await page.goto(`/admin/print/orders/${order.id}/invoice`);
    const invoice = page.getByTestId('print-invoice');
    await expect(invoice.getByTestId('invoice-number')).toHaveText(order.order_number);
    await expect(invoice.getByTestId('invoice-line')).toHaveCount(1);
    await expect(invoice.getByTestId('invoice-line')).toContainText(npr(1398));
    for (const item of snapshot.items) {
      const line = invoice.getByTestId('invoice-line').filter({ hasText: item.model });
      await expect(line).toContainText(item.product_name_snap);
      await expect(line).toContainText(npr(item.unit_price));
      await expect(line).toContainText(npr(item.line_total));
    }
    const totals = invoice.getByTestId('invoice-totals');
    await expect(totals).toContainText(npr(snapshot.subtotal_amount));
    await expect(totals).toContainText(npr(snapshot.shipping_amount));
    await expect(invoice.getByTestId('invoice-total')).toHaveText(npr(snapshot.total_amount));
    if (campaign?.active) {
      expect(Number(snapshot.bundle_discount_amount)).toBe(199);
      await expect(totals).toContainText(`−${npr(199)}`);
      await expect(invoice).toContainText('FREE');
    }
    await expect(invoice.getByTestId('invoice-advance')).toHaveText(npr(100));
    await expect(invoice.getByTestId('invoice-remaining')).toHaveText(npr(Number(snapshot.total_amount) - 100));
    await expect(invoice).toContainText(address.line1);
    await expect(invoice).toContainText(address.phone);

    // A4 print: the toolbar disappears, the page rule is A4 and nothing is clipped horizontally.
    expect(await page.locator('style').allInnerTexts()).toContain('@page { size: A4; margin: 14mm; }');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-toolbar')).toBeHidden();
    expect(await invoice.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.emulateMedia({ media: 'screen' });
  });

  test('the parcel label shows recipient, destination and the cash to collect, without courier ids', async ({ page, request }) => {
    const { order, token } = await guestOrder(request, 'print-label');
    expect((await request.post(`${API}/guest-checkout/orders/${token}/payment-method/cod`)).status()).toBe(200);
    await review(request, order.id, 'approve');
    await useSession(page, await apiLogin(request, 'staff'));
    await page.goto(`/admin/print/orders/${order.id}/label`);
    const label = page.getByTestId('print-label');
    await expect(label.getByTestId('label-ref')).toHaveText(order.order_number);
    await expect(label).toContainText('CaseVerse order reference');
    await expect(label).toContainText('not a courier label');
    await expect(label).toContainText(PHONE);
    await expect(label).toContainText('District: Kathmandu');
    await expect(label).toContainText('Landmark: Blue gate');
    await expect(label).toContainText('ParcelMoover destination');
    await expect(label.getByTestId('label-cod')).toContainText(npr(order.total_amount));
    await expect(label).not.toContainText(/kg\b/);
    expect(await page.locator('style').allInnerTexts()).toContain('@page { size: 105mm 148mm; margin: 4mm; }');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.print-toolbar')).toBeHidden();
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });
});
