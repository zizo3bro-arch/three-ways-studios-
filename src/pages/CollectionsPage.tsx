import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CampaignPreview, ProductPlate } from '../components/shop/ProductPlate';
import { showCampaignPreview } from '../lib/supabase';
import { PageIntro } from '../components/layout/PageIntro';
import { useCatalog } from '../hooks/useCatalog';
import { formatEGP, slugify } from '../lib/format';
import type { Product } from '../types/database';

/* =========================================================
   /collections — every active release and all published pieces
   within it, read dynamically from Supabase (products.collection_name).
   ========================================================= */

interface CollectionGroup {
  name: string;
  slug: string;
  products: Product[];
  fromPrice: number;
  toPrice: number;
}

export function CollectionsPage() {
  const { products, loading, error, retry } = useCatalog();

  const collections = useMemo<CollectionGroup[]>(() => {
    const grouped = new Map<string, CollectionGroup>();

    for (const product of products) {
      const name = product.collection_name || 'The Drop';
      const slug = slugify(name);
      const existing = grouped.get(slug);

      if (existing) {
        existing.products.push(product);
        existing.fromPrice = Math.min(existing.fromPrice, product.price);
        existing.toPrice = Math.max(existing.toPrice, product.price);
        continue;
      }

      grouped.set(slug, {
        name,
        slug,
        products: [product],
        fromPrice: product.price,
        toPrice: product.price,
      });
    }

    return Array.from(grouped.values()).sort((a, b) => b.products.length - a.products.length);
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
        meta={`${products.length} ${products.length === 1 ? 'piece' : 'pieces'} · ${collections.length} ${collections.length === 1 ? 'release' : 'releases'}`}
        description={
          <p>
            Explore every active piece across Three Ways Studios releases.
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
            <div className="space-y-14">
              {collections.map((collection, index) => (
                <div key={collection.slug} className="border-t border-ink/16 pt-7 sm:pt-9">
                  <div className="flex flex-wrap items-end justify-between gap-5 border-b border-ink/14 pb-6">
                    <div>
                      <p className="tws-eyebrow text-crimson">
                        Release {String(index + 1).padStart(2, '0')} · {collection.products.length}{' '}
                        {collection.products.length === 1 ? 'piece' : 'pieces'}
                      </p>
                      <h2
                        className="mt-2 font-display uppercase leading-[0.9] tracking-[0.005em] text-ink"
                        style={{ fontSize: 'clamp(1.85rem, 4vw, 3.1rem)' }}
                      >
                        <Link
                          to={`/collections/${collection.slug}`}
                          className="transition-colors hover:text-crimson"
                        >
                          {collection.name}
                        </Link>
                      </h2>
                    </div>

                    <div className="flex items-baseline gap-6">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft tabular-nums">
                        {collection.fromPrice === collection.toPrice
                          ? formatEGP(collection.fromPrice)
                          : `${formatEGP(collection.fromPrice)} — ${formatEGP(collection.toPrice)}`}
                      </span>
                      <Link
                        to={`/collections/${collection.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-ink transition-colors hover:text-crimson"
                      >
                        Release page
                        <ArrowRight className="h-4 w-4" strokeWidth={2} />
                      </Link>
                    </div>
                  </div>

                  <div className="product-grid">
                    {collection.products.map((product, productIdx) => (
                      <ProductPlate key={product.id} product={product} index={productIdx} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
