/**
 * Runs after both E2E servers are up. Proves the API is the isolated E2E
 * instance, then creates the disposable orders the pre-existing suites need
 * (an order owned by customer A, and a tagged guest order whose raw token is
 * kept only in this process's memory/env for the workers; never printed).
 */
import { request as playwrightRequest } from '@playwright/test';

export default async function globalSetup() {
  const api = `${process.env.E2E_API_ORIGIN}/api`;
  const context = await playwrightRequest.newContext();
  try {
    const probe = await context.get(`${api}/products/e2e-stock-probe`);
    if (probe.status() !== 200) throw new Error('API on the E2E port is not serving the E2E fixture catalog; refusing to run.');

    const login = await context.post(`${api}/auth/login`, { data: { email: process.env.E2E_CUSTOMER_EMAIL, password: process.env.E2E_CUSTOMER_PASSWORD } });
    if (login.status() !== 200) throw new Error(`E2E customer A login failed (${login.status()})`);
    const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };

    const product = await (await context.get(`${api}/products/glossy-white`)).json();
    const variantId = product.data.variants[0].id;
    await context.delete(`${api}/cart`, { headers });
    const add = await context.post(`${api}/cart/items`, { headers, data: { variant_id: variantId, quantity: 1 } });
    if (add.status() !== 201) throw new Error(`Seeding customer A cart failed (${add.status()})`);
    const addresses = await (await context.get(`${api}/addresses`, { headers })).json();
    const order = await context.post(`${api}/orders`, { headers, data: { shipping_address_id: addresses.data[0].id, parcelmoover_destination_id: 'e2e-kathmandu' } });
    if (order.status() !== 201) throw new Error(`Seeding customer A order failed (${order.status()})`);

    const guest = await context.post(`${api}/guest-checkout/orders`, {
      data: {
        items: [{ variant_id: variantId, quantity: 1 }],
        guest: { name: `E2E seed ${process.env.E2E_RUN_ID}`, phone: '9800000010', province: 'Bagmati', district: 'Kathmandu', municipality: 'Kathmandu', area: 'E2E seed lane', notes: `${process.env.E2E_RUN_ID} seed`, parcelmoover_destination_id: 'e2e-kathmandu' },
      },
    });
    if (guest.status() !== 201) throw new Error(`Seeding guest order failed (${guest.status()})`);
    process.env.E2E_GUEST_ORDER_TOKEN = (await guest.json()).guest_token;
    console.info(`E2E global setup | run ${process.env.E2E_RUN_ID} | seeded 1 customer order and 1 guest order`);
  } finally {
    await context.dispose();
  }
}
