import { expect, test } from '@playwright/test';
import { essentialFailures } from './helpers/monitor.js';
import { REPRESENTATIVE, expectNoHorizontalOverflow } from './helpers/viewport.js';
import { chooseDestination, destinationInput } from './helpers/destination.js';
import {
  SYNTHETIC_GUEST_TOKEN, json, mockDestinations, seedGuestCart, syntheticDestinations, syntheticLine, syntheticOrder, syntheticPreview,
} from './helpers/mocks.js';

const guestLine = {
  variant_id: syntheticLine.variant_id, quantity: 1, product: syntheticLine.product, sku: syntheticLine.sku, unit_price: 699, compare_at_price: null, stock_quantity: 5,
};
const INSIDE = syntheticDestinations[0];
const OUTSIDE = syntheticDestinations[1];

// What POST /api/geo/reverse answers (the server looks the address up; the browser never calls a geocoder).
const reverseAnswer = {
  province: 'Bagmati Province', district: 'Kathmandu', municipality: 'Kathmandu Metropolitan City', ward: 5,
  locality: 'Hadigaun', street: 'Hadigaun Marg', source: 'openstreetmap', attribution: '© OpenStreetMap contributors',
  suggested_destination: { id: INSIDE.id, name: INSIDE.name, label: INSIDE.label, district: 'Kathmandu', match: 'municipality' },
};

/**
 * Replaces navigator.geolocation so each outcome is deterministic.
 * mode: granted | denied | unavailable | timeout
 */
async function stubGeolocation(page, mode) {
  await page.addInitScript((geoMode) => {
    const errors = { denied: 1, unavailable: 2, timeout: 3 };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success, failure) {
          window.__geoCalls = (window.__geoCalls || 0) + 1;
          setTimeout(() => {
            if (geoMode === 'granted') success({ coords: { latitude: 27.7215678, longitude: 85.3381234, accuracy: 20 } });
            else failure({ code: errors[geoMode], PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: geoMode });
          }, 150);
        },
        watchPosition() { return 0; },
        clearWatch() {},
      },
    });
  }, mode);
}

async function openGuestCheckout(page, geoMode) {
  await page.setViewportSize(REPRESENTATIVE.mobile);
  await stubGeolocation(page, geoMode);
  await seedGuestCart(page, [guestLine]);
  await mockDestinations(page);
  await page.route('**/api/guest-checkout/preview', (route) => json(route, { data: syntheticPreview() }));
  await page.goto('/checkout');
  await expect(destinationInput(page)).toBeEnabled();
}

test.describe('checkout: Use my location', () => {
  test('asks for the position only after a tap', async ({ page }) => {
    await openGuestCheckout(page, 'granted');
    await page.route('**/api/geo/reverse', (route) => json(route, { data: reverseAnswer }));
    expect(await page.evaluate(() => window.__geoCalls || 0)).toBe(0);
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect.poll(() => page.evaluate(() => window.__geoCalls || 0)).toBe(1);
  });

  test('granted: fills the address, suggests the destination, and the order carries no position', async ({ page }) => {
    const failures = essentialFailures(page);
    await openGuestCheckout(page, 'granted');
    let reverseBody = null;
    await page.route('**/api/geo/reverse', async (route) => {
      reverseBody = route.request().postDataJSON();
      await new Promise((resolve) => setTimeout(resolve, 400));
      return json(route, { data: reverseAnswer });
    });
    let placedBody = null;
    await page.route('**/api/guest-checkout/orders', (route) => {
      placedBody = route.request().postDataJSON();
      return json(route, { data: syntheticOrder({ guest: true }), guest_token: SYNTHETIC_GUEST_TOKEN }, 201);
    });
    await page.route(`**/api/guest-checkout/orders/${SYNTHETIC_GUEST_TOKEN}`, (route) => json(route, { data: syntheticOrder({ guest: true }) }));

    await page.getByRole('button', { name: 'Use my location' }).click();
    const status = page.getByTestId('location-status');
    await expect(status).toContainText('Detecting location…');
    await expect(status).toContainText('Location detected: Hadigaun, Kathmandu');
    await expect(status).toContainText('We filled the available address details. Please review them.');
    await expect(status.getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    expect(reverseBody).toEqual({ latitude: 27.7215678, longitude: 85.3381234 });

    await expect(page.getByLabel('Province')).toHaveValue('Bagmati Province');
    await expect(page.getByLabel('District')).toHaveValue('Kathmandu');
    await expect(page.getByLabel('Municipality / City')).toHaveValue('Kathmandu Metropolitan City');
    await expect(page.getByLabel('Area / Street')).toHaveValue('Hadigaun, Hadigaun Marg, Ward 5');
    await expect(destinationInput(page)).toHaveAttribute('data-value', INSIDE.id);
    await expect(page.getByTestId('destination-context')).toContainText('Suggested delivery destination: Qa Inside Valley, Kathmandu');

    // Every field stays editable.
    await page.getByLabel('Area / Street').fill('Hadigaun, near the temple');
    await expect(page.getByLabel('Area / Street')).toHaveValue('Hadigaun, near the temple');

    // Coordinates are not kept in storage.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toMatch(/27\.72|85\.33/);

    await page.getByLabel('Full name').fill('QA Guest');
    await page.getByLabel('Phone number').fill('9800000000');
    await page.getByRole('button', { name: 'Place order & continue to payment' }).click();
    await expect(page).toHaveURL(new RegExp(`/order/guest/${SYNTHETIC_GUEST_TOKEN}$`));
    expect(placedBody.guest.parcelmoover_destination_id).toBe(INSIDE.id);
    expect(placedBody.guest).not.toHaveProperty('latitude');
    expect(placedBody.guest).not.toHaveProperty('longitude');
    expect(JSON.stringify(placedBody)).not.toMatch(/27\.72|85\.33/);
    expect(failures).toEqual([]);
  });

  for (const [mode, text] of [['denied', 'Permission denied.'], ['unavailable', 'Location unavailable.'], ['timeout', 'Timeout.']]) {
    test(`${mode}: explains it and leaves the address to the customer`, async ({ page }) => {
      const failures = essentialFailures(page);
      await openGuestCheckout(page, mode);
      let reverseCalls = 0;
      await page.route('**/api/geo/reverse', (route) => { reverseCalls += 1; return json(route, { data: reverseAnswer }); });
      await page.getByRole('button', { name: 'Use my location' }).click();
      await expect(page.getByTestId('location-status')).toContainText(text);
      expect(reverseCalls).toBe(0);
      await expect(page.getByLabel('District')).toHaveValue('');
      await expect(page.getByLabel('District')).toBeEditable();
      await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
      expect(failures).toEqual([]);
    });
  }

  test('lookup failure keeps the form usable', async ({ page }) => {
    await openGuestCheckout(page, 'granted');
    await page.route('**/api/geo/reverse', (route) => json(route, { error: { message: 'We could not look up an address for your location. Please enter it manually.', code: 'geocoder_unavailable' } }, 503));
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByTestId('location-status')).toContainText('Please enter it manually.');
    await expect(page.getByLabel('Municipality / City')).toBeEditable();
  });
});

