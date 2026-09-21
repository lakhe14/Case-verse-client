import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { cart as cartApi } from '../api/endpoints';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const EMPTY = {
  items: [],
  subtotal: 0,
  covers_qty: 0,
  bundle_discount: 0,
  estimated_total: 0,
  item_count: 0,
  has_stock_issue: false,
};

export function CartProvider({ children }) {
  const { isCustomer } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isCustomer) {
      setCart(EMPTY);
      return;
    }
    setLoading(true);
    try {
      const { data } = await cartApi.get();
      setCart(data);
    } finally {
      setLoading(false);
    }
  }, [isCustomer]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (variantId, quantity = 1) => {
    const { data } = await cartApi.addItem({ variant_id: variantId, quantity });
    setCart(data);
    return data;
  }, []);

  const updateItem = useCallback(async (itemId, quantity) => {
    const { data } = await cartApi.updateItem(itemId, quantity);
    setCart(data);
    return data;
  }, []);

  const removeItem = useCallback(async (itemId) => {
    const { data } = await cartApi.removeItem(itemId);
    setCart(data);
    return data;
  }, []);

  const clear = useCallback(async () => {
    const { data } = await cartApi.clear();
    setCart(data);
    return data;
  }, []);

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
