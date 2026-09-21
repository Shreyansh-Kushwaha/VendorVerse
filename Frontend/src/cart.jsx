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

  // Load cart for current user whenever the user changes. Signing in swaps the
  // key from 'anon' to the account's — fold whatever a guest was carrying into
  // the account cart once, then forget the anon bucket so it can't be merged
  // again or read stale from another tab.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      let next = raw ? JSON.parse(raw) : [];

      if (user?._id) {
        const guestRaw = localStorage.getItem(storageKey());
        const guestItems = guestRaw ? JSON.parse(guestRaw) : [];
        if (guestItems.length > 0) {
          const merged = next.slice();
          for (const gi of guestItems) {
            const idx = merged.findIndex((p) => p.itemId === gi.itemId);
            if (idx >= 0) merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + gi.quantity };
            else merged.push(gi);
          }
          next = merged;
          localStorage.removeItem(storageKey());
        }
      }

      setItems(next);
    } catch {
      setItems([]);
    }
  }, [key, user?._id]);

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
