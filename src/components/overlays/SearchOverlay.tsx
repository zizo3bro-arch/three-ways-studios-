import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search as SearchIcon, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '../../context/UIContext';
import { useCatalog } from '../../hooks/useCatalog';
import { colourNameFor, primaryImage } from '../../data/catalog';
import { formatEGP } from '../../lib/format';
import { useBodyScrollLock, useEscapeKey } from '../../lib/scrollLock';
import type { Product } from '../../types/database';

/* =========================================================
   SEARCH — clean, top-anchored search dropdown / overlay.
   Searches actual products by name, collection, fabric and color.
   ========================================================= */

function matchesQuery(product: Product, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const colors = (product.variants ?? []).map((v) => v.color_name).join(' ');
  const haystack = [
    product.name,
    product.slug,
    product.collection_name,
    product.category,
    product.fabric_info,
    product.description,
    colors,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

export function SearchOverlay() {
  const { overlay, closeOverlay } = useUI();
  const { products } = useCatalog();
  const navigate = useNavigate();
  const open = overlay === 'search';

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(open);
  useEscapeKey(open, closeOverlay);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setCursor(0);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  const trimmed = query.trim();
  const results = useMemo(() => {
    const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return products;
    return products.filter((product) => matchesQuery(product, terms));
  }, [products, trimmed]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const openProduct = (product: Product | undefined) => {
    if (!product) return;
    closeOverlay();
    navigate(`/product/${product.slug}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openProduct(results[cursor]);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[75]"
          role="dialog"
          aria-modal="true"
          aria-label="Search products"
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close search"
            onClick={closeOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
          />

          {/* Top-anchored Search Bar Panel */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 border-b border-black/10 bg-white shadow-xl"
          >
            <div className="mx-auto w-full max-w-[1040px] px-4 py-4 sm:px-6 sm:py-5">
              {/* Search input + clear + close row */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 flex-1 items-center gap-3 rounded-lg border border-black/15 bg-[#FAFAF8] px-3.5 transition-colors focus-within:border-crimson focus-within:bg-white">
                  <SearchIcon className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
                  <label htmlFor="tws-search-input" className="sr-only">
                    Search products by name
                  </label>
                  <input
                    ref={inputRef}
                    id="tws-search-input"
                    type="text"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search pants by name..."
                    className="h-full w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint sm:text-base"
                  />
                  {query.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        inputRef.current?.focus();
                      }}
                      className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft transition-colors hover:text-crimson"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={closeOverlay}
                  aria-label="Close search"
                  className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-black/15 px-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:border-crimson hover:bg-crimson hover:text-white sm:px-4"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>

              {/* Results header */}
              <div className="mt-4 flex items-center justify-between border-b border-black/8 pb-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  {trimmed.length > 0
                    ? `${results.length} ${results.length === 1 ? 'Product' : 'Products'} Found`
                    : 'Featured Pieces'}
                </p>
                <Link
                  to="/shop"
                  onClick={closeOverlay}
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-crimson hover:underline"
                >
                  View All
                </Link>
              </div>

              {/* Results list */}
              <div className="mt-3 max-h-[60vh] overflow-y-auto">
                {results.length > 0 ? (
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {results.map((product, index) => {
                      const img = primaryImage(product);
                      const inStock = (product.variants ?? []).some((v) => v.stock_quantity > 0);
                      const isActive = index === cursor;
                      return (
                        <li key={product.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setCursor(index)}
                            onClick={() => openProduct(product)}
                            className={[
                              'group flex w-full items-center gap-4 rounded-lg border p-2.5 text-left transition-all',
                              isActive
                                ? 'border-crimson/40 bg-[#FDF2F2]/50'
                                : 'border-black/10 bg-white hover:border-crimson/40 hover:bg-[#FAFAF8]',
                            ].join(' ')}
                          >
                            <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F7F6F3] p-1.5">
                              {img?.url ? (
                                <img
                                  src={img.url}
                                  alt={img.alt_text || product.name}
                                  className="h-full w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : null}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-crimson">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-xs text-ink-faint">
                                {colourNameFor(product)}
                              </p>
                              <div className="mt-2 flex items-center gap-3">
                                <span className="text-sm font-semibold text-ink tabular-nums">
                                  {formatEGP(product.price)}
                                </span>
                                <span
                                  className={[
                                    'text-[10px] font-semibold uppercase tracking-wider',
                                    inStock ? 'text-ink-soft' : 'text-crimson',
                                  ].join(' ')}
                                >
                                  {inStock ? 'In Stock' : 'Sold Out'}
                                </span>
                              </div>
                            </div>

                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-crimson"
                              strokeWidth={1.8}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm font-medium text-ink">
                      No products matched “{trimmed}”.
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Try searching for “Midnight”, “Wide-Flare”, or “Onyx”.
                    </p>
                    <Link
                      to="/shop"
                      onClick={closeOverlay}
                      className="tws-pill mt-4 h-10 px-5 text-[10px]"
                    >
                      Browse All Pieces
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
