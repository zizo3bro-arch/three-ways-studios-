import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { ProductPlate } from '../components/shop/ProductPlate';
import { Reveal } from '../components/ui/Reveal';
import { useCatalog } from '../hooks/useCatalog';
import { slugify } from '../lib/format';

/* =========================================================
   /collections/:slug — one collection, its pieces, its narrative.
   Unknown slugs resolve to an honest empty state with a way back.
   ========================================================= */

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { products } = useCatalog();

  const { collection, pieces } = useMemo(() => {
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
            <span className="block">is not here</span>
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

  return (
    <>
      <PageIntro
        eyebrow={`Collection — ${collection.name}`}
        sprayText={collection.name.split(' ')[0]?.toUpperCase() || 'DROP'}
        title={
          <>
            {collection.name.split('—')[0].trim()}
            {collection.name.includes('—') ? (
              <span className="block">{collection.name.split('—')[1].trim()}</span>
            ) : (
              <span className="block">the flare series</span>
            )}
          </>
        }
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

      <section className="bg-ivory py-12 sm:py-16" aria-label={`${collection.name} pieces`}>
        <div className="mx-auto w-full max-w-[1660px] px-4 sm:px-6 lg:px-10">
          <Reveal className="grid gap-4 sm:grid-cols-3" preset="soft">
            {[
              ['Cloth', '13 — 14 oz selvedge, rope-dyed indigo and onyx'],
              ['Construction', 'Single-needle seams, bar-tacked stress points'],
              ['Release', 'One run, no restock of the same cut'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.1rem] border border-ink/12 bg-paper px-5 py-4">
                <p className="tws-eyebrow text-crimson-bright">{label}</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{value}</p>
              </div>
            ))}
          </Reveal>

          <div className="mt-9 grid gap-5 sm:mt-12 md:grid-cols-2 md:gap-6 lg:gap-8">
            {pieces.map((product, index) => (
              <ProductPlate key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
