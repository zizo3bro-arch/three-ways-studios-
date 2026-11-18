import { useMemo } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import type { Product } from '../../types/database';
import { ProductPlate } from './ProductPlate';

export function ProductRecommendations({ product }: { product: Product }) {
  const { products } = useCatalog();
  const recommendations = useMemo(
    () =>
      products
        .filter((piece) =>
          piece.id !== product.id && piece.variants?.some((v) => v.is_active && v.stock_quantity > 0)
        )
        .map((piece) => ({
          piece,
          relevance:
            Number(!!product.collection_name && piece.collection_name === product.collection_name) +
            Number(!!product.category && piece.category === product.category),
        }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 4),
    [products, product]
  );

  if (!recommendations.length) return null;
  return (
    <section className="page-width product-recommendations" aria-labelledby="recommendations-title">
      <div className="ruled-heading">
        <h2 id="recommendations-title" className="section-label">
          YOU MAY ALSO LIKE
        </h2>
        <i aria-hidden="true" />
      </div>
      <div className="product-grid">
        {recommendations.map(({ piece }) => (
          <ProductPlate key={piece.id} product={piece} />
        ))}
      </div>
    </section>
  );
}
