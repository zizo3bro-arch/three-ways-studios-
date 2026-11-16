import { useEffect, useState } from 'react';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import { fetchPublishedProducts } from '../lib/api';
import type { Product } from '../types/database';

/* =========================================================
   useCatalog — real product data with a sane offline path.
   Supabase rows win when configured; the studio-shot demo
   records are the fallback so the site is never empty.
   Module-level cache = one network round-trip per page load.
   ========================================================= */

let cache: Product[] | null = null;
let inflight: Promise<Product[]> | null = null;

export function useCatalog() {
  const [products, setProducts] = useState<Product[]>(cache ?? (DEMO_PRODUCTS as Product[]));
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache) {
      setProducts(cache);
      setLoading(false);
      return;
    }

    let alive = true;

    const load = async () => {
      if (!inflight) {
        inflight = fetchPublishedProducts().then(({ products: rows }) => {
          cache = rows;
          return rows;
        });
      }
      const rows = await inflight;
      if (alive) {
        setProducts(rows);
        setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  return { products, loading };
}
