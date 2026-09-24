/**
 * Locality search, "Use my location" and the destination combobox against the
 * real API and its offline locality index, in the isolated E2E environment
 * (ParcelMoover and the geocoder are the server's E2E stubs). Guest orders
 * created here are E2E-owned and removed by global teardown.
 */
import { expect, test } from '@playwright/test';
import { addToCartFromPdp } from '../helpers/catalog.js';
import { essentialFailures } from '../helpers/monitor.js';
import { API, apiLogin, bearer, useSession } from '../helpers/session.js';
import { REPRESENTATIVE } from '../helpers/viewport.js';
import { chooseDestination, destinationInput } from '../helpers/destination.js';

test.skip(!process.env.E2E_FULL, 'Needs the isolated E2E environment: npm run test:e2e:full');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const RUN_ID = process.env.E2E_RUN_ID;
const money = (value) => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function grantLocation(page) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 27.7215678, longitude: 85.3381234 });
}

test.describe('locality-aware destination search (real index)', () => {
  test('Hadigaun, Sukute and Pokhara map to real destinations; the customer can override', async ({ page, request }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await addToCartFromPdp(page, 'pink-love-bow', 'iPhone 16');
    await page.goto('/checkout');

    await chooseDestination(page, 'Hadig', /^Hadigaun/);
    await expect(destinationInput(page)).toHaveAttribute('data-value', 'e2e-kathmandu');
    await expect(page.getByTestId('destination-context')).toContainText('Hadigaun, Kathmandu Metropolitan City, Kathmandu.');
    await expect(page.getByTestId('destination-context')).toContainText('Suggested delivery destination: Inside Valley, Kathmandu');

    await chooseDestination(page, 'Sukute', /^Sukute/);
    await expect(destinationInput(page)).toHaveAttribute('data-value', 'e2e-khadichaur');
    await expect(page.getByTestId('destination-context')).toContainText('Sindhupalchok');

    await chooseDestination(page, 'Pokhara', /^Pokhara, Kaski/);
    await expect(destinationInput(page)).toHaveAttribute('data-value', 'e2e-pokhara');

    // Server-authoritative quote: the page shows exactly what the API computes for that destination.
    await page.getByLabel('Province').fill('Gandaki');
    await page.getByLabel('Municipality / City').fill('Pokhara');
    const variants = (await (await request.get(`${API}/products/pink-love-bow`)).json()).data.variants;
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('caseverse_guest_cart') || '[]'));
    const preview = await (await request.post(`${API}/guest-checkout/preview`, {
      data: { items: cart.map((line) => ({ variant_id: line.variant_id, quantity: line.quantity })), guest: { municipality: 'Pokhara', province: 'Gandaki', parcelmoover_destination_id: 'e2e-pokhara' } },
    })).json();
    expect(variants.length).toBeGreaterThan(0);
    await expect(page.locator('.checkout-summary .summary-total')).toContainText(money(preview.data.total_amount));
    expect(preview.data.shipping_amount).toBe(150);
    expect(failures).toEqual([]);
  });

  test('Use my location fills the address and the placed guest order stores no position', async ({ page, request }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.mobile);
    await grantLocation(page);
    await addToCartFromPdp(page, 'pink-love-bow', 'iPhone 16');
    await page.goto('/checkout');
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByTestId('location-status')).toContainText('Location detected: Hadigaun, Kathmandu');
    await expect(page.getByLabel('District')).toHaveValue('Kathmandu');
    await expect(page.getByLabel('Municipality / City')).toHaveValue('Kathmandu Metropolitan City');
    await expect(page.getByLabel('Province')).toHaveValue('Bagmati Province');
    await expect(page.getByLabel('Area / Street')).toHaveValue('Hadigaun, Hadigaun Marg, Ward 5');
    await expect(destinationInput(page)).toHaveAttribute('data-value', 'e2e-kathmandu');

    await page.getByLabel('Full name').fill(`E2E location ${RUN_ID}`);
    await page.getByLabel('Phone number').fill('9800000018');
    await page.getByLabel('Delivery notes (optional)').fill(`${RUN_ID} location`);
    await expect(page.locator('.checkout-summary .summary-total')).toContainText(money(799));

    const placed = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/api/guest-checkout/orders'));
    await page.locator('.checkout-summary button[type="submit"]').click();
    const response = await placed;
    expect(response.status()).toBe(201);
    const sent = response.request().postDataJSON();
    expect(sent.guest).not.toHaveProperty('latitude');
    expect(sent.guest).not.toHaveProperty('longitude');
    const { data: order, guest_token: token } = await response.json();

    const staff = await apiLogin(request, 'staff');
    const stored = (await (await request.get(`${API}/admin/orders/${order.id}`, { headers: bearer(staff) })).json()).data;
    expect(stored.guest_latitude).toBeNull();
    expect(stored.guest_longitude).toBeNull();
    expect(stored.guest_municipality).toBe('Kathmandu Metropolitan City');
    expect(stored.courier_destination_id).toBe('e2e-kathmandu');
    expect((await request.post(`${API}/guest-checkout/orders/${token}/cancel`)).status()).toBe(200);
    expect(failures).toEqual([]);
  });

  test('signed-in checkout searches destinations and places with the chosen id', async ({ page, request }) => {
    const failures = essentialFailures(page);
    await page.setViewportSize(REPRESENTATIVE.mobile);
    const customer = await apiLogin(request, 'customer');
    await request.delete(`${API}/cart`, { headers: bearer(customer) });
    const { data: product } = await (await request.get(`${API}/products/pink-love-bow`)).json();
    await request.post(`${API}/cart/items`, { headers: bearer(customer), data: { variant_id: product.variants[0].id, quantity: 1 } });
    await useSession(page, customer);
    await page.goto('/checkout');
    await chooseDestination(page, 'Basantapur', /^Basantapur/);
    await expect(destinationInput(page)).toHaveAttribute('data-value', 'e2e-kathmandu');
    await expect(page.locator('.checkout-summary .summary-total')).toContainText(money(799));
    const placed = page.waitForResponse((r) => r.request().method() === 'POST' && /\/api\/orders$/.test(r.url()));
    await page.getByRole('button', { name: 'Place order & continue to payment' }).click();
    const response = await placed;
    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON().parcelmoover_destination_id).toBe('e2e-kathmandu');
    const orderId = (await response.json()).data.id;
    expect((await request.post(`${API}/orders/${orderId}/cancel`, { headers: bearer(customer) })).status()).toBe(200);
    expect(failures).toEqual([]);
  });
});
