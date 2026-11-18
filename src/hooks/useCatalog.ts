import { useEffect, useState, useSyncExternalStore } from 'react';
import { fetchPublishedProducts, fetchProductBySlug } from '../lib/api';
import type { Product } from '../types/database';

// One shared store. A failed or empty response never substitutes a sellable sample SKU.
type State = { products: Product[]; loading: boolean; error: string | null };
let state: State = { products: [], loading: true, error: null };
let pending: Promise<void> | undefined;
let lastFetch = 0;
const listeners = new Set<() => void>();
const listen = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const snapshot = () => state;
function publish(next: State) {
  state = next;
  listeners.forEach((fn) => fn());
}
export function refreshCatalog() {
  if (pending) return pending;
  publish({ ...state, loading: true, error: null });
  pending = fetchPublishedProducts()
    .then((result) => {
      lastFetch = Date.now();
      publish({ ...result, loading: false });
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
export function useCatalog() {
  const data = useSyncExternalStore(listen, snapshot, snapshot);
  useEffect(() => {
    if (Date.now() - lastFetch > 60_000) void refreshCatalog();
  }, []);
  return { ...data, retry: refreshCatalog };
}

export function useProduct(slug = '') {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    slug: string;
    product: Product | null;
    error: string | null;
  }>();
  useEffect(() => {
    const abort = new AbortController();
    if (slug)
      void fetchProductBySlug(slug, abort.signal).then((response) => {
        if (!abort.signal.aborted) setResult({ slug, ...response });
      });
    return () => abort.abort();
  }, [slug, attempt]);
  const match = result?.slug === slug ? result : null;
  return {
    product: match?.product,
    loading: !match,
    error: match?.error,
    retry: () => {
      setResult(undefined);
      setAttempt((n) => n + 1);
    },
  };
}
