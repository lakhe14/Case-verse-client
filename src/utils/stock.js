/**
 * Storefront stock wording. `available` is always the server's AVAILABLE
 * count for one model (physical stock minus active reservations), never raw
 * physical stock and never a product-wide total.
 *
 * The exact count is always shown: "Only N left" through LOW_STOCK_AT, then
 * "N in stock" above it. `kind` ('out'/'low'/'in') still drives styling.
 */
export const LOW_STOCK_AT = 3;

export function stockState(available) {
  const n = Number(available) || 0;
  if (n <= 0) return { kind: 'out', label: 'Sold out' };
  if (n <= LOW_STOCK_AT) return { kind: 'low', label: `Only ${n} left` };
  return { kind: 'in', label: `${n} in stock` };
}
