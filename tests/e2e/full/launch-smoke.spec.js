/**
 * Launch gate: every critical storefront and admin route renders at phone,
 * large-phone, tablet and laptop widths with no horizontal overflow, no
 * console or network errors, and no unlabelled form fields or nameless
 * buttons. Real isolated E2E backend; tokens stay in memory.
 */
import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { essentialFailures, expectNoLeakedInternals } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';
import { expectNoHorizontalOverflow } from '../helpers/viewport.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
];

/** Visible form controls without an accessible name, and nameless buttons. */
async function unlabelled(page) {
  return page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    const named = (el) => Boolean(
      el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')
      || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label')
      || (el.tagName === 'BUTTON' && el.textContent.trim())
      || (el.getAttribute('placeholder') && el.tagName !== 'BUTTON'),
    );
    return [...document.querySelectorAll('input:not([type=hidden]), select, textarea, button')]
      .filter((el) => visible(el) && !named(el))
      .map((el) => `${el.tagName.toLowerCase()}${el.name ? `[name=${el.name}]` : ''}${el.type ? `[type=${el.type}]` : ''}`);
  });
}

async function guestOrderToken(request) {
  const { data } = await (await request.get(`${API}/products/glossy-white`)).json();
  const res = await request.post(`${API}/guest-checkout/orders`, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    data: { items: [{ variant_id: data.variants[0].id, quantity: 1 }], guest: { name: 'E2E launch smoke', phone: '9800000017', province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu', area: 'E2E lane', notes: `${process.env.E2E_RUN_ID} launch-smoke`, parcelmoover_destination_id: 'e2e-kathmandu' } },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).guest_token;
}

async function visit(page, route, ready) {
  await page.goto(route);
  await expect(ready(page)).toBeVisible();
  // Elements poking past the viewport that no ancestor clips (decorative
  // layers inside overflow:hidden containers do not widen the page).
  const overflow = () => page.evaluate(() => {
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) return true;
      }
      return false;
    };
    return [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed' && !clipped(el))
      .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
  });
  await expect.poll(overflow, { message: `${route}: elements wider than the viewport` }).toEqual([]);
  await expectNoHorizontalOverflow(page);
  expect(await unlabelled(page), `${route}: unlabelled controls`).toEqual([]);
  await expectNoLeakedInternals(page, expect);
}

for (const viewport of VIEWPORTS) {
  test(`critical routes at ${viewport.width}x${viewport.height}`, async ({ browser, request }) => {
    const token = await guestOrderToken(request);
    const customer = await apiLogin(request, 'customer');
    await request.delete(`${API}/cart`, { headers: bearer(customer) });
    const { data: product } = await (await request.get(`${API}/products/chetah-iconic`)).json();
    await request.post(`${API}/cart/items`, { headers: bearer(customer), data: { variant_id: product.variants[0].id, quantity: 1 } });
    const orders = (await (await request.get(`${API}/orders`, { headers: bearer(customer) })).json()).data;

    const contexts = [];
    const open = async (session) => {
      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport });
      contexts.push(context);
      const page = await context.newPage();
      if (session) await useSession(page, session);
      return { page, failures: essentialFailures(page) };
    };

    try {
      // Storefront as a guest.
      const guest = await open(null);
      await visit(guest.page, '/', (p) => p.getByRole('heading').first());
      await visit(guest.page, '/p/chetah-iconic', (p) => p.getByRole('heading', { name: 'Chetah iconic' }));
      await guest.page.evaluate(({ id, name, slug }) => localStorage.setItem('caseverse_guest_cart', JSON.stringify([{ variant_id: id, quantity: 1, unit_price: 699, compare_at_price: 999, stock_quantity: 5, product: { id: 1, name, slug, image: null }, sku: 'x' }])), { id: product.variants[0].id, name: product.name, slug: product.slug });
      await visit(guest.page, '/cart', (p) => p.getByRole('heading', { name: /cart/i }).first());
      await visit(guest.page, '/checkout', (p) => p.getByRole('heading', { name: 'Checkout' }));
      await visit(guest.page, `/order/guest/${token}`, (p) => p.getByText('Upload payment screenshot').first());
      expect(guest.failures).toEqual([]);

      // Signed-in customer.
      const shopper = await open(customer);
      await visit(shopper.page, '/checkout', (p) => p.getByLabel('ParcelMoover delivery destination'));
      await visit(shopper.page, '/account/orders', (p) => p.getByRole('heading', { name: /orders/i }).first());
      if (orders[0]) await visit(shopper.page, `/account/orders/${orders[0].id}`, (p) => p.getByRole('heading', { name: orders[0].order_number }));
      expect(shopper.failures).toEqual([]);

      // Staff: payment queue and orders (Order Manager), inventory (Product Manager).
      const payments = await open(await apiLogin(request, 'staff'));
      await visit(payments.page, '/admin/payment-confirmations', (p) => p.getByRole('heading', { name: 'Payment review' }));
      await visit(payments.page, '/admin/orders', (p) => p.getByRole('heading', { name: /orders/i }).first());
      expect(payments.failures).toEqual([]);
      const inventory = await open(await apiLogin(request, 'limitedStaff'));
      await visit(inventory.page, '/admin/products', (p) => p.getByRole('heading', { name: 'Products' }));
      await visit(inventory.page, `/admin/products/${product.id}`, (p) => p.getByTestId('variant-inventory').first());
      expect(inventory.failures).toEqual([]);
    } finally {
      for (const context of contexts) await context.close();
      await request.delete(`${API}/cart`, { headers: bearer(customer) });
      await request.post(`${API}/guest-checkout/orders/${token}/cancel`);
    }
  });
}

test('a customer can complete checkout with the keyboard alone', async ({ page, request }) => {
  const failures = essentialFailures(page);
  const customer = await apiLogin(request, 'customer');
  await request.delete(`${API}/cart`, { headers: bearer(customer) });
  const { data: product } = await (await request.get(`${API}/products/chetah-iconic`)).json();
  await request.post(`${API}/cart/items`, { headers: bearer(customer), data: { variant_id: product.variants[0].id, quantity: 1 } });
  await useSession(page, customer);
  await page.goto('/checkout');

  const destination = page.getByLabel('ParcelMoover delivery destination');
  await expect(destination).toBeVisible();
  // Reach the destination select by Tab, choose with the keyboard.
  for (let i = 0; i < 40 && !(await destination.evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(destination).toBeFocused();
  await destination.selectOption('e2e-kathmandu'); // keyboard-equivalent choice on a focused native select
  await expect(page.locator('.checkout-summary .summary-total')).toContainText('799');

  const place = page.getByRole('button', { name: 'Place order & continue to payment' });
  for (let i = 0; i < 60 && !(await place.evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(place).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/account\/orders\/\d+$/);
  const orderId = Number(page.url().split('/').pop());
  expect((await request.post(`${API}/orders/${orderId}/cancel`, { headers: bearer(customer) })).status()).toBe(200);
  expect(failures).toEqual([]);
});
