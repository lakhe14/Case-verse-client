import { expect, test } from '@playwright/test';
import { essentialFailures, expectNoLeakedInternals } from './helpers/monitor.js';
import { REPRESENTATIVE } from './helpers/viewport.js';
import {
  SYNTHETIC_GUEST_TOKEN, SYNTHETIC_ORDER_ID, delay, files, json, mockCustomerSession, serverError, syntheticOrder,
} from './helpers/mocks.js';

// Backend payment lifecycle (real proof storage, review state transitions) is
// NOT TESTED here: there is no disposable QA order to attach a proof to. These
// tests drive the real UI against intercepted, synthetic order endpoints.

/** Serves a synthetic guest order whose payment status the test can change. */
async function mountGuestOrder(page, { onProof, onCod } = {}) {
  const state = { status: 'pending', proofRequests: [], codRequests: 0 };
  await page.route(`**/api/guest-checkout/orders/${SYNTHETIC_GUEST_TOKEN}`, (route) => json(route, { data: syntheticOrder({ guest: true, paymentStatus: state.status }) }));
  await page.route(`**/api/guest-checkout/orders/${SYNTHETIC_GUEST_TOKEN}/payment-proof`, async (route) => {
    state.proofRequests.push(route.request().postDataBuffer());
    if (onProof) return onProof(route, state);
    state.status = 'proof_uploaded';
    return json(route, { data: { status: 'proof_uploaded' } });
  });
  await page.route(`**/api/guest-checkout/orders/${SYNTHETIC_GUEST_TOKEN}/payment-method/cod`, async (route) => {
    state.codRequests += 1;
    if (onCod) return onCod(route, state);
    state.status = 'cod_pending';
    return json(route, { data: { status: 'cod_pending' } });
  });
  await page.goto(`/order/guest/${SYNTHETIC_GUEST_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Confirm your order' })).toBeVisible();
  return state;
}

const proofInput = (page) => page.locator('input[type="file"].upload-dropzone__input');
const submitButton = (page) => page.getByRole('button', { name: /Submit payment proof|Submitting…|Proof submitted/ });

test.describe('payment proof upload', () => {
  test('valid PNG uploads once, disables submit while sending, then shows success', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.mobile);
    const state = await mountGuestOrder(page, {
      onProof: async (route, current) => {
        await delay(800);
        current.status = 'proof_uploaded';
        return json(route, { data: { status: 'proof_uploaded' } });
      },
    });
    await expect(page.locator('.payment-amount')).toContainText('100.00');
    await proofInput(page).setInputFiles(files.validPng);
    await expect(page.locator('.upload-dropzone__filename')).toHaveText('qa-payment-proof.png');
    await submitButton(page).click();
    await expect(submitButton(page)).toHaveText('Submitting…');
    await expect(submitButton(page)).toBeDisabled();
    await submitButton(page).click({ force: true }).catch(() => {});
    await expect(page.getByText('Proof submitted').first()).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();
    expect(state.proofRequests).toHaveLength(1);
    expect(state.proofRequests[0].toString('latin1')).toContain('name="proof"; filename="qa-payment-proof.png"');
    expect(failures).toEqual([]);
  });

  test('unsupported and oversized files are rejected before any request', async ({ page }) => {
    const failures = essentialFailures(page);
    const state = await mountGuestOrder(page);
    for (const file of [files.unsupported, files.oversized]) {
      await proofInput(page).setInputFiles(file);
      await expect(page.locator('.payment-confirmation .alert.error')).toHaveText('Choose a JPG, PNG, or WebP image up to 5 MB.');
      await expect(page.locator('.upload-dropzone__filename')).toHaveCount(0);
    }
    await submitButton(page).click();
    await expect(page.locator('.payment-confirmation .alert.error')).toHaveText('Select your payment screenshot before submitting.');
    expect(state.proofRequests).toHaveLength(0);
    expect(failures).toEqual([]);
  });

  test('a failed upload keeps the file and can be retried', async ({ page }) => {
    const failures = essentialFailures(page, { allow: [{ url: /\/payment-proof$/, network: true, status: 500 }] });
    let attempt = 0;
    const state = await mountGuestOrder(page, {
      onProof: async (route, current) => {
        attempt += 1;
        if (attempt === 1) return route.abort('failed');
        if (attempt === 2) return serverError(route);
        current.status = 'proof_uploaded';
        return json(route, { data: { status: 'proof_uploaded' } });
      },
    });
    await proofInput(page).setInputFiles(files.validPng);

    await submitButton(page).click();
    await expect(page.locator('.payment-confirmation .alert.error')).toBeVisible();
    await expect(page.locator('.upload-dropzone__filename')).toHaveText('qa-payment-proof.png');
    await expect(submitButton(page)).toBeEnabled();

    await submitButton(page).click();
    await expect(page.locator('.payment-confirmation .alert.error')).toHaveText('Something went wrong');
    await expectNoLeakedInternals(page, expect);

    await submitButton(page).click();
    await expect(page.getByText('Proof submitted').first()).toBeVisible();
    expect(state.proofRequests).toHaveLength(3);
    expect(failures).toEqual([]);
  });

  test('signed-in customer order page uploads to the customer endpoint', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.desktop);
    await mockCustomerSession(page);
    let status = 'pending';
    const customerProofs = [];
    await page.route(`**/api/orders/${SYNTHETIC_ORDER_ID}`, (route) => json(route, { data: syntheticOrder({ paymentStatus: status }) }));
    await page.route(`**/api/orders/${SYNTHETIC_ORDER_ID}/payment-proof`, (route) => {
      customerProofs.push(route.request().url());
      status = 'proof_uploaded';
      return json(route, { data: { status } });
    });
    await page.route('**/api/guest-checkout/**', (route) => route.abort('blockedbyclient'));
    await page.goto(`/account/orders/${SYNTHETIC_ORDER_ID}`);
    await proofInput(page).setInputFiles(files.validPng);
    await submitButton(page).click();
    await expect(page.getByText('Proof submitted').first()).toBeVisible();
    expect(customerProofs).toHaveLength(1);
    expect(failures).toEqual([]);
  });
});

test.describe('cash on delivery', () => {
  test('WhatsApp COD is only a request and stays pending until staff confirm', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.addInitScript(() => {
      window.__qaOpened = [];
      window.open = (url) => { window.__qaOpened.push(String(url)); return null; };
    });
    const adminCalls = [];
    page.on('request', (request) => { if (/\/api\/admin\//.test(request.url())) adminCalls.push(request.url()); });
    const state = await mountGuestOrder(page);

    // Normal path: NPR 100 eSewa advance.
    await expect(page.locator('.payment-confirmation__message')).toContainText('NPR 100');
    await expect(page.getByRole('button', { name: 'Request COD confirmation' })).toBeVisible();

    await page.getByRole('button', { name: 'Request COD confirmation' }).click();
    await expect(page.getByText('Your COD request is awaiting staff confirmation. Opening WhatsApp alone does not confirm an order.')).toBeVisible();
    await expect(page.locator('.payment-confirmation__head .badge')).toHaveText('COD pending');
    await expect(page.getByText('COD confirmed')).toHaveCount(0);
    await expect(page.getByText('Your payment confirmation has been verified.')).toHaveCount(0);
    expect(state.codRequests).toBe(1);
    expect(state.status).toBe('cod_pending');
    expect(adminCalls).toEqual([]);

    // When WhatsApp is configured it only opens a pre-filled chat.
    const opened = await page.evaluate(() => window.__qaOpened);
    for (const url of opened) expect(url).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(opened.length).toBeLessThanOrEqual(1);

    // A later reload still shows the pending request, not a confirmation.
    await page.reload();
    await expect(page.getByText('Your COD request is awaiting staff confirmation.', { exact: false })).toBeVisible();
    expect(failures).toEqual([]);
  });
});
