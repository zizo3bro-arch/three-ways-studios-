import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCatalog } from '../../hooks/useCatalog';
import { showCampaignPreview } from '../../lib/supabase';
import { CampaignPreview, ProductPlate } from '../shop/ProductPlate';

const PAGE_SIZE = 24;

export function PiecesSection() {
  const { settings } = useSiteSettings();
  const { products, loading, error, retry } = useCatalog();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // The homepage rail is CMS-controlled: the whole published catalog (default)
  // or only the pieces flagged "featured", capped by the configured limit.
  const mode = settings.home_collection_mode === 'featured' ? 'featured' : 'catalog';
  const source = mode === 'featured' ? products.filter((product) => product.is_featured) : products;
  const limit = Math.max(1, Math.min(48, Number(settings.home_collection_limit) || PAGE_SIZE));
  const rail = source.slice(0, Math.max(limit, 1));
  const visibleProducts = rail.slice(0, visibleCount);
  const hasMore = rail.length > visibleCount;

  return (
    <section id="products" className="page-width collection-rail" aria-labelledby="pieces-title">
      <div className="ruled-heading">
        <h2 id="pieces-title" className="section-label">
          {settings.products_heading}
        </h2>
        <i />
        <Link to="/collections">
          {settings.products_subheading} <ArrowRight />
        </Link>
      </div>
      {showCampaignPreview ? (
        <CampaignPreview />
      ) : rail.length ? (
        <>
          <div className="product-grid">
            {visibleProducts.map((p, i) => (
              <ProductPlate key={p.id} product={p} index={i} />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-9 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="tws-pill tws-pill--outline"
              >
                Load more pieces ({rail.length - visibleCount} remaining)
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="catalog-notice" role="status">
          {loading ? (
            'Opening the collection…'
          ) : error ? (
            <>
              Unable to load the collection: {error}{' '}
              <button className="text-action" onClick={retry}>
                Retry
              </button>
            </>
          ) : mode === 'featured' ? (
            'No featured pieces selected yet.'
          ) : (
            'No pieces published yet.'
          )}
        </p>
      )}
    </section>
  );
}
