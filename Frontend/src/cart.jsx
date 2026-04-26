import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth.jsx';

const CartContext = createContext(null);

function storageKey(userId) {
  return `vv_cart_${userId || 'anon'}`;
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const key = storageKey(user?._id);
  const [items, setItems] = useState([]);

  // Load cart for current user whenever the user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, [key]);

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
  }, [key, items]);

  const add = useCallback((item, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.itemId === item.itemId);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const update = useCallback((itemId, qty) => {
    setItems((prev) => prev.map((p) => (p.itemId === itemId ? { ...p, quantity: Math.max(1, qty) } : p)));
  }, []);

  const remove = useCallback((itemId) => {
    setItems((prev) => prev.filter((p) => p.itemId !== itemId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totals = useMemo(() => {
    const count = items.reduce((s, i) => s + (i.quantity || 0), 0);
    const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.price || 0), 0);
    return { count, subtotal };
  }, [items]);

  return (
    <CartContext.Provider value={{ items, add, update, remove, clear, ...totals }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