test.describe('checkout: searchable destination', () => {
  test('is a combobox with a small, keyboard-navigable result list on a phone', async ({ page }) => {
    const failures = essentialFailures(page);
    await openGuestCheckout(page, 'denied');
    const input = destinationInput(page);
    await expect(page.locator('select')).toHaveCount(0);
    await input.click();
    await input.fill('qa');
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(input).toHaveAttribute('data-value', OUTSIDE.id);
    await expect(input).toHaveValue(OUTSIDE.label);
    await expectNoHorizontalOverflow(page);
    expect(failures).toEqual([]);
  });

  test('partial text finds a locality, shows its place and suggestion, and the customer can override it', async ({ page }) => {
    await openGuestCheckout(page, 'denied');
    let previewDestination = null;
    await page.unroute('**/api/guest-checkout/preview');
    await page.route('**/api/guest-checkout/preview', (route) => {
      previewDestination = route.request().postDataJSON().guest?.parcelmoover_destination_id || null;
      return json(route, { data: syntheticPreview({ shipping: previewDestination === OUTSIDE.id ? 200 : 100 }) });
    });
    await page.unroute('**/api/geo/localities/search');
    await page.route('**/api/geo/localities/search', (route) => {
      const { q } = route.request().postDataJSON();
      if (!/^hadig/i.test(q)) {
        // Like the real index: destinations match by name.
        return json(route, { data: syntheticDestinations.filter((destination) => destination.label.toLowerCase().includes(q.toLowerCase())).map((destination) => ({
          kind: 'destination', place_type: 'destination', name: destination.label, municipality: null, district: destination.district, province: null,
          suggested_destination: { id: destination.id, name: destination.name, label: destination.label, district: destination.district, match: 'destination' }, district_destination_count: 1,
        })) });
      }
      return json(route, { data: [{
        kind: 'locality', place_type: 'locality', name: 'Hadigaun', municipality: 'Kathmandu Metropolitan City', district: 'Kathmandu', province: 'Bagmati Province',
        suggested_destination: { id: INSIDE.id, name: INSIDE.name, label: INSIDE.label, district: 'Kathmandu', match: 'municipality' }, district_destination_count: 1,
      }] });
    });
    await chooseDestination(page, 'hadig', /^Hadigaun/);
    await expect(destinationInput(page)).toHaveAttribute('data-value', INSIDE.id);
    await expect(page.getByTestId('destination-context')).toContainText('Hadigaun, Kathmandu Metropolitan City, Kathmandu.');
    await expect(page.getByTestId('destination-context')).toContainText('Suggested delivery destination: Qa Inside Valley, Kathmandu');

    // Manual override to another real destination.
    await page.getByLabel('Province').fill('Gandaki');
    await page.getByLabel('Municipality / City').fill('Pokhara');
    await chooseDestination(page, 'pokhara', 'Qa Pokhara, Kaski');
    await expect(destinationInput(page)).toHaveAttribute('data-value', OUTSIDE.id);
    await expect.poll(() => previewDestination).toBe(OUTSIDE.id);
  });

  test('a place without a confident mapping asks the customer to choose in its district', async ({ page }) => {
    await openGuestCheckout(page, 'denied');
    await page.unroute('**/api/geo/localities/search');
    await page.route('**/api/geo/localities/search', (route) => json(route, { data: [{
      kind: 'locality', place_type: 'village', name: 'QA Remote Village', municipality: null, district: 'Kaski', province: 'Gandaki Province',
      suggested_destination: null, district_destination_count: 1,
    }] }));
    await chooseDestination(page, 'remote', /^QA Remote Village/);
    await expect(destinationInput(page)).toHaveAttribute('data-value', '');
    await expect(page.getByTestId('destination-context')).toContainText('No ParcelMoover destination matches this place. Choose the nearest one in Kaski.');
    await expect(page.getByRole('option', { name: /^Qa Pokhara, Kaski/ })).toBeVisible();
    await page.getByRole('option', { name: /^Qa Pokhara, Kaski/ }).click();
    await expect(destinationInput(page)).toHaveAttribute('data-value', OUTSIDE.id);
  });
});
