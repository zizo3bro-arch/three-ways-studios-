import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import { fetchPublishedProducts } from '../lib/api';
import type { Product } from '../types/database';

const FILTER_TABS = [
  { id: 'all', label: 'All Pieces' },
  { id: 'Women', label: 'Women' },
  { id: 'Men', label: 'Men' },
  { id: 'new', label: 'New Arrivals' },
  { id: 'best', label: 'Best Sellers' },
];

export function CollectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [loading, setLoading] = useState(true);

  const categoryParam = searchParams.get('category');
  const filterParam = searchParams.get('filter');
  const queryParam = searchParams.get('q') || '';

  const activeTab = categoryParam || filterParam || 'all';

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPublishedProducts().then(({ products: loaded }) => {
      if (active) {
        setProducts(loaded.length > 0 ? loaded : DEMO_PRODUCTS);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (queryParam.trim()) {
        const q = queryParam.toLowerCase();
        const matchesQuery =
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.collection_name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      if (activeTab === 'Women') return p.category === 'Women' || p.category === 'Unisex';
      if (activeTab === 'Men') return p.category === 'Men' || p.category === 'Unisex';
      if (activeTab === 'new') return p.is_new_arrival;
      if (activeTab === 'best') return p.is_best_seller;
      return true;
    });
  }, [products, activeTab, queryParam]);

  const handleTabClick = (tabId: string) => {
    const next = new URLSearchParams();
    if (queryParam) next.set('q', queryParam);
    if (tabId === 'Women' || tabId === 'Men') {
      next.set('category', tabId);
    } else if (tabId === 'new' || tabId === 'best') {
      next.set('filter', tabId);
    }
    setSearchParams(next);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-white/10 pb-8">
        <p className="text-[11px] font-semibold tracking-[0.26em] text-[#d4121b] uppercase">
          THREE WAYS STUDIOS
        </p>
        <h1 className="font-display-tall mt-1 text-4xl tracking-wide text-white uppercase sm:text-5xl">
          {queryParam ? `Search: "${queryParam}"` : '2026 Collection'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#9e9494]">
          Architectural wide-flare, super-flare, and technical streetwear silhouettes.
        </p>

        {/* Filter Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`rounded-full px-5 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition ${
                  isActive
                    ? 'bg-[#b30e16] text-white'
                    : 'border border-white/15 bg-[#0f090a] text-[#c7bcbc] hover:border-white/35 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="aspect-[3/4] animate-pulse rounded-xl bg-[#120c0d]" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-base text-[#b8adad]">No pieces matched your current filter.</p>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="mt-4 rounded-full bg-[#b30e16] px-6 py-3 text-xs font-semibold tracking-[0.2em] text-white uppercase"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
