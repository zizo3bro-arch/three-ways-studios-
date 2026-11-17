import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCatalog } from '../../hooks/useCatalog';
import { primaryImage } from '../../data/catalog';
import { formatEGP } from '../../lib/format';
import { ProductPlate } from '../shop/ProductPlate';
import { Reveal } from '../ui/Reveal';

/* =========================================================
   THE PIECES — the catalogue, set as a fashion spread.
   No cards, no frames: each piece is a photographic plate on
   the paper with its number, name and price on the baseline.
   ========================================================= */

export function PiecesSection() {
  const { products, loading } = useCatalog();
  const pieces = useMemo(() => products.slice(0, 2), [products]);
  const rest = useMemo(() => products.slice(2, 6), [products]);

  return (
    <section id="products" aria-labelledby="pieces-title" className="relative py-14 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10">
        {/* section masthead */}
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink/14 pb-6 sm:pb-7">
          <Reveal preset="soft">
            <p className="tws-index">02 / The pieces</p>
            <h2
              id="pieces-title"
              className="mt-3 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
              style={{ fontSize: 'clamp(2.1rem, 6.2vw, 4.6rem)' }}
            >
              The two silhouettes
            </h2>
          </Reveal>

          <Reveal preset="soft" delay={0.08} className="max-w-sm">
            <p className="font-serif text-[15px] italic leading-[1.55] text-ink-soft sm:text-[16.5px]">
              Cut from heavyweight selvedge in the Cairo atelier. Released once — the sizes you
              see are the sizes we have.
            </p>
            <Link to="/shop" className="tws-link mt-4 text-ink hover:text-crimson">
              All pieces
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </Reveal>
        </div>

        {pieces.length === 0 ? (
          <p className="py-20 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-ink-faint">
            {loading ? 'Opening the rail…' : 'No pieces published yet.'}
          </p>
        ) : (
          <>
            {/* the two headline pieces, monumental */}
            <div className="mt-8 grid gap-10 sm:mt-11 sm:grid-cols-2 sm:gap-6 lg:gap-10">
              {pieces.map((product, index) => (
                <Reveal key={product.id} preset="soft" delay={index * 0.08}>
                  <Link
                    to={`/product/${product.slug}`}
                    className="group block focus-visible:outline-crimson"
                  >
                    <div className="relative overflow-hidden bg-[rgba(23,19,15,0.045)]">
                      {primaryImage(product)?.url ? (
                        <div className="flex aspect-[4/5] w-full items-end justify-center px-6 pt-8 sm:px-10 sm:pt-10">
                          <img
                            src={primaryImage(product)!.url}
                            alt={primaryImage(product)?.alt_text || product.name}
                            width={522}
                            height={1223}
                            loading={index === 0 ? 'eager' : 'lazy'}
                            decoding="async"
                            className="h-full w-auto object-contain object-bottom transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
                          />
                        </div>
                      ) : null}

                      <span className="absolute left-4 top-4 text-[9.5px] font-bold uppercase tracking-[0.24em] text-ink/50 sm:left-5 sm:top-5">
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      {product.is_new_arrival ? (
                        <span className="absolute right-4 top-4 text-[9px] font-bold uppercase tracking-[0.24em] text-crimson sm:right-5 sm:top-5">
                          New
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-start justify-between gap-5 border-t border-ink/14 pt-3.5">
                      <div className="min-w-0">
                        <h3 className="font-display text-[1.15rem] uppercase leading-[1.05] tracking-[0.01em] text-ink transition-colors duration-300 group-hover:text-crimson sm:text-[1.45rem]">
                          {product.name.replace(/^The\s+/i, '')}
                        </h3>
                        <p className="mt-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                          {product.variants?.[0]?.color_name ?? product.collection_name}
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px] font-semibold tabular-nums text-ink sm:text-[14px]">
                        {formatEGP(product.price)}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>

            {/* anything beyond the two signatures, in the shop grid idiom */}
            {rest.length > 0 ? (
              <div className="mt-12 grid gap-8 border-t border-ink/14 pt-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-6">
                {rest.map((product, index) => (
                  <ProductPlate key={product.id} product={product} index={index} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
