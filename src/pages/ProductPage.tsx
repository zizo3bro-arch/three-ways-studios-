import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProductGallery } from '../components/shop/ProductGallery';
import { PurchaseOptions } from '../components/shop/PurchaseOptions';
import { useProduct } from '../hooks/useCatalog';
import { campaignPlates } from '../data/campaign';
import { galleryImagesFor } from '../data/catalog';
import { isSupabaseConfigured } from '../lib/supabase';
import { formatEGP } from '../lib/format';
import { applyMeta } from '../lib/seo';

export function ProductPage() {
  const { slug } = useParams();
  const { product, loading, error, retry } = useProduct(slug);
  const plate = !isSupabaseConfigured ? campaignPlates.find((p) => p.slug === slug) : undefined;
  const [chosenImage, setImage] = useState<string>();
  const frames = useMemo(
    () => (product ? galleryImagesFor(product) : (plate?.frames ?? [])),
    [product, plate]
  );
  const name = product?.name ?? plate?.name;
  useEffect(() => {
    applyMeta(`/product/${slug}`, {
      title: `${name || 'Product'} — THREE WAYS STUDIOS`,
      description: product?.description || 'Three Ways Studios, Cairo.',
      canonical: product ? `/product/${slug}` : null,
      noindex: !product,
      image: frames[0]?.url,
    });
  }, [product, slug, name, frames]);
  if (!name)
    return (
      <section className="empty-state">
        <h1>{loading ? 'Loading piece…' : error ? 'Collection unavailable' : 'Piece not found'}</h1>
        {error && (
          <p role="alert">
            {error}{' '}
            <button className="text-action" onClick={retry}>
              Retry
            </button>
          </p>
        )}
        <Link className="tws-pill" to="/shop">
          Back to shop
        </Link>
      </section>
    );
  return (
    <article className="page-width piece-spread">
      <ProductGallery key={slug} name={name} frames={frames} chosenImage={chosenImage} />
      {product ? (
        <PurchaseOptions key={product.id} product={product} onImage={setImage} />
      ) : (
        plate && (
          <div className="purchase">
            <div className="piece-title">
              <h1>{name}</h1>
            </div>
            <p className="piece-price">{formatEGP(plate.printedPrice)}</p>
            <p className="piece-description">
              From the 2026 campaign. Live sizes and inventory are unavailable; this preview is not
              available to order.
            </p>
            <Link to="/collections" className="text-action">
              View collection
            </Link>
          </div>
        )
      )}
    </article>
  );
}
