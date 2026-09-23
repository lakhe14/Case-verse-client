import { expect, test } from '@playwright/test';
import { essentialFailures } from './helpers/monitor.js';
import { API, apiLogin, bearer, notConfigured, uiStaffLogin, useSession } from './helpers/session.js';
import { REPRESENTATIVE, expectNoHorizontalOverflow } from './helpers/viewport.js';
import { json, mockStaffSession, pngBody } from './helpers/mocks.js';

// IDs that do not exist: permission checks run before lookups, so a denied
// call returns 403 and an allowed one 404 — and nothing real is modified.
const MISSING_ID = 999999999;
const PAYMENT_ENDPOINTS = [
  ['GET', '/admin/payment-confirmations'],
  ['GET', `/admin/payment-confirmations/${MISSING_ID}/proof`],
  ['POST', `/admin/payment-confirmations/${MISSING_ID}/approve`],
  ['POST', `/admin/payment-confirmations/${MISSING_ID}/reject`],
];

async function call(request, method, path, headers = {}) {
  const response = await request.fetch(`${API}${path}`, { method, headers, data: method === 'POST' ? {} : undefined });
  return response.status();
}

test.describe('admin route protection', () => {
  test('signed-out visitors are sent to staff sign-in and the API refuses them', async ({ page, request }) => {
    const failures = essentialFailures(page);
    for (const path of ['/admin', '/admin/payment-confirmations', '/admin/orders', '/admin/staff']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { name: 'Staff sign in' })).toBeVisible();
      await expect(page.locator('.admin-main table')).toHaveCount(0);
    }
    for (const [method, path] of [...PAYMENT_ENDPOINTS, ['GET', '/admin/orders'], ['GET', '/admin/staff']]) {
      expect(await call(request, method, path), `${method} ${path}`).toBe(401);
    }
    expect(failures).toEqual([]);
  });

  test('a customer account is denied in the UI and by the API', async ({ page, request }) => {
    const reason = notConfigured('customer');
    test.skip(Boolean(reason), reason);
    const failures = essentialFailures(page);
    const customer = await apiLogin(request, 'customer');
    await useSession(page, customer);
    await page.goto('/admin/payment-confirmations');
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole('heading', { name: 'Payment review' })).toHaveCount(0);
    // Hidden navigation is not authorization: the server must refuse too.
    for (const [method, path] of [...PAYMENT_ENDPOINTS, ['GET', '/admin/orders']]) {
      expect(await call(request, method, path, bearer(customer)), `${method} ${path}`).toBe(403);
    }
    expect(failures).toEqual([]);
  });

  test('authorized staff reach the dashboard and payment queue', async ({ page, request }) => {
    const reason = notConfigured('staff');
    test.skip(Boolean(reason), reason);
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.desktop);
    await uiStaffLogin(page, 'staff', '/admin/payment-confirmations');
    await expect(page).toHaveURL(/\/admin\/payment-confirmations$/);
    await expect(page.getByRole('heading', { name: 'Payment review' })).toBeVisible();
    await expect(page.locator('table.data')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Payment review' }).first()).toBeAttached();

    const staff = await apiLogin(request, 'staff');
    expect(await call(request, 'GET', '/admin/payment-confirmations', bearer(staff))).toBe(200);
    // Permission granted, record missing: proves the guard passed without modifying data.
    expect(await call(request, 'POST', `/admin/payment-confirmations/${MISSING_ID}/approve`, bearer(staff))).toBe(404);
    expect(await call(request, 'GET', `/admin/payment-confirmations/${MISSING_ID}/proof`, bearer(staff))).toBe(404);
    expect(failures).toEqual([]);
  });
});

test.describe('admin permissions', () => {
  test('staff without manage_order_payments cannot see or use payment review', async ({ page, request }) => {
    const reason = notConfigured('limitedStaff');
    test.skip(Boolean(reason), reason);
    const failures = essentialFailures(page);
    const limited = await apiLogin(request, 'limitedStaff');
    expect(limited.profile.permissions).not.toContain('manage_order_payments');

    let queueRequests = 0;
    page.on('request', (r) => { if (r.url().includes('/api/admin/payment-confirmations')) queueRequests += 1; });
    await uiStaffLogin(page, 'limitedStaff', '/admin/payment-confirmations');
    await expect(page.getByText('You don\'t have the “manage_order_payments” permission.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Payment review' })).toHaveCount(0);
    expect(queueRequests).toBe(0);

    for (const [method, path] of PAYMENT_ENDPOINTS) {
      expect(await call(request, method, path, bearer(limited)), `${method} ${path}`).toBe(403);
    }
    expect(failures).toEqual([]);
  });
});

