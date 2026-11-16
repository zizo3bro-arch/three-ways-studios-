import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageIntro } from '../components/layout/PageIntro';
import { ProductPlate } from '../components/shop/ProductPlate';
import { Reveal } from '../components/ui/Reveal';
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
        eyebrow="The shop — Drop 01, 2026"
        sprayText="SHOP"
        title={
          <>
            All pieces
            <span className="block">nothing else</span>
          </>
        }
        description={
          <p>
            Two silhouettes, cut in Cairo and released in small runs. {products.length} pieces ·{' '}
            {inStockCount} in stock right now · cash on delivery across Egypt.
          </p>
        }
        actions={
          <>
            <Link to="/collections" className="tws-pill tws-pill--outline h-12">
              The collection
            </Link>
            <Link to="/about#fit" className="tws-pill tws-pill--outline h-12">
              Sizes &amp; fit
            </Link>
          </>
        }
      />

      <section className="bg-ivory py-10 sm:py-14" aria-label="Product catalogue">
        <div className="mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/12 pb-5">
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
                      'h-9 rounded-full border px-3.5 text-[9.5px] font-bold uppercase tracking-[0.18em] transition-all duration-300',
                      active
                        ? 'border-ink bg-ink text-ivory'
                        : 'border-ink/18 text-ink-soft hover:border-ink hover:text-ink',
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
                className="h-9 rounded-full border border-ink/18 bg-paper px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink outline-none transition-colors focus:border-crimson-bright"
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
            <div className="mt-14 rounded-[1.4rem] border border-ink/12 bg-paper px-6 py-14 text-center">
              <p className="font-display text-2xl uppercase leading-tight text-ink">
                {loading ? 'Loading the drop…' : 'No pieces in this filter'}
              </p>
              <p className="mx-auto mt-2.5 max-w-md text-[13px] leading-relaxed text-ink-soft">
                The house keeps the catalogue deliberately small. Clear the filter to see both
                silhouettes.
              </p>
              <button type="button" onClick={() => setFilter('all')} className="tws-pill mt-6 h-12">
                Show all pieces
              </button>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:mt-10 md:grid-cols-2 md:gap-6 lg:gap-8">
              {visible.map((product, index) => (
                <ProductPlate key={product.id} product={product} index={index} />
              ))}
            </div>
          )}

          <Reveal className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-3" preset="soft">
            {[
              ['Delivery', 'Dispatched from the Cairo atelier in 1–2 working days, nationwide in 2–5.'],
              ['Payment', 'Cash on delivery across Egypt. Free shipping over EGP 3,500.'],
              ['Returns', '14 days from delivery, unworn with tags. Pickup covered in Greater Cairo.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-[1.1rem] border border-ink/12 bg-paper px-5 py-5">
                <p className="tws-eyebrow text-crimson-bright">{title}</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{copy}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </>
  );
}
