import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { ProductPlate } from '../components/shop/ProductPlate';
import { useCatalog } from '../hooks/useCatalog';

/* =========================================================
   /shop — the whole catalogue, honestly. Filter chips read from the
   real product flags (new arrival, in stock) and sort is local state.
   Set on the paper: rules instead of cards, no white panels.
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
      rows = rows.filter((product) =>
        (product.variants ?? []).some((variant) => variant.stock_quantity > 0)
      );
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
        eyebrow="The shop — Drop 01, 2026"
        sprayText="SHOP"
        title="All pieces"
        meta={`${products.length} pieces · ${inStockCount} in stock`}
        description={
          <p>
            Two silhouettes, cut once. Cash on delivery across Egypt, dispatched from the Cairo
            atelier in 1–2 working days.
          </p>
        }
        actions={
          <>
            <Link to="/collections" className="tws-pill tws-pill--outline h-11">
              Collections
            </Link>
            <Link to="/about#fit" className="tws-pill tws-pill--outline h-11">
              Size guide
            </Link>
          </>
        }
      />

      <section aria-label="Product catalogue" className="pb-16 sm:pb-20">
        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-ink/16 py-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2" role="group" aria-label="Filter pieces">
              {FILTERS.map((option) => {
                const active = option.id === filter;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option.id)}
                    className={[
                      'text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-200',
                      active
                        ? 'text-crimson underline decoration-crimson decoration-1 underline-offset-[6px]'
                        : 'text-ink-faint hover:text-ink',
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
                className="h-9 border-b border-ink/30 bg-transparent pr-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink outline-none transition-colors focus:border-crimson"
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
            <div className="mt-14 text-center">
              <p className="font-display text-[1.6rem] uppercase text-ink">
                {loading ? 'Opening the rail…' : 'Nothing in this filter'}
              </p>
              <button type="button" onClick={() => setFilter('all')} className="tws-pill mt-6 h-11">
                Show all pieces
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-6">
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
