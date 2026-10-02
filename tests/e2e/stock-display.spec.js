/**
 * Exact-quantity PDP stock wording (src/utils/stock.js). Pure logic, no
 * browser needed: 0 => Sold out, 1-3 => "Only N left", 4+ => "N in stock".
 * Never falls back to a vague "In stock" that hides the real count.
 */
import { expect, test } from '@playwright/test';
import { stockState, LOW_STOCK_AT } from '../../src/utils/stock.js';

test.describe('stockState exact-quantity wording', () => {
  for (const n of [0, 1, 2, 3, 4, 5, 25]) {
    test(`available=${n}`, () => {
      const state = stockState(n);
      if (n <= 0) {
        expect(state).toEqual({ kind: 'out', label: 'Sold out' });
      } else if (n <= LOW_STOCK_AT) {
        expect(state).toEqual({ kind: 'low', label: `Only ${n} left` });
      } else {
        expect(state).toEqual({ kind: 'in', label: `${n} in stock` });
        expect(state.label).not.toBe('In stock');
      }
    });
  }

  test('negative, missing or non-numeric input is treated as sold out', () => {
    for (const bad of [-5, null, undefined, NaN, 'not-a-number']) {
      expect(stockState(bad)).toEqual({ kind: 'out', label: 'Sold out' });
    }
  });
});
