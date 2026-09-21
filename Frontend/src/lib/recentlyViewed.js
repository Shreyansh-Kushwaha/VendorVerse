import { useSyncExternalStore } from 'react';

const KEY = 'vv_recent_suppliers';
const MAX = 8;

function readFromStorage() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

// Same single-store shape as favorites.js — a supplier profile visit pushes
// here, and any component reading it (the directory's "Recently viewed" rail)
// updates without its own copy of the list drifting out of sync.
let snapshot = readFromStorage();
const listeners = new Set();

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return snapshot;
}

export function noteSupplierViewed(supplier) {
  if (!supplier?.supplierId) return;
  const next = [supplier, ...snapshot.filter((s) => s.supplierId !== supplier.supplierId)].slice(0, MAX);
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((fn) => fn());
}

export function useRecentlyViewed() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
