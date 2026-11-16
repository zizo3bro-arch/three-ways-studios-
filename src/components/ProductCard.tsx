import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Heart, Plus, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { formatEGP, getDiscountPercent } from '../lib/format';
import type { Product, ProductVariant } from '../types/database';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const variants = product.variants ?? [];
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of variants) {
      if (!map.has(v.color_name)) {
        map.set(v.color_name, v.color_hex);
      }
    }
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [variants]);

  const [selectedColor, setSelectedColor] = useState<string>(colors[0]?.name ?? '');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [addedPulse, setAddedPulse] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const primaryImage = useMemo(() => {
    const imgs = product.images ?? [];
    if (selectedColor) {
      const colorMatch = imgs.find(
        (img) => img.color_name?.toLowerCase() === selectedColor.toLowerCase()
      );
      if (colorMatch) return colorMatch.url;
    }
    return imgs[0]?.url ?? null;
  }, [product.images, selectedColor]);

  const hoverImage = useMemo(() => {
    const imgs = product.images ?? [];
    if (imgs.length < 2) return null;
    const alt = imgs.find((img) => img.url !== primaryImage);
    return alt?.url ?? null;
  }, [product.images, primaryImage]);

  const availableForColor = useMemo(() => {
    if (!selectedColor) return variants;
    return variants.filter((v) => v.color_name === selectedColor);
  }, [variants, selectedColor]);

  const totalStock = useMemo(
    () => variants.reduce((sum, v) => sum + v.stock_quantity, 0),
    [variants]
  );

  const discountPct = getDiscountPercent(product.price, product.original_price);
  const wishlisted = isWishlisted(product.id);

  const handleQuickVariantAdd = (variant: ProductVariant) => {
    setQuickError(null);
    if (variant.stock_quantity <= 0) {
      setQuickError('Selected size is out of stock.');
      return;
    }
    const res = addItem({
      variant_id: variant.id,
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image: primaryImage,
      color_name: variant.color_name,
      color_hex: variant.color_hex,
      size_name: variant.size_name,
      unit_price: product.price,
      original_price: product.original_price,
      quantity: 1,
      max_stock: variant.stock_quantity,
    });

    if (!res.ok) {
      setQuickError(res.message ?? 'Could not add item.');
      return;
    }

    setAddedPulse(true);
    setQuickAddOpen(false);
    setTimeout(() => setAddedPulse(false), 1600);
  };

  const handleOpenQuickAdd = () => {
    setQuickError(null);
    if (variants.length === 1 && variants[0].stock_quantity > 0) {
      handleQuickVariantAdd(variants[0]);
      return;
    }
    setQuickAddOpen((prev) => !prev);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.06, 0.3) }}
      className="group relative flex flex-col"
    >
      {/* Portrait Product Frame */}
      <div className="tws-card-surface relative aspect-[3/4] w-full overflow-hidden rounded-[6px] border border-white/10">
        <Link to={`/products/${product.slug}`} className="block h-full w-full">
          {primaryImage ? (
            <>
              <img
                src={primaryImage}
                alt={product.name}
                loading="lazy"
                className={`h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.04] ${
                  hoverImage ? 'group-hover:opacity-0' : ''
                }`}
              />
              {hoverImage && (
                <img
                  src={hoverImage}
                  alt={`${product.name} alternate view`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-[10px] tracking-[0.28em] text-[#7a6e6e] uppercase">
                THREE WAYS STUDIOS
              </span>
            </div>
          )}

          {/* Soft bottom gradient for subtle depth */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
        </Link>

        {/* Discount or Sold Out Indicator */}
        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5">
          {discountPct !== null && (
            <span className="bg-[#b30e16]/95 px-2 py-0.5 text-[10px] font-medium tracking-[0.14em] text-white uppercase">
              -{discountPct}%
            </span>
          )}
          {totalStock === 0 && variants.length > 0 && (
            <span className="border border-white/20 bg-black/75 px-2 py-0.5 text-[10px] tracking-[0.14em] text-[#cfc6c6] uppercase">
              Sold Out
            </span>
          )}
        </div>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-[#e6dfdf] transition-colors hover:bg-black/65 hover:text-white"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              wishlisted ? 'fill-[#d4121b] text-[#d4121b]' : 'stroke-[1.6]'
            }`}
          />
        </button>

        {/* Quick Add Inline Selector Panel */}
        <AnimatePresence>
          {quickAddOpen && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-2.5 bottom-2.5 z-20 border border-white/15 bg-[#0b0607]/96 p-3 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] font-medium tracking-[0.18em] text-[#cfc6c6] uppercase">
                  Quick Add
                </span>
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(false)}
                  aria-label="Close quick add"
                  className="text-[#8e8383] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {colors.length > 1 && (
                <div className="mt-2.5">
                  <p className="mb-1.5 text-[10px] tracking-[0.14em] text-[#9e9494] uppercase">
                    Color: <span className="text-white">{selectedColor}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {colors.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedColor(c.name)}
                        title={c.name}
                        className={`h-5 w-5 rounded-full border transition-transform ${
                          selectedColor === c.name
                            ? 'scale-110 border-white ring-1 ring-[#d4121b]'
                            : 'border-white/25 opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2.5">
                <p className="mb-1.5 text-[10px] tracking-[0.14em] text-[#9e9494] uppercase">
                  Select Size
                </p>
                {availableForColor.length === 0 ? (
                  <p className="text-[11px] text-[#9e9494]">No active sizes available.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {availableForColor.map((variant) => {
                      const out = variant.stock_quantity <= 0;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={out}
                          onClick={() => handleQuickVariantAdd(variant)}
                          className={`border py-1.5 text-[11px] font-medium transition-colors ${
                            out
                              ? 'cursor-not-allowed border-white/8 text-[#5c5353] line-through'
                              : 'border-white/20 text-[#f2eded] hover:border-[#d4121b] hover:bg-[#b30e16] hover:text-white'
                          }`}
                        >
                          {variant.size_name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {quickError && <p className="mt-2 text-[10px] text-[#ff6b6b]">{quickError}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Product Info Footer */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/products/${product.slug}`}
            className="block truncate text-[13px] font-medium text-[#f2eded] transition-colors hover:text-white"
          >
            {product.name}
          </Link>

          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="font-medium text-[#d4121b]">{formatEGP(product.price)}</span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-[#6e6464] line-through">
                {formatEGP(product.original_price)}
              </span>
            )}
          </div>

          {colors.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              {colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c.name)}
                  aria-label={`Select color ${c.name}`}
                  title={c.name}
                  className={`h-3 w-3 rounded-full border transition-all ${
                    selectedColor === c.name
                      ? 'border-white scale-110'
                      : 'border-white/25 opacity-65 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Add Circular + Button */}
        <button
          type="button"
          onClick={handleOpenQuickAdd}
          disabled={totalStock === 0 && variants.length > 0}
          aria-label={`Quick add ${product.name}`}
          title={totalStock === 0 && variants.length > 0 ? 'Sold out' : 'Quick Add'}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
            addedPulse
              ? 'border-[#d4121b] bg-[#b30e16] text-white'
              : 'border-white/25 text-[#e6dfdf] hover:border-white hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35'
          }`}
        >
          {addedPulse ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
    </motion.article>
  );
}
