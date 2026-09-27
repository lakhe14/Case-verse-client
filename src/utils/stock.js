/**
 * Storefront stock wording. `available` is always the server's AVAILABLE
 * count for one model (physical stock minus active reservations), never raw
 * physical stock and never a product-wide total.
 *
 * Most models are stocked 1–6 units, so an exact count is only shown once 3
 * or fewer remain; above that the page just says "In stock".
 */
export const LOW_STOCK_AT = 3;

export function stockState(available) {
  const n = Number(available) || 0;
  if (n <= 0) return { kind: 'out', label: 'Sold out' };
  if (n <= LOW_STOCK_AT) return { kind: 'low', label: `Only ${n} left` };
  return { kind: 'in', label: 'In stock' };
}
