import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { cart as cartApi, guestCheckout } from '../api/endpoints';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const GUEST_CART_KEY = 'caseverse_guest_cart';

const EMPTY = {
  items: [],
  subtotal: 0,
  covers_qty: 0,
  bundle_discount: 0,
  campaign_active: false,
  campaign_code: null,
  campaign_label: null,
  free_items: [],
  estimated_total: 0,
  item_count: 0,
  has_stock_issue: false,
};

function readGuestLines() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_CART_KEY));
    return Array.isArray(raw) ? raw : [];
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

/**
 * Guests have no server-side cart. Each line keeps a denormalized display
 * snapshot (captured from the product page at add-time) alongside the
 * variant id; money fields are always re-priced server-side via the public
 * guest-checkout preview endpoint, never trusted from the snapshot.
 */
function shapeGuestCart(lines, priced) {
  const items = lines.map((l) => ({
    id: `guest-${l.variant_id}`,
    variant_id: l.variant_id,
    quantity: l.quantity,
    unit_price: l.unit_price,
    compare_at_price: l.compare_at_price,
    line_total: Number((l.unit_price * l.quantity).toFixed(2)),
    available_stock: l.stock_quantity,
    stock_ok: l.quantity <= l.stock_quantity,
    product: l.product,
    sku: l.sku,
  }));
  const subtotal = Number(items.reduce((s, i) => s + i.line_total, 0).toFixed(2));
  if (!priced) {
    return {
      ...EMPTY,
      items,
      subtotal,
      estimated_total: subtotal,
      item_count: items.reduce((n, i) => n + i.quantity, 0),
      has_stock_issue: items.some((i) => !i.stock_ok),
    };
  }
  return {
    items,
    subtotal: priced.subtotal,
    covers_qty: priced.covers_qty,
    bundle_discount: priced.bundle_discount,
    campaign_active: priced.campaign_active,
    campaign_code: priced.campaign_code,
    campaign_label: priced.campaign_label,
    free_items: priced.free_items,
    estimated_total: priced.total_amount - priced.shipping_amount,
    item_count: items.reduce((n, i) => n + i.quantity, 0),
    has_stock_issue: items.some((i) => !i.stock_ok),
  };
}

export function CartProvider({ children }) {
  const { isCustomer } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const guestLinesRef = useRef(readGuestLines());

  const repriceGuestCart = useCallback(async (lines) => {
    if (!lines.length) {
      setCart(EMPTY);
      return;
    }
    setCart(shapeGuestCart(lines, null));
    try {
      const { data } = await guestCheckout.preview({
        items: lines.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity })),
      });
      setCart(shapeGuestCart(lines, data));
    } catch {
      setCart(shapeGuestCart(lines, null));
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isCustomer) {
      await repriceGuestCart(guestLinesRef.current);
      return;
    }
    setLoading(true);
    try {
      const { data } = await cartApi.get();
      setCart(data);
    } finally {
      setLoading(false);
    }
  }, [isCustomer, repriceGuestCart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (variantId, quantity = 1, productSnapshot) => {
      if (!isCustomer) {
        const lines = [...guestLinesRef.current];
        const existing = lines.find((l) => l.variant_id === variantId);
        if (existing) {
          existing.quantity += quantity;
        } else {
          lines.push({ variant_id: variantId, quantity, ...productSnapshot });
        }
        guestLinesRef.current = lines;
        writeGuestLines(lines);
        await repriceGuestCart(lines);
        return cart;
      }
      const { data } = await cartApi.addItem({ variant_id: variantId, quantity });
      setCart(data);
      return data;
    },
    [isCustomer, repriceGuestCart, cart]
  );

  const updateItem = useCallback(
    async (itemId, quantity) => {
      if (!isCustomer) {
        const variantId = Number(String(itemId).replace('guest-', ''));
        let lines = guestLinesRef.current.map((l) => (l.variant_id === variantId ? { ...l, quantity } : l));
        if (quantity <= 0) lines = lines.filter((l) => l.variant_id !== variantId);
        guestLinesRef.current = lines;
        writeGuestLines(lines);
        await repriceGuestCart(lines);
        return cart;
      }
      const { data } = await cartApi.updateItem(itemId, quantity);
      setCart(data);
      return data;
    },
    [isCustomer, repriceGuestCart, cart]
  );

  const removeItem = useCallback(
    async (itemId) => {
      if (!isCustomer) {
        const variantId = Number(String(itemId).replace('guest-', ''));
        const lines = guestLinesRef.current.filter((l) => l.variant_id !== variantId);
        guestLinesRef.current = lines;
        writeGuestLines(lines);
        await repriceGuestCart(lines);
        return cart;
      }
      const { data } = await cartApi.removeItem(itemId);
      setCart(data);
      return data;
    },
    [isCustomer, repriceGuestCart, cart]
  );

  const clear = useCallback(async () => {
    if (!isCustomer) {
      guestLinesRef.current = [];
      writeGuestLines([]);
      setCart(EMPTY);
      return EMPTY;
    }
    const { data } = await cartApi.clear();
    setCart(data);
    return data;
  }, [isCustomer]);

  const value = {
    cart,
    loading,
    itemCount: cart.item_count || 0,
    refresh,
    addItem,
    updateItem,
    removeItem,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
