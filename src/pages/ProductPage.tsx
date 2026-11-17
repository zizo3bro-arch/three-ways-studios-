import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  Ruler,
  ShoppingBag,
} from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog';
import { useAddToBag } from '../hooks/useAddToBag';
import { useWishlist } from '../context/WishlistContext';
import {
  colorOptionsFor,
  findProductBySlug,
  firstAvailableSize,
  galleryImagesFor,
  relatedProducts,
  resolveVariant,
  sizeOptionsFor,
  type Size,
} from '../data/catalog';
import { formatEGP, getDiscountPercent } from '../lib/format';
import { ColourChip } from '../components/ui/ColourChip';
import { ProductPlate } from '../components/shop/ProductPlate';
import { SizeGuideModal } from '../components/shop/SizeGuideModal';
import { FindSizeModal } from '../components/FindSizeModal';

/* =========================================================
   /product/:slug — Luxury Fashion Product Details Page.
   White & deep red identity. Background never changes when
   selecting a product color; swatch is always a fixed white square.
   ========================================================= */

type Panel = 'details' | 'care' | 'shipping' | null;

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { products, loading } = useCatalog();
  const addToBag = useAddToBag();
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const product = useMemo(() => findProductBySlug(products, slug), [products, slug]);
  const colors = useMemo(() => colorOptionsFor(product), [product]);

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [size, setSize] = useState<Size>('M');
  const [quantity, setQuantity] = useState<number>(1);
  const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
  const [panel, setPanel] = useState<Panel>('details');
  const [note, setNote] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);

  useEffect(() => {
    if (!product) return;
    const defaultColor = colorOptionsFor(product)[0] ?? '';
    setSelectedColor(defaultColor);
    setSize(firstAvailableSize(product, defaultColor));
    setQuantity(1);
    setActiveImageIdx(0);
    setNote(null);
  }, [product]);

  useEffect(() => {
    document.title = product
      ? `${product.name} — THREE WAYS STUDIOS`
      : 'Product — THREE WAYS STUDIOS';
  }, [product]);

  const frames = useMemo(() => galleryImagesFor(product), [product]);
  const sizes = useMemo(() => sizeOptionsFor(product, selectedColor), [product, selectedColor]);
  const selectedVariant = useMemo(
    () => resolveVariant(product, size, selectedColor),
    [product, size, selectedColor]
  );

  // Clamp quantity when stock changes on size/color switch
  useEffect(() => {
    const maxStock = selectedVariant?.stock_quantity ?? 1;
    if (maxStock > 0 && quantity > maxStock) {
      setQuantity(maxStock);
    } else if (quantity < 1) {
      setQuantity(1);
    }
  }, [selectedVariant, quantity]);

  if (!product) {
    return (
      <section className="flex min-h-[70svh] flex-col items-center justify-center bg-white px-4 pb-16 pt-28 text-center">
        <p className="tws-eyebrow text-crimson">{loading ? 'Loading' : 'Not Found'}</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">
          {loading ? 'Loading product...' : 'Product not found'}
        </h1>
        {!loading ? (
          <Link to="/shop" className="tws-pill mt-6">
            Back to Shop
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        ) : null}
      </section>
    );
  }

  const discount = getDiscountPercent(product.price, product.original_price);
  const soldOut = sizes.every((option) => option.soldOut);
  const variantStock = selectedVariant?.stock_quantity ?? 0;
  const lowThreshold = selectedVariant?.low_stock_threshold ?? 3;
  const variantOutOfStock = (product.variants?.length ?? 0) > 0 && variantStock <= 0;
  const saved = isWishlisted(product.id);
  const related = relatedProducts(products, product.slug, 2);
  const currentFrame = frames[activeImageIdx] ?? frames[0];

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    const available = firstAvailableSize(product, color);
    setSize(available);
    setQuantity(1);
  };

  const handlePrevImage = () => {
    if (frames.length <= 1) return;
    setActiveImageIdx((prev) => (prev - 1 + frames.length) % frames.length);
  };

  const handleNextImage = () => {
    if (frames.length <= 1) return;
    setActiveImageIdx((prev) => (prev + 1) % frames.length);
  };

  const handleAdd = (openCheckout = false) => {
    const result = addToBag(product, size, {
      colorName: selectedColor,
      quantity,
      openDrawer: !openCheckout,
    });
    if (result.ok && openCheckout) navigate('/checkout');
    setNote(
      result.ok
        ? openCheckout
          ? 'Taking you to checkout...'
          : `Added ${quantity} to bag`
        : (result.message ?? 'Not available')
    );
    window.setTimeout(() => setNote(null), 2600);
  };

  return (
    <div className="bg-white">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-10">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-medium text-ink-faint"
        >
          <Link to="/" className="transition-colors hover:text-crimson">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link to="/shop" className="transition-colors hover:text-crimson">
            Shop
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{product.name}</span>
        </nav>

        <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* ——— Left: Interactive Product Image Gallery ——— */}
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-lg border border-black/8 bg-[#F7F6F3]">
              <div className="flex aspect-[4/5] w-full items-center justify-center p-4 sm:p-8">
                {currentFrame ? (
                  <img
                    key={currentFrame.id}
                    src={currentFrame.url}
                    alt={currentFrame.alt}
                    fetchPriority="high"
                    decoding="async"
                    className={
                      currentFrame.isEditorial
                        ? 'h-full w-full rounded-md object-cover'
                        : 'h-full w-auto object-contain'
                    }
                  />
                ) : null}
              </div>

              {/* View label badge */}
              {currentFrame ? (
                <span className="absolute left-4 top-4 rounded-full border border-black/10 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink backdrop-blur-sm">
                  {currentFrame.label}
                </span>
              ) : null}

              {/* Gallery Prev / Next Controls */}
              {frames.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="Previous product image"
                    className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/12 bg-white/90 text-ink shadow-sm transition-colors hover:border-crimson hover:text-crimson"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="Next product image"
                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/12 bg-white/90 text-ink shadow-sm transition-colors hover:border-crimson hover:text-crimson"
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
                  </button>
                  <span className="absolute bottom-4 right-4 rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-ink-soft">
                    {activeImageIdx + 1} / {frames.length}
                  </span>
                </>
              ) : null}
            </div>

            {/* Thumbnail Strip */}
            {frames.length > 1 ? (
              <div
                className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5"
                role="tablist"
                aria-label="Product views"
              >
                {frames.map((frame, index) => {
                  const active = index === activeImageIdx;
                  return (
                    <button
                      key={frame.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-label={frame.label}
                      onClick={() => setActiveImageIdx(index)}
                      className={[
                        'group relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border bg-[#F7F6F3] p-1.5 transition-all',
                        active
                          ? 'border-crimson ring-1 ring-crimson'
                          : 'border-black/10 hover:border-black/30',
                      ].join(' ')}
                    >
                      <img
                        src={frame.url}
                        alt={frame.alt}
                        loading="lazy"
                        className={
                          frame.isEditorial
                            ? 'h-full w-full rounded-sm object-cover'
                            : 'h-full w-auto object-contain'
                        }
                      />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* ——— Right: Product Purchase Details ——— */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <p className="tws-eyebrow text-crimson">
                {product.collection_name || 'Drop 01 — 2026'}
              </p>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {product.name}
              </h1>

              {/* Price */}
              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <p className="text-xl font-semibold text-ink tabular-nums sm:text-2xl">
                  {formatEGP(product.price)}
                </p>
                {discount ? (
                  <p className="text-xs text-ink-faint">
                    <span className="line-through">{formatEGP(product.original_price ?? 0)}</span>
                    <span className="ml-2 font-bold text-crimson">Save {discount}%</span>
                  </p>
                ) : null}
              </div>

              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                {product.description}
              </p>

              {/* Color Selection — ALWAYS fixed white square swatch, background NEVER changes */}
              <div className="mt-6 border-t border-black/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink">
                    Color
                  </span>
                  <span className="text-xs font-medium text-ink-soft">{selectedColor}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  {colors.map((color) => {
                    const active = color === selectedColor;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSelectColor(color)}
                        aria-pressed={active}
                        className={[
                          'inline-flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                          active
                            ? 'border-crimson bg-[#FDF2F2]/60 text-ink'
                            : 'border-black/15 bg-white text-ink-soft hover:border-black/35',
                        ].join(' ')}
                      >
                        <ColourChip />
                        <span>{color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size Selection + Size Guide */}
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <span
                    id="pdp-size-label"
                    className="text-xs font-bold uppercase tracking-[0.14em] text-ink"
                  >
                    Size
                  </span>
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-crimson underline underline-offset-4 transition-colors hover:text-crimson-deep"
                  >
                    <Ruler className="h-3.5 w-3.5" strokeWidth={2} />
                    Size Guide
                  </button>
                </div>

                <div
                  role="radiogroup"
                  aria-labelledby="pdp-size-label"
                  className="mt-2.5 grid grid-cols-4 gap-2.5"
                >
                  {sizes.map((option) => {
                    const selected = option.size === size;
                    return (
                      <button
                        key={option.size}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={option.soldOut}
                        onClick={() => setSize(option.size as Size)}
                        className={[
                          'flex h-11 items-center justify-center rounded-md border text-xs font-bold uppercase tracking-wider transition-all',
                          option.soldOut
                            ? 'cursor-not-allowed border-black/10 bg-[#FAFAF8] text-ink/25 line-through'
                            : selected
                              ? 'border-crimson bg-crimson text-white'
                              : 'border-black/18 bg-white text-ink hover:border-crimson hover:text-crimson',
                        ].join(' ')}
                      >
                        {option.size}
                      </button>
                    );
                  })}
                </div>

                {/* Product Availability / Stock Information */}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span
                    aria-hidden="true"
                    className={[
                      'h-2 w-2 rounded-full',
                      variantOutOfStock
                        ? 'bg-ink-faint'
                        : variantStock <= lowThreshold
                          ? 'bg-crimson'
                          : 'bg-emerald-600',
                    ].join(' ')}
                  />
                  <span className="font-medium text-ink-soft">
                    {variantOutOfStock
                      ? `Size ${size} is currently out of stock`
                      : variantStock <= lowThreshold
                        ? `Low stock — only ${variantStock} left in size ${size}`
                        : `In stock — ${variantStock} available in size ${size}`}
                  </span>
                </div>
              </div>

              {/* Quantity Selector + Add to Bag */}
              <div className="mt-6 space-y-3 border-t border-black/10 pt-5">
                <div className="flex items-center gap-3">
                  {/* Quantity Stepper */}
                  <div className="inline-flex h-12 items-center rounded-full border border-black/18 bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || variantOutOfStock}
                      aria-label="Decrease quantity"
                      className="flex h-full w-11 items-center justify-center rounded-l-full text-ink transition-colors hover:text-crimson disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                    <span
                      aria-label="Quantity"
                      className="min-w-8 text-center text-sm font-semibold tabular-nums text-ink"
                    >
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(Math.max(1, variantStock || 10), q + 1))
                      }
                      disabled={variantOutOfStock || (variantStock > 0 && quantity >= variantStock)}
                      aria-label="Increase quantity"
                      className="flex h-full w-11 items-center justify-center rounded-r-full text-ink transition-colors hover:text-crimson disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                  </div>

                  {/* Add to Bag */}
                  <button
                    type="button"
                    onClick={() => handleAdd(false)}
                    disabled={soldOut || variantOutOfStock}
                    className="tws-pill h-12 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ShoppingBag className="h-4 w-4" strokeWidth={1.9} />
                    {soldOut || variantOutOfStock
                      ? 'Sold Out'
                      : note ?? `Add to Bag · ${formatEGP(product.price * quantity)}`}
                  </button>

                  {/* Wishlist */}
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    aria-pressed={saved}
                    aria-label={saved ? 'Remove from saved items' : 'Save item'}
                    className={[
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors',
                      saved
                        ? 'border-crimson bg-crimson text-white'
                        : 'border-black/18 text-ink-soft hover:border-crimson hover:text-crimson',
                    ].join(' ')}
                  >
                    <Heart
                      className="h-4 w-4"
                      strokeWidth={1.9}
                      fill={saved ? 'currentColor' : 'none'}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleAdd(true)}
                  disabled={soldOut || variantOutOfStock}
                  className="tws-pill tws-pill--outline h-12 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Buy Now — Cash on Delivery
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              {/* Clean Product Information Accordions */}
              <div className="mt-7 border-t border-black/10">
                {(
                  [
                    {
                      key: 'details',
                      label: 'Fabric & Fit',
                      body: `${product.fit_info} ${product.fabric_info}`,
                    },
                    {
                      key: 'care',
                      label: 'Care Instructions',
                      body: product.care_instructions,
                    },
                    {
                      key: 'shipping',
                      label: 'Delivery & Returns',
                      body: 'Dispatched from Cairo in 1–2 working days. Cash on delivery across Egypt (EGP 75, free over EGP 3,500). 14-day returns, unworn with tags.',
                    },
                  ] as const
                ).map((section) => {
                  const isOpen = panel === section.key;
                  return (
                    <div key={section.key} className="border-b border-black/10">
                      <button
                        type="button"
                        onClick={() => setPanel(isOpen ? null : section.key)}
                        aria-expanded={isOpen}
                        aria-controls={`pdp-panel-${section.key}`}
                        className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
                      >
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink">
                          {section.label}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-300 ${isOpen ? 'rotate-180 text-crimson' : ''}`}
                          strokeWidth={2}
                        />
                      </button>
                      <div
                        id={`pdp-panel-${section.key}`}
                        className="tws-accordion-grid"
                        data-open={isOpen}
                      >
                        <div className="overflow-hidden">
                          <p className="pb-4 text-xs leading-relaxed text-ink-soft">
                            {section.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Related Piece */}
        {related.length > 0 ? (
          <section
            aria-label="You may also like"
            className="mt-16 border-t border-black/10 pt-10 sm:mt-20"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
                You May Also Like
              </h2>
              <Link
                to="/shop"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-crimson hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:gap-10">
              {related.map((item, index) => (
                <ProductPlate key={item.id} product={item} index={index} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* Modals */}
      <SizeGuideModal
        open={sizeGuideOpen}
        product={product}
        onClose={() => setSizeGuideOpen(false)}
        onOpenFitCalculator={() => setFitOpen(true)}
      />

      <FindSizeModal
        open={fitOpen}
        currentSize={size}
        onClose={() => setFitOpen(false)}
        onApply={(recommended) => setSize(recommended)}
      />
    </div>
  );
}
