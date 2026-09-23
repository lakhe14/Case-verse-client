import { expect } from '@playwright/test';
import { API, bearer } from './session.js';

/**
 * Records the QA customer's server cart before a test and puts it back
 * afterwards: lines the test added are removed, and quantities the test
 * changed are restored. Nothing else in the account is touched.
 */
export async function snapshotCart(request, session) {
  const response = await request.get(`${API}/cart`, { headers: bearer(session) });
  expect(response.status(), 'QA cart snapshot').toBe(200);
  const { data } = await response.json();
  return new Map(data.items.map((item) => [item.variant_id, item.quantity]));
}

export async function restoreCart(request, session, before) {
  const response = await request.get(`${API}/cart`, { headers: bearer(session) });
  expect(response.status(), 'QA cart read for cleanup').toBe(200);
  const { data } = await response.json();
  const changes = { removed: 0, restored: 0 };
  for (const item of data.items) {
    const original = before.get(item.variant_id);
    if (original === undefined) {
      const removed = await request.delete(`${API}/cart/items/${item.id}`, { headers: bearer(session) });
      expect(removed.status(), 'QA cart line removal').toBe(200);
      changes.removed += 1;
    } else if (original !== item.quantity) {
      const restored = await request.put(`${API}/cart/items/${item.id}`, { headers: bearer(session), data: { quantity: original } });
      expect(restored.status(), 'QA cart quantity restore').toBe(200);
      changes.restored += 1;
    }
  }
  return changes;
}
