import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { useCatalog } from '../hooks/useCatalog';
import { imagesOf } from '../data/catalog';
import { slugify } from '../lib/format';
import { formatEGP } from '../lib/format';

/* =========================================================
   /collections — the drop structure, read from the real product
   records (products.collection_name). One route per collection,
   so the page is never a decorative grid of dead tiles.
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

function summarise(collections: CollectionSummary[]) {
  return collections;
}

export function CollectionsPage() {
  const { products } = useCatalog();

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

    return summarise(Array.from(grouped.values()).sort((a, b) => b.count - a.count));
  }, [products]);

  return (
    <>
      <PageIntro
        eyebrow="Collections"
        sprayText="COLLECTIONS"
        title={
          <>
            The drop
            <span className="block">structure</span>
          </>
        }
        description={
          <p>
            We release one drop at a time and let it stand. Each collection is a single argument
            about the leg — cut, cloth and hem, nothing else.
          </p>
        }
      />

      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-10">
          {collections.length === 0 ? (
            <p className="py-16 text-center text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">
              No collections published yet.
            </p>
          ) : (
            <ul className="space-y-6">
              {collections.map((collection, index) => (
                <li key={collection.slug}>
                  <Link
                    to={`/collections/${collection.slug}`}
                    className="group grid gap-6 overflow-hidden rounded-lg border border-black/10 bg-[#FAFAF8] p-5 transition-all duration-300 hover:border-crimson/40 hover:bg-white lg:grid-cols-12 lg:items-center lg:gap-8"
                  >
                    <span className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border border-black/8 bg-[#F7F6F3] p-4 lg:col-span-3">
                      {collection.image ? (
                        <img
                          src={collection.image}
                          alt={collection.imageAlt}
                          loading={index === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-full w-auto object-contain transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : null}
                    </span>

                    <span className="lg:col-span-6">
                      <span className="tws-eyebrow block text-crimson">
                        Collection 0{index + 1} · {collection.count} {collection.count === 1 ? 'piece' : 'pieces'}
                      </span>
                      <span className="mt-2 block text-2xl font-semibold tracking-tight text-ink transition-colors group-hover:text-crimson sm:text-3xl">
                        {collection.name}
                      </span>
                      <span className="mt-2.5 block max-w-xl text-sm leading-relaxed text-ink-soft">
                        Heavyweight selvedge denim in wide-flare and super-flare silhouettes. Sizes S — XL.
                      </span>
                    </span>

                    <span className="flex items-center justify-between gap-4 lg:col-span-3 lg:flex-col lg:items-end">
                      <span className="text-right">
                        <span className="tws-eyebrow block text-ink-faint">From</span>
                        <span className="mt-1 block text-xl font-semibold text-ink tabular-nums">
                          {formatEGP(collection.fromPrice)}
                        </span>
                        {collection.toPrice !== collection.fromPrice ? (
                          <span className="mt-0.5 block text-xs text-ink-faint tabular-nums">
                            to {formatEGP(collection.toPrice)}
                          </span>
                        ) : null}
                      </span>
                      <span className="tws-pill pointer-events-none h-11">
                        View Collection
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
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
