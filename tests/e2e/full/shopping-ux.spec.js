/**
 * Phase 1 shopping UX against the real caseverse_e2e backend: cart drawer,
 * Buy now, cart page Dashain/coupon messaging, PDP model selection and stock
 * wording, and search. Every total asserted here is the server's; the Dashain
 * numbers are checked only while the fixed campaign window is open.
 *
 * Fixtures used (server/scripts/e2e/fixtureData.js):
 *   pink-love-bow      6 models, stock 10/5
 *   chetah-iconic      iPhone 14 / iPhone 15 Pro
 *   flame-silver       single model (iPhone 11 Pro)
 *   e2e-scarce-stock   iPhone 13 mini = 2 available, iPhone 16 Pro = sold out
 */
import { expect, test } from '@playwright/test';
import { essentialFailures } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';
import { expectNoHorizontalOverflow } from '../helpers/viewport.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const VIEWPORTS = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];
const BUNDLE_NOTE = 'Coupons can’t be combined with the Dashain Trio Offer.';
const npr = (value) => `NPR ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let campaignActive = false;
test.beforeAll(async ({ request }) => {
  campaignActive = Boolean((await (await request.get(`${API}/campaign/dashain`)).json()).data?.active);
});
/** Server total for n covers: 699 each, or the Dashain pair price while the campaign runs. */
const coversTotal = (n) => (campaignActive ? Math.floor(n / 2) * 1199 + (n % 2) * 699 : n * 699);

const guestLines = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('caseverse_guest_cart') || '[]'));
const drawer = (page) => page.getByRole('dialog', { name: 'Your cart' });
const picker = (page) => page.getByRole('group', { name: /Phone Model/ });
const chip = (page, model) => picker(page).getByRole('button', { name: model, exact: true });

async function openPdp(page, slug) {
  await page.goto(`/p/${slug}`);
  await expect(page.locator('h1')).toBeVisible();
}

async function addModel(page, slug, model) {
  await openPdp(page, slug);
  await chip(page, model).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(drawer(page)).toBeVisible();
}

async function closeDrawer(page) {
  await drawer(page).getByRole('button', { name: 'Close cart' }).click();
  await expect(drawer(page)).toBeHidden();
}

const lineFor = (scope, model) => scope.getByTestId('cart-line').filter({ hasText: model });

for (const viewport of VIEWPORTS) {
  test.describe(`shopping (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('multi-model PDP requires a model; Add to cart opens an accessible drawer', async ({ page }) => {
      const failures = essentialFailures(page);
      await openPdp(page, 'pink-love-bow');
      // Nothing is pre-chosen on a multi-model product.
      await expect(picker(page).locator('[aria-pressed="true"]')).toHaveCount(0);
      await expect(page.getByTestId('pdp-stock')).toHaveText('Choose your model to see availability.');

      await page.getByRole('button', { name: 'Add to cart' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Choose your iPhone model first.' })).toBeVisible();
      await page.getByRole('button', { name: 'Buy now' }).click();
      await expect(page).toHaveURL(/\/p\/pink-love-bow$/);
      await expect(drawer(page)).toHaveCount(0);
      expect(await guestLines(page)).toEqual([]);

      await chip(page, 'iPhone 16').click();
      await expect(chip(page, 'iPhone 16')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('pdp-stock')).toHaveText('In stock');
      const addButton = page.getByRole('button', { name: 'Add to cart' });
      await addButton.click();

      const cart = drawer(page);
      await expect(cart).toBeVisible();
      const line = lineFor(cart, 'iPhone 16');
      await expect(line).toContainText('Pink love bow');
      await expect(line.getByRole('group', { name: 'Quantity of Pink love bow, iPhone 16' })).toContainText('1');
      await expect(line.getByTestId('line-total')).toHaveText(npr(699));
      expect(await line.locator('img').getAttribute('src')).toMatch(/Pink_love_bow\.png$/);
      await expect(cart.getByTestId('cart-total')).toHaveText(npr(699));

      // Focus starts on Close, Tab stays inside, Escape closes and returns focus.
      await expect(cart.getByRole('button', { name: 'Close cart' })).toBeFocused();
      for (let i = 0; i < 14; i += 1) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
      }
      await cart.getByRole('button', { name: 'Close cart' }).focus();
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
      expect(await page.evaluate(() => document.body.classList.contains('minicart-open'))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(cart).toBeHidden();
      await expect(addButton).toBeFocused();
      expect(await page.evaluate(() => document.body.classList.contains('minicart-open'))).toBe(false);
      await expectNoHorizontalOverflow(page);
      expect(failures).toEqual([]);
    });

    test('drawer quantity, remove, second product, Dashain totals, View cart and Checkout', async ({ page }) => {
      const failures = essentialFailures(page);
      await addModel(page, 'pink-love-bow', 'iPhone 16');
      await expect(drawer(page).getByTestId('cart-total')).toHaveText(npr(coversTotal(1)));
      await closeDrawer(page);

      await addModel(page, 'chetah-iconic', 'iPhone 14');
      const cart = drawer(page);
      await expect(cart.getByTestId('cart-line')).toHaveCount(2);
      await expect(cart.getByTestId('cart-total')).toHaveText(npr(coversTotal(2)));
      if (campaignActive) {
        await expect(cart.getByTestId('dashain-offer')).toContainText('1 bundle pair + 1 FREE suction holder');
        await expect(cart.getByTestId('dashain-offer')).toContainText(`You save ${npr(199)}`);
      }

      // Three covers, then four: the drawer shows the server's recalculated totals.
      await lineFor(cart, 'iPhone 16').getByRole('button', { name: /^Increase quantity/ }).click();
      await expect(lineFor(cart, 'iPhone 16').getByTestId('line-total')).toHaveText(npr(1398));
      await expect(cart.getByTestId('cart-total')).toHaveText(npr(coversTotal(3)));
      await lineFor(cart, 'iPhone 14').getByRole('button', { name: /^Increase quantity/ }).click();
      await expect(cart.getByTestId('cart-total')).toHaveText(npr(coversTotal(4)));
      if (campaignActive) await expect(cart.getByTestId('dashain-offer')).toContainText('2 bundle pairs + 2 FREE suction holders');
      await expect.poll(() => guestLines(page)).toEqual(expect.arrayContaining([
        expect.objectContaining({ quantity: 2 }), expect.objectContaining({ quantity: 2 }),
      ]));

      // Remove one design and step the other back to one cover.
      await lineFor(cart, 'iPhone 14').getByRole('button', { name: 'Remove Chetah iconic, iPhone 14' }).click();
      await expect(cart.getByTestId('cart-line')).toHaveCount(1);
      await expect(cart.getByTestId('cart-total')).toHaveText(npr(coversTotal(2)));
      await lineFor(cart, 'iPhone 16').getByRole('button', { name: /^Decrease quantity/ }).click();
      await expect(cart.getByTestId('cart-total')).toHaveText(npr(coversTotal(1)));
      if (campaignActive) await expect(cart.getByTestId('dashain-offer')).toContainText('Add 1 more eligible case');

      await cart.getByRole('link', { name: 'View cart' }).click();
      await expect(page).toHaveURL(/\/cart$/);
      await expect(drawer(page)).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Cart', exact: true })).toBeVisible();
      await expect(lineFor(page, 'iPhone 16')).toContainText('Pink love bow');
      // Header cart button: in the menu on phones.
      const menu = page.getByRole('button', { name: 'Open menu' });
      if (await menu.isVisible()) await menu.click();
      await page.getByRole('button', { name: /^Cart/ }).filter({ visible: true }).first().click();
      await expect(drawer(page)).toBeVisible();
      await drawer(page).getByRole('link', { name: 'Checkout' }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(failures).toEqual([]);
    });

    test('Buy now goes to checkout, keeps an existing cart and never doubles a model', async ({ page }) => {
      const failures = essentialFailures(page);
      // Empty cart: straight to checkout with just this model.
      await openPdp(page, 'flame-silver');
      await page.getByRole('button', { name: 'Buy now' }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      await expect(page.getByTestId('buy-now-note')).toHaveCount(0);
      expect((await guestLines(page)).map((l) => l.quantity)).toEqual([1]);

      // Same model again: still one unit.
      await openPdp(page, 'flame-silver');
      await page.getByRole('button', { name: 'Buy now' }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      expect((await guestLines(page)).map((l) => l.quantity)).toEqual([1]);

      // A different model with that cart: both are ordered, and checkout says so.
      await openPdp(page, 'chetah-iconic');
      await chip(page, 'iPhone 15 Pro').click();
      await page.getByRole('button', { name: 'Buy now' }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      await expect(page.getByTestId('buy-now-note')).toContainText('Your cart already had 1 other item');
      expect(await guestLines(page)).toHaveLength(2);
      expect(failures).toEqual([]);
    });

    test('low-stock and sold-out models use available stock and cannot be oversold', async ({ page, request }) => {
      const failures = essentialFailures(page);
      await openPdp(page, 'e2e-scarce-stock');
      const soldOut = picker(page).getByRole('button', { name: /iPhone 16 Pro/ });
      await expect(soldOut).toBeDisabled();
      await expect(soldOut).toContainText('Sold out');
      await page.getByRole('button', { name: 'Buy now' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Choose your iPhone model first.' })).toBeVisible();
      await expect(page).toHaveURL(/\/p\/e2e-scarce-stock$/);
      expect(await guestLines(page)).toEqual([]);

      const { data } = await (await request.get(`${API}/products/e2e-scarce-stock`)).json();
      const low = data.variants.find((v) => v.attributes[0].value === 'iPhone 13 mini');
      await chip(page, 'iPhone 13 mini').click();
      await expect(page.getByTestId('pdp-stock')).toHaveText(`Only ${low.stock_quantity} left`);
      // The PDP stepper stops at the available count.
      const stepper = page.getByRole('group', { name: 'Quantity of E2E Scarce stock' });
      await stepper.getByRole('button', { name: /^Increase/ }).click();
      await expect(stepper.getByRole('button', { name: /^Increase/ })).toBeDisabled();

      await page.getByRole('button', { name: 'Add to cart' }).click();
      const line = lineFor(drawer(page), 'iPhone 13 mini');
      await expect(line).toContainText(`Only ${low.stock_quantity} left`);
      await expect(line.getByRole('button', { name: /^Increase/ })).toBeDisabled();
      await closeDrawer(page);

      // Asking for more than is available is refused and the cart is unchanged.
      await openPdp(page, 'e2e-scarce-stock');
      await chip(page, 'iPhone 13 mini').click();
      await page.getByRole('button', { name: 'Add to cart' }).click();
      await expect(page.getByText(`Only ${low.stock_quantity} in stock`).first()).toBeVisible();
      expect((await guestLines(page)).map((l) => l.quantity)).toEqual([low.stock_quantity]);
      expect(failures).toEqual([]);
    });

    test('single-model and mobile PDP purchase order', async ({ page, request }) => {
      const failures = essentialFailures(page);
      // Other suites may hold reservations on this fixture: read what is available now.
      const { data } = await (await request.get(`${API}/products/flame-silver`)).json();
      const available = data.variants[0].stock_quantity;
      await openPdp(page, 'flame-silver');
      await expect(chip(page, 'iPhone 11 Pro')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('pdp-stock')).toHaveText(available > 3 ? 'In stock' : `Only ${available} left`);
      await expect(page.getByText('SKU CV-FLAME-SILVER-IPHONE-11-PRO')).toBeVisible();

      await openPdp(page, 'pink-love-bow');
      const top = async (locator) => (await locator.boundingBox()).y;
      const order = [
        await top(page.locator('.pdp-media')),
        await top(page.locator('h1')),
        await top(page.locator('.pdp-price')),
        await top(picker(page)),
        await top(page.getByTestId('pdp-stock')),
        await top(page.locator('.pdp-cart-actions')),
        await top(page.locator('.pdp-help')),
      ];
      if (viewport.name === 'mobile') {
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        // The sticky bar shows only after the main buttons scroll away.
        const bar = page.locator('.pdp-sticky-bar');
        await expect(bar).not.toHaveClass(/is-visible/);
        await page.locator('.pdp-help').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY + 400));
        await expect(bar).toHaveClass(/is-visible/);
        await expect(bar).toContainText('Choose your model');
        await bar.getByRole('button', { name: 'Choose model' }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Choose your iPhone model first.' })).toBeVisible();
      } else {
        expect(order.slice(1)).toEqual([...order.slice(1)].sort((a, b) => a - b));
      }
      await expectNoHorizontalOverflow(page);
      expect(failures).toEqual([]);
    });

    test('search by design, by iPhone model, and the no-results state', async ({ page }) => {
      const failures = essentialFailures(page);
      await page.goto('/shop');
      const box = page.getByRole('searchbox', { name: /Search covers/ });
      await box.fill('floral');
      await box.press('Enter');
      await expect(page).toHaveURL(/q=floral/);
      await expect(page.locator('.product-card')).toHaveCount(1);
      await expect(page.locator('.product-card')).toContainText('Pink Floral');

      await box.fill('iphone 15 pro');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page.locator('.product-card')).toHaveCount(2);
      await expect(page.locator('.product-card').filter({ hasText: 'Chetah iconic' })).toBeVisible();
      // Results link to the searched model, and the PDP opens with it chosen.
      await page.locator('.product-card').filter({ hasText: 'Chetah iconic' }).getByRole('link').first().click();
      await expect(page).toHaveURL(/\/p\/chetah-iconic\?model=iPhone%2015%20Pro$/);
      await expect(chip(page, 'iPhone 15 Pro')).toHaveAttribute('aria-pressed', 'true');

      await page.goto('/covers?q=zzzz');
      await expect(page.getByText('No covers match "zzzz"')).toBeVisible();
      await page.getByRole('button', { name: 'Clear search' }).last().click();
      await expect(page).not.toHaveURL(/q=/);
      await expect(page.locator('.product-card').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(failures).toEqual([]);
    });
  });
}

test('cart coupon messaging follows the server: allowed with one cover, blocked only by an active pair', async ({ page, request }) => {
  const failures = essentialFailures(page);
  const session = await apiLogin(request, 'customerB');
  const variantOf = async (slug, model) => {
    const { data } = await (await request.get(`${API}/products/${slug}`)).json();
    return data.variants.find((v) => v.attributes.some((a) => a.value === model));
  };
  const first = await variantOf('pink-love-bow', 'iPhone 12');
  const second = await variantOf('chetah-iconic', 'iPhone 14');
  await request.delete(`${API}/cart`, { headers: bearer(session) });
  expect((await request.post(`${API}/cart/items`, { headers: bearer(session), data: { variant_id: first.id, quantity: 1 } })).status()).toBe(201);
  await useSession(page, session);
  try {
    await page.goto('/cart');
    const note = page.locator('.cart-summary').getByTestId('cart-coupon-note');
    await expect(note).toHaveText('Have a coupon? Apply it at checkout.');

    await page.goto('/p/chetah-iconic');
    await chip(page, 'iPhone 14').click();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(drawer(page).getByTestId('cart-line')).toHaveCount(2);
    if (campaignActive) await expect(drawer(page).getByTestId('cart-coupon-note')).toContainText(BUNDLE_NOTE);
    else await expect(drawer(page).getByTestId('cart-coupon-note')).toHaveText('Have a coupon? Apply it at checkout.');

    await drawer(page).getByRole('link', { name: 'View cart' }).click();
    await expect(drawer(page)).toBeHidden();
    await lineFor(page, 'iPhone 14').getByRole('button', { name: /^Remove/ }).click();
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(note).toHaveText('Have a coupon? Apply it at checkout.');
    await expect(page.getByTestId('cart-total')).toHaveText(npr(699));
    expect(second.id).toBeTruthy();
  } finally {
    await request.delete(`${API}/cart`, { headers: bearer(session) });
  }
  expect(failures).toEqual([]);
});

test('guest cart explains coupons need an account', async ({ page }) => {
  await addModel(page, 'flame-silver', 'iPhone 11 Pro');
  await expect(drawer(page).getByTestId('cart-coupon-note')).toHaveText('Coupons need an account. Sign in before checkout to use one.');
});
