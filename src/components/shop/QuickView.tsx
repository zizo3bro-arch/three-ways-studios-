import { Link } from 'react-router-dom';
import { useUI } from '../../context/UIContext';
import { useProduct } from '../../hooks/useCatalog';
import { primaryImage } from '../../data/catalog';
import { Overlay } from '../ui/Overlay';
import { PurchaseOptions } from './PurchaseOptions';

export function QuickView() {
  const { quickViewSlug, closeQuickView } = useUI();
  const { product, loading, error } = useProduct(quickViewSlug);
  if (!quickViewSlug) return null;
  const image = primaryImage(product);
  return (
    <Overlay open onClose={closeQuickView} label="Quick view" placement="full">
      {product ? (
        <div className="quick-view">
          <div>
            {image && <img src={image.url} alt={image.alt_text || product.name} />}
            <Link to={`/product/${product.slug}`} className="text-action">
              Open full product page
            </Link>
          </div>
          <PurchaseOptions key={product.id} product={product} onAdded={closeQuickView} />
        </div>
      ) : (
        <p role="status">{loading ? 'Loading piece…' : error || 'Piece unavailable.'}</p>
      )}
    </Overlay>
  );
}
