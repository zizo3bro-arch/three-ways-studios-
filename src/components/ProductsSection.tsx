import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpDown, Heart, Plus, SlidersHorizontal } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { fetchPublishedProducts } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Product } from '../types/database';
import { ProductCard } from './ProductCard';

type FilterTab = 'all' | 'new' | 'best' | 'trending';
type SortOption = 'featured' | 'newest' | 'price_asc' | 'price_desc';

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New Arrivals' },
  { id: 'best', label: 'Best Sellers' },
  { id: 'trending', label: 'Trending' },
];

export function ProductsSection() {
  const { settings } = useSiteSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFilter = (searchParams.get('filter') as FilterTab) || 'all';
  const [activeFilter, setActiveFilter] = useState<FilterTab>(
    FILTER_TABS.some((t) => t.id === initialFilter) ? initialFilter : 'all'
  );
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const paramFilter = searchParams.get('filter') as FilterTab | null;
    if (paramFilter && FILTER_TABS.some((t) => t.id === paramFilter)) {
      setActiveFilter(paramFilter);
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchPublishedProducts().then(({ products: data, error: err }) => {
      if (!mounted) return;
      setProducts(data);
      setError(err);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleFilterChange = (tab: FilterTab) => {
    setActiveFilter(tab);
    if (tab === 'all') {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const displayedProducts = useMemo(() => {
    let list = [...products];
    if (activeFilter === 'new') list = list.filter((p) => p.is_new_arrival);
    if (activeFilter === 'best') list = list.filter((p) => p.is_best_seller);
    if (activeFilter === 'trending') list = list.filter((p) => p.is_trending);

    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else {
      list.sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return a.sort_order - b.sort_order;
      });
    }

    return list;
  }, [products, activeFilter, sortBy]);

  return (
    <section
      id="products"
      aria-labelledby="products-heading"
      className="relative mx-auto max-w-[1380px] px-5 pt-16 pb-20 sm:px-8 sm:pt-24 lg:px-12"
    >
      {/* Top hairline */}
      <div className="mb-10 h-px w-12 bg-white/35" />

      {/* Section Heading: Simple, normal, clean font (never bold/italic/oversized) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-1 items-center gap-5">
          <h2
            id="products-heading"
            className="font-sans-ui text-[26px] font-normal tracking-normal text-[#f2eded] sm:text-[30px]"
          >
            {settings.products_heading}
          </h2>
          <span className="hidden h-px flex-1 bg-white/15 sm:block" />
        </div>

        <p className="text-[10px] font-medium tracking-[0.22em] text-[#cfc6c6] uppercase sm:pl-6">
          {settings.products_subheading}
        </p>
      </motion.div>

      {/* Filter Pills + Sorting Controls */}
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5" role="tablist" aria-label="Product filters">
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleFilterChange(tab.id)}
                className={`rounded-full px-5 py-1.5 text-xs tracking-[0.06em] transition-all duration-200 ${
                  active
                    ? 'bg-[#e6dada] font-medium text-[#0c0708]'
                    : 'border border-white/20 bg-black/25 text-[#cfc6c6] hover:border-white/45 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ArrowUpDown className="h-3.5 w-3.5 text-[#9e9494]" />
          <label htmlFor="product-sort" className="sr-only">
            Sort products
          </label>
          <select
            id="product-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-full border border-white/20 bg-[#0d0708] px-4 py-1.5 text-xs text-[#e6dfdf] focus:border-[#b30e16] focus:outline-none"
          >
            <option value="featured">Sort: Featured</option>
            <option value="newest">Sort: Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Product Grid / Loading / Empty State */}
      <div className="mt-9">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {[0, 1, 2, 3].map((slot) => (
              <div key={slot} className="animate-pulse">
                <div className="tws-card-surface aspect-[3/4] rounded-[6px] border border-white/10" />
                <div className="mt-3 h-3.5 w-2/3 bg-white/10" />
                <div className="mt-2 h-3 w-1/3 bg-[#b30e16]/25" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="border border-[#b30e16]/40 bg-black/40 p-8 text-center">
            <p className="text-sm text-[#f2eded]">Unable to load products from Supabase.</p>
            <p className="mt-2 text-xs text-[#9e9494]">{error}</p>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div>
            {/* Polished editorial empty-state grid matching reference layout (no fake inventory) */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="opacity-70">
                  <div className="tws-card-surface relative flex aspect-[3/4] items-center justify-center rounded-[6px] border border-white/10">
                    <span className="absolute top-3 right-3 text-white/30">
                      <Heart className="h-4 w-4 stroke-[1.4]" />
                    </span>
                    <span className="text-[10px] tracking-[0.26em] text-[#7c6f6f] uppercase">
                      Women&apos;s Pants Slot
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#a39696]">Awaiting Studio Drop</p>
                      <p className="mt-1 text-[11px] text-[#786b6b]">Supabase Live Catalog</p>
                    </div>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-white/35">
                      <Plus className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-start justify-between gap-4 border border-white/12 bg-black/35 p-6 sm:flex-row sm:items-center">
              <div>
                <p className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-white uppercase">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#d4121b]" />
                  {!isSupabaseConfigured
                    ? 'Connect Supabase to Populate Live Products'
                    : products.length === 0
                    ? 'No Published Products in Database Yet'
                    : 'No Products Match This Filter'}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#9e9494]">
                  {!isSupabaseConfigured
                    ? 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment and run supabase/full_setup.sql, then publish women’s pants from the Admin Dashboard.'
                    : products.length === 0
                    ? 'All products load dynamically from Supabase. Sign in to the Admin Dashboard to publish your first women’s pants collection.'
                    : 'Try switching back to All to view all currently published women’s pants.'}
                </p>
              </div>
              {products.length === 0 ? (
                <Link
                  to="/admin"
                  className="shrink-0 rounded-full border border-white/25 px-5 py-2 text-[11px] tracking-[0.18em] text-white uppercase transition-colors hover:border-[#d4121b] hover:bg-[#b30e16]"
                >
                  Open Admin Dashboard
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => handleFilterChange('all')}
                  className="shrink-0 rounded-full border border-white/25 px-5 py-2 text-[11px] tracking-[0.18em] text-white uppercase transition-colors hover:border-white"
                >
                  Show All
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {displayedProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
