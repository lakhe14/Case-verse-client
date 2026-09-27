import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cart as cartApi, guestCheckout } from '../api/endpoints';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const GUEST_CART_KEY = 'caseverse_guest_cart';

const EMPTY = {
  items: [],
  subtotal: 0,
  covers_qty: 0,
  bundle_discount: 0,
  bundle_pairs: 0,
  coupon_allowed: true,
  campaign_active: false,
  campaign_code: null,
  campaign_label: null,
  free_items: [],
  estimated_total: 0,
  item_count: 0,
  has_stock_issue: false,
};

/**
 * A guest's cart is only { variant_id, quantity } pairs in localStorage.
 * Older entries also carried a display snapshot (name, price, stock); it is
 * ignored — names, images, prices and stock always come from the server.
 */
function readGuestLines() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_CART_KEY));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((l) => ({ variant_id: Number(l?.variant_id), quantity: Number(l?.quantity) }))
      .filter((l) => Number.isInteger(l.variant_id) && l.variant_id > 0 && Number.isInteger(l.quantity) && l.quantity > 0);
  } catch {
    return [];
  }
}

function writeGuestLines(lines) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(lines));
  } catch {
    // Storage unavailable (private mode, quota) — cart just won't persist across reloads.
  }
}

const guestVariantId = (itemId) => Number(String(itemId).replace('guest-', ''));

function stockError(line) {
  const error = new Error(line.available_stock > 0 ? `Only ${line.available_stock} in stock` : 'This model is sold out');
  error.code = 'insufficient_stock';
  return error;
}

export function CartProvider({ children }) {
  const { isCustomer } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const guestLinesRef = useRef(readGuestLines());
  const cartRef = useRef(EMPTY);
  // Every cart response carries a sequence number; a slower, older response
  // can never overwrite the totals of a newer one.
  const seqRef = useRef(0);
  const returnFocusRef = useRef(null);

  const apply = useCallback((seq, next) => {
    if (seq !== seqRef.current) return false;
    cartRef.current = next;
    setCart(next);
    setSyncError(null);
    return true;
  }, []);

  /** Server-prices a set of guest lines. Resolves to the priced cart, rejects on failure. */
  const priceGuestLines = useCallback(async (lines) => {
    if (!lines.length) return EMPTY;
    const { data } = await guestCheckout.cart({ items: lines });
    const missing = new Set(data.missing_variant_ids || []);
    if (missing.size) {
      const kept = guestLinesRef.current.filter((l) => !missing.has(l.variant_id));
      guestLinesRef.current = kept;
      writeGuestLines(kept);
    }
    const { missing_variant_ids, ...priced } = data;
    return priced;
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const next = isCustomer ? (await cartApi.get()).data : await priceGuestLines(guestLinesRef.current);
      apply(seq, next);
    } catch (e) {
      if (seq === seqRef.current) setSyncError(e);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [isCustomer, priceGuestLines, apply]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Replaces the guest's lines, priced by the server. A change that asks for
   * more than the server says is available is refused and the previous cart
   * stays, mirroring the signed-in cart API.
   */
  const commitGuestLines = useCallback(async (lines, grownVariantId) => {
    const seq = ++seqRef.current;
    const priced = await priceGuestLines(lines);
    const grown = grownVariantId && priced.items.find((i) => i.variant_id === grownVariantId);
    if (grown && !grown.stock_ok) throw stockError(grown);
    guestLinesRef.current = lines;
    writeGuestLines(lines);
    apply(seq, priced);
    return priced;
  }, [priceGuestLines, apply]);

  const runCustomer = useCallback(async (call) => {
    const seq = ++seqRef.current;
    const { data } = await call();
    apply(seq, data);
    return data;
  }, [apply]);

  const addItem = useCallback(async (variantId, quantity = 1) => {
    if (!isCustomer) {
      const lines = guestLinesRef.current.map((l) => ({ ...l }));
      const existing = lines.find((l) => l.variant_id === variantId);
      if (existing) existing.quantity += quantity;
      else lines.push({ variant_id: variantId, quantity });
      return commitGuestLines(lines, variantId);
    }
    return runCustomer(() => cartApi.addItem({ variant_id: variantId, quantity }));
  }, [isCustomer, commitGuestLines, runCustomer]);

  const updateItem = useCallback(async (itemId, quantity) => {
    if (!isCustomer) {
      const variantId = guestVariantId(itemId);
      const lines = guestLinesRef.current
        .map((l) => (l.variant_id === variantId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0);
      const previous = guestLinesRef.current.find((l) => l.variant_id === variantId);
      return commitGuestLines(lines, previous && quantity > previous.quantity ? variantId : null);
    }
    return runCustomer(() => cartApi.updateItem(itemId, quantity));
  }, [isCustomer, commitGuestLines, runCustomer]);

  const removeItem = useCallback(async (itemId) => {
    if (!isCustomer) {
      const variantId = guestVariantId(itemId);
      return commitGuestLines(guestLinesRef.current.filter((l) => l.variant_id !== variantId));
    }
    return runCustomer(() => cartApi.removeItem(itemId));
  }, [isCustomer, commitGuestLines, runCustomer]);

  const clear = useCallback(async () => {
    if (!isCustomer) {
      seqRef.current += 1;
      guestLinesRef.current = [];
      writeGuestLines([]);
      cartRef.current = EMPTY;
      setCart(EMPTY);
      return EMPTY;
    }
    return runCustomer(() => cartApi.clear());
  }, [isCustomer, runCustomer]);

  /**
   * Buy Now: make sure the cart holds at least `quantity` of this model, then
   * the caller goes to the normal checkout. Other items in the cart are kept
   * (checkout shows them); a model already in the cart is never doubled.
   */
  const ensureItem = useCallback(async (variantId, quantity = 1) => {
    // Read the cart as it is now, not as last rendered: the server's for a
    // customer, the stored lines for a guest (current even mid-load).
    const line = isCustomer
      ? (await cartApi.get()).data.items.find((i) => i.variant_id === variantId)
      : guestLinesRef.current.map((l) => ({ id: `guest-${l.variant_id}`, ...l })).find((l) => l.variant_id === variantId);
    if (!line) return addItem(variantId, quantity);
    if (line.quantity >= quantity) return cartRef.current;
    return updateItem(line.id, quantity);
  }, [isCustomer, addItem, updateItem]);

  // `returnTo` is the control that opened the drawer; focus goes back to it on close.
  const openDrawer = useCallback((returnTo) => {
    returnFocusRef.current = returnTo instanceof HTMLElement ? returnTo : document.activeElement;
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo(() => ({
    cart,
    loading,
    syncError,
    itemCount: cart.item_count || 0,
    refresh,
    addItem,
    updateItem,
    removeItem,
    clear,
    ensureItem,
    drawerOpen,
    openDrawer,
    closeDrawer,
    drawerReturnFocusRef: returnFocusRef,
  }), [cart, loading, syncError, refresh, addItem, updateItem, removeItem, clear, ensureItem, drawerOpen, openDrawer, closeDrawer]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
