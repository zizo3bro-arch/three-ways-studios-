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

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { products, loading, error, retry } = useCatalog();

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

  if (error || loading)
    return (
      <section className="empty-state">
        <h1>Collection</h1>
        <p role="status">{loading ? 'Loading…' : error}</p>
        {error && (
          <button className="text-action" onClick={retry}>
            Retry
          </button>
        )}
      </section>
    );
  if (!collection) {
    return (
      <PageIntro
        eyebrow="Collection"
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
        title={
          <>
            {headline}
            <span className="block text-crimson">{subtitle}</span>
          </>
        }
        meta={`${total} ${total === 1 ? 'release' : 'releases'} · ${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`}
        description={
          <p>
            {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}, in this release. Select a piece
            to see its available colors and sizes.
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

      <section className="pb-14 sm:pb-18" aria-label={`${collection.name} pieces`}>
        <div className="page-width">
          <div className="product-grid">
            {pieces.map((product, index) => (
              <ProductPlate key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
