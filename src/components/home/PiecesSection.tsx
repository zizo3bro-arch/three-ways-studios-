import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCatalog } from '../../hooks/useCatalog';
import { showCampaignPreview } from '../../lib/supabase';
import { CampaignPreview, ProductPlate } from '../shop/ProductPlate';

export function PiecesSection() {
  const { settings } = useSiteSettings();
  const { products, loading, error, retry } = useCatalog();
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
      ) : products.length ? (
        <div className="product-grid">
          {products.slice(0, 4).map((p, i) => (
            <ProductPlate key={p.id} product={p} index={i} />
          ))}
        </div>
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
          ) : (
            'No pieces published yet.'
          )}
        </p>
      )}
    </section>
  );
}
