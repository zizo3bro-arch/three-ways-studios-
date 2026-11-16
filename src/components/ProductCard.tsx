import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';
import type { Product } from '../types/database';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, openDrawer } = useCart();
  const [added, setAdded] = useState(false);

  const primaryImage =
    product.images?.find((img) => img.is_primary)?.url ||
    product.images?.[0]?.url ||
    '/images/prod-obsidian-flare.jpg';

  const activeVariants = (product.variants ?? []).filter((v) => v.is_active && v.stock_quantity > 0);
  const availableSizes = Array.from(new Set(activeVariants.map((v) => v.size_name)));
  const firstVariant = activeVariants[0] ?? product.variants?.[0];

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!firstVariant) return;

    addItem({
      product_id: product.id,
      variant_id: firstVariant.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image: primaryImage,
      color_name: firstVariant.color_name,
      color_hex: firstVariant.color_hex,
      size_name: firstVariant.size_name,
      unit_price: product.price,
      original_price: product.original_price ?? null,
      quantity: 1,
      max_stock: Math.max(1, firstVariant.stock_quantity),
    });

    setAdded(true);
    openDrawer();
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0c0809] transition duration-300 hover:border-[#b30e16]/60">
      <Link to={`/products/${product.slug}`} className="relative aspect-[3/4] overflow-hidden bg-[#140d0f]">
        <img
          src={primaryImage}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060405]/70 via-transparent to-transparent opacity-60" />

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.is_new_arrival && (
            <span className="rounded-full bg-[#b30e16] px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-white uppercase">
              New
            </span>
          )}
          {product.is_best_seller && !product.is_new_arrival && (
            <span className="rounded-full border border-white/20 bg-black/75 px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] text-[#f2eded] uppercase backdrop-blur-sm">
              Best Seller
            </span>
          )}
        </div>

        {/* Quick Add Button */}
        {firstVariant && (
          <button
            type="button"
            onClick={handleQuickAdd}
            aria-label={`Quick add ${product.name} (${firstVariant.size_name}) to bag`}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/80 px-3.5 py-2 text-[10px] font-semibold tracking-[0.18em] text-white uppercase backdrop-blur-md transition hover:border-[#d4121b] hover:bg-[#b30e16] active:scale-95"
          >
            {added ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Added
              </>
            ) : (
              <>
                <ShoppingBag className="h-3.5 w-3.5" />
                Quick Add ({firstVariant.size_name})
              </>
            )}
          </button>
        )}
      </Link>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-[0.2em] text-[#9e9494] uppercase">
              {product.category} · {product.collection_name}
            </span>
          </div>

          <Link to={`/products/${product.slug}`} className="mt-1.5 block">
            <h3 className="text-sm font-semibold text-white transition group-hover:text-[#d4121b] sm:text-base">
              {product.name}
            </h3>
          </Link>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-white">{formatPrice(product.price)}</span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-xs text-[#7d7272] line-through">
                {formatPrice(product.original_price)}
              </span>
            )}
          </div>

          {availableSizes.length > 0 && (
            <div className="flex items-center gap-1">
              {availableSizes.slice(0, 4).map((size) => (
                <span
                  key={size}
                  className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-medium text-[#c7bcbc]"
                >
                  {size}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