test.describe('admin payment queue (synthetic data)', () => {
  const rows = [
    { id: 990701, method: 'advance_qr', status: 'proof_uploaded', advance_amount: '100.00', proof_filename: 'qa.png', updated_at: '2026-01-01T00:00:00.000Z', order: { order_number: 'QA-E2E-0101', guest_name: 'QA Guest' } },
    { id: 990702, method: 'whatsapp_cod', status: 'cod_pending', advance_amount: '100.00', proof_filename: null, updated_at: '2026-01-01T00:00:00.000Z', order: { order_number: 'QA-E2E-0102', user: { name: 'QA Customer' } } },
  ];

  async function mountQueue(page) {
    const actions = [];
    await mockStaffSession(page, ['manage_order_payments']);
    await page.route('**/api/admin/payment-confirmations', (route) => json(route, { data: rows }));
    await page.route('**/api/admin/payment-confirmations/*/proof', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: pngBody }));
    await page.route(/\/api\/admin\/payment-confirmations\/\d+\/(approve|reject)$/, (route) => {
      actions.push({ url: route.request().url(), body: route.request().postDataJSON() });
      return json(route, { data: {} });
    });
    await page.goto('/admin/payment-confirmations');
    await expect(page.getByRole('heading', { name: 'Payment review' })).toBeVisible();
    return actions;
  }

  test('queue shows statuses, protected proof preview, and single approve/reject actions', async ({ page }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.desktop);
    const actions = await mountQueue(page);
    const proofRow = page.getByRole('row', { name: /QA-E2E-0101/ });
    const codRow = page.getByRole('row', { name: /QA-E2E-0102/ });
    await expect(proofRow).toContainText('proof_uploaded');
    await expect(proofRow).toContainText('eSewa advance');
    await expect(codRow).toContainText('cod_pending');
    await expect(codRow.getByRole('button', { name: 'Confirm COD' })).toBeVisible();
    await expect(codRow.getByRole('button', { name: 'Reject' })).toHaveCount(0);

    // The proof is fetched with the staff token and shown from a blob URL, never a public path.
    const proofRequest = page.waitForRequest((r) => r.url().endsWith('/payment-confirmations/990701/proof'));
    await proofRow.getByRole('button', { name: 'View proof' }).click();
    expect((await proofRequest).headers().authorization).toMatch(/^Bearer /);
    const preview = page.getByRole('dialog', { name: 'Payment proof preview' });
    await expect(preview.locator('img')).toHaveAttribute('src', /^blob:/);
    await preview.click();
    await expect(preview).toHaveCount(0);

    await proofRow.getByRole('button', { name: 'Approve' }).click();
    await expect.poll(() => actions.length).toBe(1);
    expect(actions[0].url).toMatch(/\/990701\/approve$/);

    await proofRow.getByRole('button', { name: 'Reject' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reject payment proof' });
    await dialog.getByLabel('Review note (optional)').fill('QA synthetic rejection note');
    await dialog.getByRole('button', { name: 'Reject proof' }).click();
    await expect(dialog).toHaveCount(0);
    expect(actions).toHaveLength(2);
    expect(actions[1]).toMatchObject({ body: { note: 'QA synthetic rejection note' } });
    expect(actions[1].url).toMatch(/\/990701\/reject$/);
    expect(failures).toEqual([]);
  });

  test('admin layout fits a phone and a tablet', async ({ page }) => {
    const failures = essentialFailures(page);
    for (const viewport of [REPRESENTATIVE.mobile, REPRESENTATIVE.tablet]) {
      await page.setViewportSize(viewport);
      await mountQueue(page);
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await expect(page.locator('.admin-side')).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }
    expect(failures).toEqual([]);
  });
});
