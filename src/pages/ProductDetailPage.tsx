import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Heart, Minus, Plus, ShieldCheck, ShoppingBag } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { SmartSizeFinder } from '../components/SmartSizeFinder';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { fetchProductBySlug } from '../lib/api';
import { formatEGP, getDiscountPercent } from '../lib/format';
import type { Product } from '../types/database';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { addItem, openDrawer } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setActiveImageIndex(0);
    setQuantity(1);
    setCartError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    fetchProductBySlug(slug).then(({ product: p, related: rel, error: err }) => {
      setProduct(p);
      setRelated(rel);
      setError(err);
      if (p) {
        document.title = `${p.name} — THREE WAYS STUDIOS`;
        const firstVariant = p.variants?.find((v) => v.stock_quantity > 0) ?? p.variants?.[0];
        if (firstVariant) {
          setSelectedColor(firstVariant.color_name);
          setSelectedSize(firstVariant.size_name);
        }
      }
      setLoading(false);
    });
  }, [slug]);

  const colors = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of product?.variants ?? []) {
      if (!map.has(v.color_name)) map.set(v.color_name, v.color_hex);
    }
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [product]);

  const sizesForColor = useMemo(() => {
    const list = (product?.variants ?? []).filter(
      (v) => !selectedColor || v.color_name === selectedColor
    );
    return list;
  }, [product, selectedColor]);

  const activeVariant = useMemo(() => {
    return (
      (product?.variants ?? []).find(
        (v) => v.color_name === selectedColor && v.size_name === selectedSize
      ) ?? null
    );
  }, [product, selectedColor, selectedSize]);

  useEffect(() => {
    if (!selectedColor || sizesForColor.length === 0) return;
    const stillValid = sizesForColor.some((v) => v.size_name === selectedSize);
    if (!stillValid) {
      const firstInStock = sizesForColor.find((v) => v.stock_quantity > 0) ?? sizesForColor[0];
      setSelectedSize(firstInStock.size_name);
    }
  }, [selectedColor, sizesForColor, selectedSize]);

  useEffect(() => {
    if (activeVariant && quantity > Math.max(1, activeVariant.stock_quantity)) {
      setQuantity(Math.max(1, activeVariant.stock_quantity));
    }
  }, [activeVariant, quantity]);

  const images = product?.images ?? [];
  const activeImage = images[activeImageIndex]?.url ?? images[0]?.url ?? null;
  const discountPct = product ? getDiscountPercent(product.price, product.original_price) : null;

  const handleAddToCart = () => {
    if (!product) return;
    setCartError(null);
    if (!activeVariant) {
      setCartError('Please select an available color and size.');
      return;
    }
    if (activeVariant.stock_quantity <= 0) {
      setCartError('This variant is currently out of stock.');
      return;
    }

    const res = addItem({
      variant_id: activeVariant.id,
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image: activeImage,
      color_name: activeVariant.color_name,
      color_hex: activeVariant.color_hex,
      size_name: activeVariant.size_name,
      unit_price: product.price,
      original_price: product.original_price,
      quantity,
      max_stock: activeVariant.stock_quantity,
    });

    if (!res.ok) {
      setCartError(res.message ?? 'Could not add item.');
      return;
    }

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
    openDrawer();
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[1380px] px-5 pt-32 pb-24 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="tws-card-surface aspect-[3/4] animate-pulse rounded-[6px] border border-white/10 lg:col-span-7" />
          <div className="space-y-4 lg:col-span-5">
            <div className="h-7 w-2/3 animate-pulse bg-white/10" />
            <div className="h-5 w-1/3 animate-pulse bg-[#b30e16]/25" />
            <div className="h-32 w-full animate-pulse bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="mx-auto max-w-2xl px-5 pt-36 pb-28 text-center">
        <p className="text-xs tracking-[0.22em] text-[#d4121b] uppercase">THREE WAYS STUDIOS</p>
        <h1 className="mt-3 text-2xl font-normal text-white">
          {error ? 'Unable to Load Garment' : 'Piece Not Found'}
        </h1>
        <p className="mt-3 text-xs leading-relaxed text-[#9e9494]">
          {error ?? 'This pants silhouette may have been unpublished or moved.'}
        </p>
        <Link
          to="/#products"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-2.5 text-xs tracking-[0.18em] text-white uppercase hover:border-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Products
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1380px] px-5 pt-28 pb-24 sm:px-8 lg:px-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-[11px] tracking-[0.18em] text-[#9e9494] uppercase">
        <Link to="/" className="hover:text-white">
          Home
        </Link>
        <span>/</span>
        <Link to="/#products" className="hover:text-white">
          Women&apos;s Pants
        </Link>
        <span>/</span>
        <span className="truncate text-[#f2eded]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Left: Editorial Multi-Image Gallery */}
        <div className="lg:col-span-7">
          <div className="flex flex-col-reverse gap-4 sm:flex-row">
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto sm:w-20 sm:flex-col">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`tws-card-surface aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-[4px] border transition-all sm:w-full ${
                      idx === activeImageIndex
                        ? 'border-[#d4121b] ring-1 ring-[#d4121b]'
                        : 'border-white/12 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.alt_text || `${product.name} view ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <motion.div
              key={activeImage}
              initial={{ opacity: 0.75 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="tws-card-surface relative aspect-[3/4] flex-1 overflow-hidden rounded-[6px] border border-white/12"
            >
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-xs tracking-[0.26em] text-[#7a6e6e] uppercase">
                    THREE WAYS STUDIOS
                  </span>
                </div>
              )}

              {discountPct !== null && (
                <span className="absolute top-4 left-4 bg-[#b30e16] px-2.5 py-1 text-[10px] font-medium tracking-[0.16em] text-white uppercase">
                  -{discountPct}%
                </span>
              )}
            </motion.div>
          </div>
        </div>

        {/* Right: Garment Details, Variant Selection, Smart Size Finder */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] tracking-[0.24em] text-[#d4121b] uppercase">
                {product.collection_name} · {product.category}
              </span>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label="Toggle wishlist"
                className="flex items-center gap-1.5 text-[11px] tracking-[0.16em] text-[#cfc6c6] uppercase hover:text-white"
              >
                <Heart
                  className={`h-4 w-4 ${
                    isWishlisted(product.id) ? 'fill-[#d4121b] text-[#d4121b]' : ''
                  }`}
                />
                {isWishlisted(product.id) ? 'Saved' : 'Save'}
              </button>
            </div>

            <h1 className="mt-2 text-2xl font-normal tracking-tight text-white sm:text-3xl">
              {product.name}
            </h1>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-xl font-medium text-[#d4121b]">
                {formatEGP(product.price)}
              </span>
              {product.original_price && product.original_price > product.price && (
                <span className="text-sm text-[#786d6d] line-through">
                  {formatEGP(product.original_price)}
                </span>
              )}
            </div>
          </div>

          {/* Color Selector */}
          {colors.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] tracking-[0.18em] text-[#a99e9e] uppercase">
                Color: <span className="text-white">{selectedColor}</span>
              </p>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.name);
                      const matchIdx = images.findIndex(
                        (img) => img.color_name?.toLowerCase() === c.name.toLowerCase()
                      );
                      if (matchIdx >= 0) setActiveImageIndex(matchIdx);
                    }}
                    className={`flex items-center gap-2 border px-3 py-1.5 text-xs transition-all ${
                      selectedColor === c.name
                        ? 'border-white bg-white/8 text-white'
                        : 'border-white/15 text-[#b5aaaa] hover:border-white/40'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/25"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selector */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[11px] tracking-[0.18em] text-[#a99e9e] uppercase">
                Size: <span className="text-white">{selectedSize || 'Select'}</span>
              </p>
              {activeVariant && (
                <span
                  className={`text-[11px] ${
                    activeVariant.stock_quantity === 0
                      ? 'text-[#ff7575]'
                      : activeVariant.stock_quantity <= activeVariant.low_stock_threshold
                      ? 'text-[#e89d6b]'
                      : 'text-[#9e9494]'
                  }`}
                >
                  {activeVariant.stock_quantity === 0
                    ? 'Out of stock'
                    : activeVariant.stock_quantity <= activeVariant.low_stock_threshold
                    ? `Only ${activeVariant.stock_quantity} left`
                    : `${activeVariant.stock_quantity} in stock`}
                </span>
              )}
            </div>

            {sizesForColor.length === 0 ? (
              <p className="text-xs text-[#9e9494]">No sizes configured for this product yet.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {sizesForColor.map((variant) => {
                  const out = variant.stock_quantity <= 0;
                  const active = selectedSize === variant.size_name;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={out}
                      onClick={() => setSelectedSize(variant.size_name)}
                      className={`border py-2.5 text-xs font-medium transition-all ${
                        out
                          ? 'cursor-not-allowed border-white/10 text-[#5c5353] line-through'
                          : active
                          ? 'border-[#d4121b] bg-[#b30e16] text-white'
                          : 'border-white/20 text-[#e6dfdf] hover:border-white/55'
                      }`}
                    >
                      {variant.size_name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quantity & Add to Bag */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="inline-flex items-center justify-between border border-white/20 bg-black/30 px-2 sm:w-32">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="p-2.5 text-[#cfc6c6] hover:text-white"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-medium text-white">{quantity}</span>
              <button
                type="button"
                onClick={() =>
                  setQuantity((q) =>
                    Math.min(activeVariant ? Math.max(1, activeVariant.stock_quantity) : 1, q + 1)
                  )
                }
                disabled={!activeVariant || quantity >= activeVariant.stock_quantity}
                aria-label="Increase quantity"
                className="p-2.5 text-[#cfc6c6] hover:text-white disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!activeVariant || activeVariant.stock_quantity <= 0}
              className="flex flex-1 items-center justify-center gap-2.5 rounded-full bg-[#b30e16] px-7 py-3.5 text-xs font-medium tracking-[0.2em] text-white uppercase transition-colors hover:bg-[#d4121b] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#847878]"
            >
              {addedFeedback ? (
                <>
                  <Check className="h-4 w-4" />
                  Added to Bag
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  {activeVariant && activeVariant.stock_quantity <= 0
                    ? 'Out of Stock'
                    : 'Add to Bag'}
                </>
              )}
            </button>
          </div>

          {cartError && <p className="text-xs text-[#ff7575]">{cartError}</p>}

          {/* COD assurance */}
          <div className="flex items-center gap-2.5 border-y border-white/10 py-3 text-xs text-[#b8adad]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#d4121b]" />
            <span>Cash on Delivery (COD) available nationwide across Egypt.</span>
          </div>

          {/* Product-Specific Smart Size Finder */}
          <SmartSizeFinder
            sizeCharts={product.size_charts ?? []}
            variants={product.variants ?? []}
            selectedColor={selectedColor}
            onSelectSize={(size) => setSelectedSize(size)}
          />

          {/* Detailed Product Information */}
          <div className="space-y-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-[#c6bcbc]">
            {product.description && (
              <div>
                <h2 className="mb-1.5 text-[10px] font-medium tracking-[0.2em] text-white uppercase">
                  Editorial Notes
                </h2>
                <p className="whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {product.fabric_info && (
              <div className="border-t border-white/8 pt-3">
                <h2 className="mb-1 text-[10px] font-medium tracking-[0.2em] text-white uppercase">
                  Fabric &amp; Material
                </h2>
                <p>{product.fabric_info}</p>
              </div>
            )}

            {product.fit_info && (
              <div className="border-t border-white/8 pt-3">
                <h2 className="mb-1 text-[10px] font-medium tracking-[0.2em] text-white uppercase">
                  Fit &amp; Cut
                </h2>
                <p>{product.fit_info}</p>
              </div>
            )}

            {product.care_instructions && (
              <div className="border-t border-white/8 pt-3">
                <h2 className="mb-1 text-[10px] font-medium tracking-[0.2em] text-white uppercase">
                  Care Instructions
                </h2>
                <p>{product.care_instructions}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="mt-24 border-t border-white/10 pt-14">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xl font-normal text-white">Related Women&apos;s Pants</h2>
            <Link
              to="/#products"
              className="text-[11px] tracking-[0.18em] text-[#cfc6c6] uppercase hover:text-white"
            >
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((item, idx) => (
              <ProductCard key={item.id} product={item} index={idx} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
