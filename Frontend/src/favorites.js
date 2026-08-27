import { useSyncExternalStore } from 'react';

const KEY = 'vv_favorites';

function readFromStorage() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
  catch { return new Set(); }
}

// One store for the whole app. The dashboard and a supplier profile used to keep
// their own copies, so favouriting in one place did not show up in the other.
let snapshot = readFromStorage();
const listeners = new Set();

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return snapshot;
}

export function toggleFavorite(supplierId) {
  const next = new Set(snapshot);
  if (next.has(supplierId)) next.delete(supplierId);
  else next.add(supplierId);

  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch {}
  listeners.forEach((fn) => fn());
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    favorites,
    isFavorite: (id) => favorites.has(id),
    toggle: toggleFavorite,
  };
}
