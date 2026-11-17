import { Link } from 'react-router-dom';
import { useCatalog } from '../../hooks/useCatalog';
import { primaryImage } from '../../data/catalog';
import { formatEGP } from '../../lib/format';

/* =========================================================
   PRODUCTS — immediately after the hero, two-column desktop /
   responsive mobile grid showing only large studio images,
   product name, and price with subtle hover effects.
   ========================================================= */

export function PiecesSection() {
  const { products, loading } = useCatalog();
  const pieces = products.slice(0, 2);

  return (
    <section
      id="products"
      aria-label="Products"
      className="bg-white py-10 sm:py-14 lg:py-16"
    >
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10">
        {pieces.length === 0 ? (
          <p className="py-16 text-center text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">
            {loading ? 'Loading products...' : 'No products available.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:gap-12">
            {pieces.map((product, index) => {
              const image = primaryImage(product);
              return (
                <Link
                  key={product.id}
                  to={`/product/${product.slug}`}
                  className="group block focus-visible:outline-crimson"
                >
                  <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border border-black/8 bg-[#F7F6F3] p-6 transition-colors duration-300 group-hover:border-crimson/40 sm:p-10">
                    {image?.url ? (
                      <img
                        src={image.url}
                        alt={image.alt_text || product.name}
                        width={522}
                        height={1223}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="h-full w-auto object-contain transition-transform duration-500 ease-out group-hover:scale-[1.035]"
                      />
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-baseline justify-between gap-4 px-0.5">
                    <h2 className="text-sm font-semibold tracking-tight text-ink transition-colors duration-200 group-hover:text-crimson sm:text-base">
                      {product.name}
                    </h2>
                    <p className="shrink-0 text-sm font-semibold text-ink tabular-nums sm:text-base">
                      {formatEGP(product.price)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
