import { Link } from 'react-router-dom';
import { primaryImage } from '../../data/catalog';
import { formatEGP, getDiscountPercent } from '../../lib/format';
import type { Product } from '../../types/database';

/* =========================================================
   PRODUCT PLATE — a piece set on the paper.
   Photographic plate on the ivory ground, numbered, with the
   name and price on a hairline baseline. No card, no frame,
   no heavy shadow: the product carries the composition.
   ========================================================= */

interface ProductPlateProps {
  product: Product;
  index: number;
}

export function ProductPlate({ product, index }: ProductPlateProps) {
  const image = primaryImage(product);
  const discount = getDiscountPercent(product.price, product.original_price);
  const inStock = (product.variants ?? []).some((variant) => variant.stock_quantity > 0);

  return (
    <Link to={`/product/${product.slug}`} className="group block focus-visible:outline-crimson">
      <div className="relative overflow-hidden bg-[rgba(23,19,15,0.045)]">
        {image?.url ? (
          <div className="flex aspect-[4/5] w-full items-end justify-center px-5 pt-7 sm:px-8 sm:pt-9">
            <img
              src={image.url}
              alt={image.alt_text ?? product.name}
              width={522}
              height={1223}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className="h-full w-auto object-contain object-bottom transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
            />
          </div>
        ) : null}

        {product.is_new_arrival ? (
          <span className="absolute left-3.5 top-3.5 text-[9px] font-bold uppercase tracking-[0.24em] text-crimson">
            New
          </span>
        ) : null}

        {!inStock ? (
          <span className="absolute right-3.5 top-3.5 text-[9px] font-bold uppercase tracking-[0.24em] text-ink-faint">
            Sold out
          </span>
        ) : null}

        {discount ? (
          <span className="absolute bottom-3.5 left-3.5 text-[9px] font-bold uppercase tracking-[0.24em] text-crimson">
            −{discount}%
          </span>
        ) : null}
      </div>

      <div className="mt-3.5 flex items-start justify-between gap-4 border-t border-ink/14 pt-3">
        <div className="min-w-0">
          <h3 className="font-display text-[1rem] uppercase leading-[1.06] tracking-[0.01em] text-ink transition-colors duration-300 group-hover:text-crimson sm:text-[1.1rem]">
            {product.name.replace(/^The\s+/i, '')}
          </h3>
          <p className="mt-1.5 truncate text-[9.5px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            {product.variants?.[0]?.color_name ?? product.collection_name}
          </p>
        </div>
        <p className="shrink-0 text-[12px] font-semibold tabular-nums text-ink">
          {formatEGP(product.price)}
        </p>
      </div>
    </Link>
  );
}
