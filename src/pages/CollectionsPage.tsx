import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CampaignPreview } from '../components/shop/ProductPlate';
import { showCampaignPreview } from '../lib/supabase';
import { PageIntro } from '../components/layout/PageIntro';
import { useCatalog } from '../hooks/useCatalog';
import { imagesOf } from '../data/catalog';
import { formatEGP, slugify } from '../lib/format';

/* =========================================================
   /collections — the drop structure, read from the real product
   records (products.collection_name). One route per collection,
   so the page is never a decorative grid of dead tiles.
   Presented as a printed index: number, plate, title, price.
   ========================================================= */

interface CollectionSummary {
  name: string;
  slug: string;
  count: number;
  image: string | null;
  imageAlt: string;
  fromPrice: number;
  toPrice: number;
}

export function CollectionsPage() {
  const { products, loading, error, retry } = useCatalog();

  const collections = useMemo<CollectionSummary[]>(() => {
    const grouped = new Map<string, CollectionSummary>();

    for (const product of products) {
      const name = product.collection_name || 'The Drop';
      const slug = slugify(name);
      const image = imagesOf(product)[0];
      const existing = grouped.get(slug);

      if (existing) {
        existing.count += 1;
        existing.fromPrice = Math.min(existing.fromPrice, product.price);
        existing.toPrice = Math.max(existing.toPrice, product.price);
        continue;
      }

      grouped.set(slug, {
        name,
        slug,
        count: 1,
        image: image?.url ?? null,
        imageAlt: image?.alt_text ?? `${name} — campaign plate`,
        fromPrice: product.price,
        toPrice: product.price,
      });
    }

    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [products]);

  return (
    <>
      <PageIntro
        eyebrow="Collections"
        title={
          <>
            The drop
            <span className="block text-crimson">structure</span>
          </>
        }
        meta={`${collections.length} ${collections.length === 1 ? 'release' : 'releases'}`}
        description={
          <p>
            Explore Three Ways Studios by collection. Each release brings its own cuts, cloth and
            finishing details.
          </p>
        }
      />

      <section className="pb-14 sm:pb-18">
        <div className="page-width">
          {showCampaignPreview ? (
            <CampaignPreview />
          ) : error ? (
            <p role="alert" className="catalog-notice">
              {error}{' '}
              <button className="text-action" onClick={retry}>
                Retry
              </button>
            </p>
          ) : collections.length === 0 ? (
            <p className="py-20 text-center text-[10px] font-bold uppercase tracking-[0.24em] text-ink-faint">
              {loading ? 'Loading collections…' : 'No collections published yet.'}
            </p>
          ) : (
            <ul className="border-t border-ink/16">
              {collections.map((collection, index) => (
                <li key={collection.slug}>
                  <Link
                    to={`/collections/${collection.slug}`}
                    className="group grid items-center gap-6 border-b border-ink/14 py-7 transition-colors duration-300 hover:border-ink/40 lg:grid-cols-12 lg:gap-9 lg:py-9"
                  >
                    <span className="hidden text-[10px] font-bold uppercase tracking-[0.22em] text-ink-faint lg:col-span-1 lg:block">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <span className="relative block aspect-[16/9] overflow-hidden  lg:col-span-3 lg:aspect-[4/3]">
                      {collection.image ? (
                        <img
                          src={collection.image}
                          alt={collection.imageAlt}
                          loading={index === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-full w-full object-contain mix-blend-multiply transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </span>

                    <span className="lg:col-span-5">
                      <span className="tws-eyebrow block text-crimson">
                        Release {String(index + 1).padStart(2, '0')} · {collection.count}{' '}
                        {collection.count === 1 ? 'piece' : 'pieces'}
                      </span>
                      <span
                        className="mt-2.5 block font-display uppercase leading-[0.9] tracking-[0.005em] text-ink transition-colors duration-300 group-hover:text-crimson"
                        style={{ fontSize: 'clamp(1.9rem, 4.2vw, 3.3rem)' }}
                      >
                        {collection.name}
                      </span>
                      <span className="mt-3 block max-w-xl font-serif text-[16px] italic leading-relaxed text-ink-soft">
                        Explore the pieces in this release.
                      </span>
                    </span>

                    <span className="flex items-end justify-between gap-4 lg:col-span-3 lg:flex-col lg:items-end lg:justify-center lg:gap-3">
                      <span className="text-right">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                          From
                        </span>
                        <span className="mt-1 block text-[18px] font-semibold tabular-nums text-ink">
                          {formatEGP(collection.fromPrice)}
                        </span>
                        {collection.toPrice !== collection.fromPrice ? (
                          <span className="mt-0.5 block text-xs text-ink-faint tabular-nums">
                            to {formatEGP(collection.toPrice)}
                          </span>
                        ) : null}
                      </span>
                      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink transition-colors group-hover:text-crimson">
                        View
                        <ArrowRight
                          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                          strokeWidth={2}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
