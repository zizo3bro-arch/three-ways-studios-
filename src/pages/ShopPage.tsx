import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageIntro } from '../components/layout/PageIntro';
import { ProductPlate } from '../components/shop/ProductPlate';
import { useCatalog } from '../hooks/useCatalog';

/* =========================================================
   /shop — the whole catalogue, honestly. Filter chips read from the
   real product flags (new arrival, in stock) and sort is local state.
   ========================================================= */

type Filter = 'all' | 'new' | 'in-stock';
type Sort = 'curated' | 'price-asc' | 'price-desc';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All pieces' },
  { id: 'new', label: 'New arrivals' },
  { id: 'in-stock', label: 'In stock' },
];

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'curated', label: 'Curated order' },
  { id: 'price-asc', label: 'Price · low to high' },
  { id: 'price-desc', label: 'Price · high to low' },
];

export function ShopPage() {
  const { products, loading } = useCatalog();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('curated');

  const visible = useMemo(() => {
    let rows = [...products];

    if (filter === 'new') rows = rows.filter((product) => product.is_new_arrival);
    if (filter === 'in-stock') {
      rows = rows.filter((product) => (product.variants ?? []).some((variant) => variant.stock_quantity > 0));
    }

    if (sort === 'price-asc') rows.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') rows.sort((a, b) => b.price - a.price);
    if (sort === 'curated') rows.sort((a, b) => a.sort_order - b.sort_order);

    return rows;
  }, [filter, products, sort]);

  const inStockCount = products.filter((product) =>
    (product.variants ?? []).some((variant) => variant.stock_quantity > 0)
  ).length;

  return (
    <>
      <PageIntro
        eyebrow="The Shop — Drop 01, 2026"
        title="All Pieces"
        description={
          <p>
            {products.length} silhouettes · {inStockCount} in stock · cash on delivery across Egypt.
          </p>
        }
        actions={
          <>
            <Link to="/collections" className="tws-pill tws-pill--outline h-11">
              Collections
            </Link>
            <Link to="/about#fit" className="tws-pill tws-pill--outline h-11">
              Size Guide
            </Link>
          </>
        }
      />

      <section className="bg-white py-10 sm:py-14" aria-label="Product catalogue">
        <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-5">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter pieces">
              {FILTERS.map((option) => {
                const active = option.id === filter;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option.id)}
                    className={[
                      'h-9 rounded-full border px-4 text-[10px] font-bold uppercase tracking-[0.16em] transition-all duration-200',
                      active
                        ? 'border-crimson bg-crimson text-white'
                        : 'border-black/15 text-ink-soft hover:border-crimson hover:text-crimson',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5">
              <label htmlFor="shop-sort" className="tws-eyebrow text-ink-faint">
                Sort
              </label>
              <select
                id="shop-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="h-9 rounded-full border border-black/15 bg-white px-3.5 text-[11px] font-semibold text-ink outline-none transition-colors focus:border-crimson"
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-12 rounded-lg border border-black/10 bg-[#FAFAF8] px-6 py-14 text-center">
              <p className="text-xl font-semibold text-ink">
                {loading ? 'Loading products...' : 'No pieces in this filter'}
              </p>
              <button type="button" onClick={() => setFilter('all')} className="tws-pill mt-6 h-11">
                Show All Pieces
              </button>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:gap-12">
              {visible.map((product, index) => (
                <ProductPlate key={product.id} product={product} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
