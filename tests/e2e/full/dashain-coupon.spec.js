/**
 * Coupon availability follows the server's coupon_allowed, which is false only
 * while a Dashain pair is priced into the order: one cover takes a coupon
 * during the campaign, a bundle does not, and the page moves between the two
 * without a stale discount. Real caseverse_e2e backend; the only simulated
 * case is "campaign inactive" (F), because the fixed window cannot be moved.
 */
import { expect, test } from '@playwright/test';
import { essentialFailures, expectNoLeakedInternals } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';
import { expectNoHorizontalOverflow } from '../helpers/viewport.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const CODE = 'E2EUSERONCE';
const BLOCKED = 'Coupons can’t be combined with the Dashain Trio Offer.';
const REMOVED = 'Your coupon was removed because the Dashain Trio Offer is now applied.';
const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

async function variantOf(request, slug, model) {
  const { data } = await (await request.get(`${API}/products/${slug}`)).json();
  const variant = model ? data.variants.find((v) => v.attributes.some((a) => a.value === model)) : data.variants[0];
  return { ...variant, product: { id: data.id, name: data.name, slug: data.slug, image: data.images?.[0]?.url || null } };
}

async function setCart(request, session, variants) {
  await request.delete(`${API}/cart`, { headers: bearer(session) });
  for (const v of variants) expect((await request.post(`${API}/cart/items`, { headers: bearer(session), data: { variant_id: v.id, quantity: 1 } })).status()).toBe(201);
}

async function openCheckout(page) {
  await page.goto('/checkout');
  await page.getByLabel('ParcelMoover delivery destination').selectOption('e2e-kathmandu');
}

const total = (page) => page.locator('.checkout-summary .summary-total');
const couponInput = (page) => page.getByPlaceholder('Coupon code');

let campaignActive = false;
test.beforeAll(async ({ request }) => {
  campaignActive = Boolean((await (await request.get(`${API}/campaign/dashain`)).json()).data?.active);
});

for (const viewport of VIEWPORTS) {
  test.describe(`Dashain coupons (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('A-D: one cover takes a coupon; a bundle removes it with a note; back to one cover the field returns empty', async ({ page, request }) => {
      test.skip(!campaignActive, 'The Dashain window is not open on this date.');
      const failures = essentialFailures(page, { allow: [{ url: /\/api\/orders\/preview$/, status: 400 }] });
      const session = await apiLogin(request, 'customerB');
      const first = await variantOf(request, 'glossy-white');
      const second = await variantOf(request, 'chetah-iconic', 'iPhone 14');
      await setCart(request, session, [first]);
      await useSession(page, session);

      // A/B: one cover during the campaign: field visible, coupon applies.
      await openCheckout(page);
      await expect(total(page)).toContainText('799');
      await expect(couponInput(page)).toBeVisible();
      await expect(page.getByTestId('coupon-blocked')).toHaveCount(0);
      await couponInput(page).fill(CODE);
      await page.getByRole('button', { name: 'Apply' }).click();
      await expect(page.getByText(`“${CODE}” applied`)).toBeVisible();
      await expect(total(page)).toContainText('749');
      await expectNoHorizontalOverflow(page);

      // C: the cart becomes a bundle (edited elsewhere, then back to checkout).
      await setCart(request, session, [first, second]);
      await openCheckout(page);
      await expect(page.getByTestId('coupon-notice')).toHaveText(REMOVED);
      await expect(page.getByTestId('coupon-blocked')).toHaveText(BLOCKED);
      await expect(couponInput(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0);
      await expect(total(page)).toContainText('1,299');
      await expect(page.locator('.checkout-summary')).not.toContainText(/Coupon\s*−/);
      await expect(page.getByText(`“${CODE}” applied`)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);

      // D: back to one cover: the field returns, the coupon is not restored.
      await setCart(request, session, [first]);
      await openCheckout(page);
      await expect(couponInput(page)).toBeVisible();
      await expect(couponInput(page)).toHaveValue('');
      await expect(page.getByTestId('coupon-blocked')).toHaveCount(0);
      await expect(total(page)).toContainText('799');
      await expect(page.getByText(`“${CODE}” applied`)).toHaveCount(0);

      await expectNoLeakedInternals(page, expect);
      await request.delete(`${API}/cart`, { headers: bearer(session) });
      expect(failures).toEqual([]);
    });

    test('E: a bundle from the start never offers a coupon field, before or after pricing', async ({ page, request }) => {
      test.skip(!campaignActive, 'The Dashain window is not open on this date.');
      const failures = essentialFailures(page);
      const session = await apiLogin(request, 'customerB');
      await setCart(request, session, [await variantOf(request, 'glossy-white'), await variantOf(request, 'chetah-iconic', 'iPhone 14')]);
      await useSession(page, session);
      await page.goto('/checkout');
      // Before a destination is chosen the cart's own coupon_allowed decides.
      await expect(page.getByTestId('coupon-blocked')).toHaveText(BLOCKED);
      await expect(couponInput(page)).toHaveCount(0);
      await page.getByLabel('ParcelMoover delivery destination').selectOption('e2e-kathmandu');
      await expect(total(page)).toContainText('1,299');
      await expect(page.getByTestId('coupon-blocked')).toHaveText(BLOCKED);
      await expect(couponInput(page)).toHaveCount(0);
      await expect(page.getByTestId('coupon-notice')).toHaveText('');
      // Nothing steals focus on load.
      await expect(page.getByTestId('coupon-blocked')).not.toBeFocused();
      await expectNoHorizontalOverflow(page);
      await request.delete(`${API}/cart`, { headers: bearer(session) });
      expect(failures).toEqual([]);
    });
  });
}

test('F: outside the campaign (simulated server answer) two covers keep the normal coupon field', async ({ page, request }) => {
  const failures = essentialFailures(page);
  const session = await apiLogin(request, 'customerB');
  await setCart(request, session, [await variantOf(request, 'glossy-white'), await variantOf(request, 'chetah-iconic', 'iPhone 14')]);
  // The window is fixed on the server; answer as the server does outside it.
  const outside = async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json?.data) Object.assign(json.data, { campaign_active: false, bundle_pairs: 0, coupon_allowed: true });
    await route.fulfill({ response, json });
  };
  await page.route(`${API}/cart`, outside);
  await page.route(`${API}/orders/preview`, outside);
  await useSession(page, session);
  await openCheckout(page);
  await expect(couponInput(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();
  await expect(page.getByTestId('coupon-blocked')).toHaveCount(0);
  await request.delete(`${API}/cart`, { headers: bearer(session) });
  expect(failures).toEqual([]);
});

test('G: guest checkout never shows coupon entry', async ({ page, request }) => {
  const failures = essentialFailures(page);
  const covers = [await variantOf(request, 'glossy-white'), await variantOf(request, 'chetah-iconic', 'iPhone 14')];
  for (const lines of [covers.slice(0, 1), covers]) {
    await page.addInitScript((snapshot) => {
      localStorage.setItem('caseverse_guest_cart', JSON.stringify(snapshot));
    }, lines.map((v) => ({ variant_id: v.id, quantity: 1, unit_price: v.price, compare_at_price: v.compare_at_price, stock_quantity: v.stock_quantity, product: v.product, sku: v.sku })));
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(couponInput(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Coupon' })).toHaveCount(0);
    await expect(page.getByTestId('coupon-blocked')).toHaveCount(0);
  }
  expect(failures).toEqual([]);
});
