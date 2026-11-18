import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUI } from '../../context/UIContext';
import { useProduct } from '../../hooks/useCatalog';
import { galleryImagesFor } from '../../data/catalog';
import { Overlay } from '../ui/Overlay';
import { ProductLightbox } from './ProductLightbox';
import { PurchaseOptions } from './PurchaseOptions';

export function QuickView() {
  const { quickViewSlug, closeQuickView } = useUI();
  const { product, loading, error } = useProduct(quickViewSlug);
  const [frameIndex, setFrameIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const frames = useMemo(() => (product ? galleryImagesFor(product) : []), [product]);

  if (!quickViewSlug) return null;
  const activeFrame = frames[frameIndex] ?? frames[0];

  return (
    <>
      <Overlay open onClose={closeQuickView} label="Quick view" placement="full">
        {product ? (
          <div className="quick-view">
            <div className="flex flex-col gap-3">
              {activeFrame && (
                <button
                  type="button"
                  aria-label={`Inspect ${product.name} full screen`}
                  onClick={() => setViewerOpen(true)}
                  className="cursor-zoom-in"
                >
                  <img src={activeFrame.url} alt={activeFrame.alt || product.name} />
                </button>
              )}
              <Link to={`/product/${product.slug}`} className="text-action">
                Open full product page
              </Link>
            </div>
            <PurchaseOptions
              key={product.id}
              product={product}
              onImage={(url) => {
                if (!url) return;
                const idx = frames.findIndex((frame) => frame.url === url);
                if (idx >= 0) setFrameIndex(idx);
              }}
              onAdded={closeQuickView}
            />
          </div>
        ) : (
          <p role="status">{loading ? 'Loading piece…' : error || 'Piece unavailable.'}</p>
        )}
      </Overlay>

      {product && frames.length > 0 ? (
        <ProductLightbox
          open={viewerOpen}
          frames={frames}
          index={frameIndex}
          name={product.name}
          onIndexChange={setFrameIndex}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </>
  );
}
