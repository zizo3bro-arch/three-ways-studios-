import { ScanEye } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { Link } from 'react-router-dom';
import { primaryImage } from '../../data/catalog';
import { campaignPlates } from '../../data/campaign';
import { formatEGP } from '../../lib/format';
import type { Product } from '../../types/database';

function Plate({
  slug,
  name,
  price,
  url,
  alt,
  index,
}: {
  slug: string;
  name: string;
  price: number;
  url?: string;
  alt?: string;
  index: number;
}) {
  return (
    <Link to={`/product/${slug}`} className="product-plate">
      <div className="plate-photo">
        {url ? (
          <img src={url} alt={alt || name} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" />
        ) : (
          <span>Image unavailable</span>
        )}
      </div>
      <h3>{name}</h3>
      <p>{formatEGP(price)}</p>
    </Link>
  );
}
export function ProductPlate({ product, index }: { product: Product; index: number }) {
  const image = primaryImage(product);
  const { openQuickView } = useUI();
  return (
    <article className="plate-wrap">
      <Plate {...product} url={image?.url} alt={image?.alt_text} index={index} />
      <button
        className="plate-inspect icon-action"
        aria-label={`Quick view: ${product.name}`}
        onClick={() => openQuickView(product.slug)}
      >
        <ScanEye />
      </button>
    </article>
  );
}
export function CampaignPreview() {
  return (
    <>
      <div className="product-grid">
        {campaignPlates.map((p, index) => (
          <Plate key={p.slug} {...p} price={p.printedPrice} {...p.frames[0]} index={index} />
        ))}
      </div>
      <p className="catalog-notice">Campaign preview · live inventory is unavailable.</p>
    </>
  );
}
