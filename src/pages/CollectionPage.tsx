import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { ProductPlate } from '../components/shop/ProductPlate';
import { useCatalog } from '../hooks/useCatalog';
import { slugify } from '../lib/format';

/* =========================================================
   /collections/:slug — one collection, its pieces, its narrative.
   Unknown slugs resolve to an honest empty state with a way back.
   ========================================================= */

const NOTES = [
  ['Cloth', '13 — 14 oz selvedge, rope-dyed indigo and onyx'],
  ['Construction', 'Single-needle seams, bar-tacked stress points'],
  ['Release', 'One run, no restock of the same cut'],
];

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { products } = useCatalog();

  const { collection, pieces, total } = useMemo(() => {
    const groups = new Map<string, { name: string; slug: string; items: typeof products }>();

    for (const product of products) {
      const name = product.collection_name || 'The Drop';
      const key = slugify(name);
      const group = groups.get(key) ?? { name, slug: key, items: [] as typeof products };
      group.items.push(product);
      groups.set(key, group);
    }

    const found = slug ? groups.get(slug) : undefined;
    return {
      collection: found ?? null,
      pieces: found?.items ?? [],
      total: groups.size,
    };
  }, [products, slug]);

  if (!collection) {
    return (
      <PageIntro
        eyebrow="Collection"
        sprayText="ARCHIVE"
        title={
          <>
            That collection
            <span className="block text-crimson">is not here</span>
          </>
        }
        description={<p>The reference you followed is not part of a published drop.</p>}
        actions={
          <>
            <Link to="/shop" className="tws-pill h-12">
              Go to the shop
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link to="/collections" className="tws-pill tws-pill--outline h-12">
              All collections
            </Link>
          </>
        }
      />
    );
  }

  const [headline, subtitle] = collection.name.split('—').map((part) => part.trim());

  return (
    <>
      <PageIntro
        eyebrow={`Collection — ${collection.name}`}
        sprayText={headline.toUpperCase() || 'DROP'}
        title={
          <>
            {headline}
            <span className="block text-crimson">{subtitle || 'the flare series'}</span>
          </>
        }
        meta={`${total} ${total === 1 ? 'release' : 'releases'} · ${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`}
        description={
          <p>
            {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}, cut from heavyweight
            selvedge and released once. Everything below is in the atelier now — the sizes you see
            are the sizes we have.
          </p>
        }
        actions={
          <>
            <Link to="/shop" className="tws-pill tws-pill--outline h-12">
              All pieces
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link to="/about#fit" className="tws-pill tws-pill--outline h-12">
              Sizes &amp; fit
            </Link>
          </>
        }
      />

      <section className="pb-16 sm:pb-20" aria-label={`${collection.name} pieces`}>
        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10">
          {/* the release notes, as a hairline index rather than tiles */}
          <dl className="grid border-t border-ink/16 sm:grid-cols-3 sm:gap-8">
            {NOTES.map(([label, value]) => (
              <div key={label} className="border-b border-ink/14 py-4 sm:border-b-0 sm:py-5">
                <dt className="tws-eyebrow text-crimson">{label}</dt>
                <dd className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 grid gap-x-4 gap-y-10 sm:grid-cols-2 sm:gap-x-6 lg:gap-x-8">
            {pieces.map((product, index) => (
              <ProductPlate key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
