import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { Reveal } from '../components/ui/Reveal';
import { useCatalog } from '../hooks/useCatalog';
import { imagesOf } from '../data/catalog';
import { slugify } from '../lib/format';
import { formatEGP } from '../lib/format';
import { SmokeField } from '../components/ui/SmokeField';

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

      <section className="relative isolate bg-ivory py-12 sm:py-16">
        <SmokeField variant="soft" opacity="low" />

        <div className="relative z-10 mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
          {collections.length === 0 ? (
            <p className="py-16 text-center text-[12px] font-bold uppercase tracking-[0.28em] text-ink-faint">
              No collections published yet.
            </p>
          ) : (
            <ul className="space-y-5 sm:space-y-7">
              {collections.map((collection, index) => (
                <Reveal as="li" key={collection.slug} preset="soft" delay={index * 0.08}>
                  <Link
                    to={`/collections/${collection.slug}`}
                    className="group grid gap-5 overflow-hidden rounded-[1.4rem] border border-ink/12 bg-paper p-4 transition-shadow duration-500 hover:shadow-plate sm:p-5 lg:grid-cols-12 lg:items-center lg:gap-8"
                  >
                    <span className="relative flex aspect-[522/560] items-end justify-center overflow-hidden rounded-[1rem] border border-ink/10 bg-ivory/50 lg:col-span-3 lg:aspect-[522/620]">
                      {collection.image ? (
                        <img
                          src={collection.image}
                          alt={collection.imageAlt}
                          loading={index === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-[92%] w-auto object-contain object-bottom transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </span>

                    <span className="lg:col-span-6">
                      <span className="tws-eyebrow block text-crimson-bright">
                        Collection 0{index + 1} · {collection.count} {collection.count === 1 ? 'piece' : 'pieces'}
                      </span>
                      <span className="mt-3 block font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(1.9rem,5vw,3.4rem)] transition-colors duration-300 group-hover:text-crimson-bright">
                        {collection.name}
                      </span>
                      <span className="mt-3 block max-w-xl text-[13px] leading-relaxed text-ink-soft">
                        Hand-cut in the Cairo atelier from 13–14 oz selvedge. Sizes S — XL, one
                        run only — the pattern is not repeated once the cloth is finished.
                      </span>
                    </span>

                    <span className="flex items-center justify-between gap-4 lg:col-span-3 lg:flex-col lg:items-end">
                      <span className="text-right">
                        <span className="tws-eyebrow block text-ink-faint">From</span>
                        <span className="mt-1 block font-display text-[1.6rem] leading-none tracking-[0.01em] text-ink">
                          {formatEGP(collection.fromPrice)}
                        </span>
                        {collection.toPrice !== collection.fromPrice ? (
                          <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                            to {formatEGP(collection.toPrice)}
                          </span>
                        ) : null}
                      </span>
                      <span className="tws-pill h-12 pointer-events-none">
                        View the drop
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
