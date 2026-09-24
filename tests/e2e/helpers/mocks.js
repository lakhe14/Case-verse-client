/**
 * Synthetic QA data and route mocks for UI-behavior tests that must not create
 * real orders, payments, or uploads. Every value here is fake; nothing maps to
 * a real customer, order, or payment confirmation.
 */
export const SYNTHETIC_ACCESS_TOKEN = 'e2e-synthetic-access-token-not-a-jwt';
// Well-formed (length 20..200) but never issued by the server.
export const SYNTHETIC_GUEST_TOKEN = 'e2e-synthetic-guest-token-0000000000000000';
export const SYNTHETIC_ORDER_ID = 990001;

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const serverError = (route) => json(route, { error: { message: 'Something went wrong', code: 'internal_error', request_id: 'e2e' } }, 500);

// Smallest valid PNG (1x1 transparent pixel); the payment-proof fixture.
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

export const files = {
  validPng: { name: 'qa-payment-proof.png', mimeType: 'image/png', buffer: PNG_1PX },
  unsupported: { name: 'qa-payment-proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% synthetic QA file\n') },
  oversized: { name: 'qa-oversized-proof.png', mimeType: 'image/png', buffer: Buffer.concat([PNG_1PX, Buffer.alloc(5 * 1024 * 1024)]) },
};

export const pngBody = PNG_1PX;

export const syntheticLine = {
  id: 1,
  variant_id: 990101,
  quantity: 1,
  unit_price: 699,
  compare_at_price: null,
  line_total: 699,
  available_stock: 5,
  stock_ok: true,
  product: { id: 990201, name: 'QA synthetic cover', slug: 'flame-silver', image: null },
  sku: 'QA-SYNTHETIC-SKU',
};

export const syntheticCart = {
  items: [syntheticLine],
  subtotal: 699,
  covers_qty: 1,
  bundle_discount: 0,
  campaign_active: false,
  campaign_code: null,
  campaign_label: null,
  free_items: [],
  estimated_total: 699,
  item_count: 1,
  has_stock_issue: false,
};

// Same shape as GET /shipping/parcelmoover/destinations (provider fields plus
// the parsed label, locality and district used for search and display).
export const syntheticDestinations = [
  { id: 'qa-dest-inside', name: 'QA INSIDE VALLEY - KTM', zone: 'inside_valley', valley: 'inside', label: 'Qa Inside Valley, Kathmandu', locality: 'Qa Inside Valley', district: 'Kathmandu' },
  { id: 'qa-dest-outside', name: 'QA POKHARA - KASKI', zone: 'major_cities', valley: 'outside', label: 'Qa Pokhara, Kaski', locality: 'Qa Pokhara', district: 'Kaski' },
];

export function syntheticPreview({ shipping = 100 } = {}) {
  return {
    lines: [{ variant_id: syntheticLine.variant_id, name: syntheticLine.product.name, quantity: 1, unit_price: 699, compare_at_price: null }],
    subtotal: 699,
    bundle_discount: 0,
    coupon_discount: 0,
    points_discount: 0,
    shipping_amount: shipping,
    total_amount: 699 + shipping,
    shipping_method: 'ParcelMoover home delivery',
    advance_amount: 100,
    remaining_due: 599 + shipping,
    campaign_active: false,
    free_items: [],
  };
}

export function syntheticOrder({ paymentStatus = 'pending', guest = false } = {}) {
  return {
    id: SYNTHETIC_ORDER_ID,
    order_number: 'QA-E2E-0001',
    status: 'pending',
    placed_at: '2026-01-01T00:00:00.000Z',
    subtotal_amount: '699.00',
    bundle_discount_amount: '0.00',
    discount_amount: '0.00',
    shipping_amount: '100.00',
    total_amount: '799.00',
    courier_destination_name: 'QA inside valley',
    items: [{ id: 1, product_name_snap: 'QA synthetic cover', quantity: 1, line_total: '699.00', sku_snap: 'QA-SYNTHETIC-SKU' }],
    promoItems: [],
    statusHistory: [{ id: 1, status: 'pending', changed_at: '2026-01-01T00:00:00.000Z' }],
    ...(guest ? { guest_name: 'QA Guest', guest_phone: '9800000000', guest_province: 'Bagmati', guest_district: 'Kathmandu', guest_municipality: 'Kathmandu', guest_area: 'QA street' } : {}),
    paymentConfirmation: { id: 990301, method: 'advance_qr', status: paymentStatus, advance_amount: '100.00', admin_note: null },
  };
}

/** Pretends a customer is signed in, and serves every authenticated call the storefront makes. */
export async function mockCustomerSession(page, { cart = syntheticCart, addresses } = {}) {
  await page.addInitScript((token) => {
    if (sessionStorage.getItem('cv_e2e_seeded')) return;
    localStorage.setItem('cv_access', token);
    sessionStorage.setItem('cv_e2e_seeded', '1');
  }, SYNTHETIC_ACCESS_TOKEN);
  await page.route('**/api/auth/me', (route) => json(route, { type: 'customer', user: { id: 990401, name: 'QA Customer', email: 'qa-customer@example.invalid' } }));
  await page.route('**/api/cart', (route) => json(route, { data: cart }));
  await page.route('**/api/loyalty/balance', (route) => json(route, { data: { points: 0 } }));
  await page.route('**/api/addresses', (route) => json(route, {
    data: addresses || [{ id: 990501, is_default: true, recipient_name: 'QA Customer', phone: '9800000000', line1: 'QA street', line2: null, city: 'Kathmandu', state: 'Bagmati', country: 'Nepal' }],
  }));
}

export async function mockStaffSession(page, permissions) {
  await page.addInitScript((token) => {
    if (sessionStorage.getItem('cv_e2e_seeded')) return;
    localStorage.setItem('cv_access', token);
    sessionStorage.setItem('cv_e2e_seeded', '1');
  }, SYNTHETIC_ACCESS_TOKEN);
  await page.route('**/api/auth/me', (route) => json(route, { type: 'staff', staff: { id: 990601, name: 'QA Staff', role: 'QA role', permissions } }));
}

export async function mockDestinations(page, { fail = false, delayMs = 0 } = {}) {
  await page.route('**/api/shipping/parcelmoover/destinations', async (route) => {
    if (delayMs) await delay(delayMs);
    return fail ? serverError(route) : json(route, { data: syntheticDestinations });
  });
  // Place search answers with the synthetic destinations only, so a mocked
  // test never mixes in ids from the real provider list.
  await page.route('**/api/geo/localities/search', (route) => {
    const q = String(route.request().postDataJSON()?.q || '').toLowerCase();
    const data = syntheticDestinations
      .filter((destination) => destination.label.toLowerCase().includes(q))
      .map((destination) => ({ kind: 'destination', place_type: 'destination', name: destination.label, municipality: null, district: destination.district, province: null, suggested_destination: { id: destination.id, name: destination.name, label: destination.label, district: destination.district, match: 'destination' }, district_destination_count: 1 }));
    return json(route, { data });
  });
}

/** Seeds the guest cart in localStorage with a real catalog variant. */
export async function seedGuestCart(page, lines) {
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('cv_e2e_cart_seeded')) return;
    localStorage.setItem('caseverse_guest_cart', JSON.stringify(value));
    sessionStorage.setItem('cv_e2e_cart_seeded', '1');
  }, lines);
}
