import { Link } from 'react-router-dom';
import { primaryImage } from '../../data/catalog';
import { formatEGP } from '../../lib/format';
import type { Product } from '../../types/database';

/* =========================================================
   PRODUCT PLATE — clean, luxury fashion product card:
   large studio image, product name, price, subtle hover effect.
   ========================================================= */

interface ProductPlateProps {
  product: Product;
  index: number;
}

export function ProductPlate({ product, index }: ProductPlateProps) {
  const image = primaryImage(product);

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block focus-visible:outline-crimson"
    >
      <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border border-black/8 bg-[#F7F6F3] p-6 transition-colors duration-300 group-hover:border-crimson/40 sm:p-10">
        {image?.url ? (
          <img
            src={image.url}
            alt={image.alt_text ?? product.name}
            width={522}
            height={1223}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-auto object-contain transition-transform duration-500 ease-out group-hover:scale-[1.035]"
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4 px-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-ink transition-colors duration-200 group-hover:text-crimson sm:text-base">
          {product.name}
        </h3>
        <p className="shrink-0 text-sm font-semibold text-ink tabular-nums sm:text-base">
          {formatEGP(product.price)}
        </p>
      </div>
    </Link>
  );
}
