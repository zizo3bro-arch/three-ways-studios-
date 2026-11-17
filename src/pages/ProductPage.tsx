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
import { applyMeta } from '../lib/seo';

/* =========================================================
   /product/:slug — the piece, set as an editorial spread.
   Large gallery plate on the paper, purchase furniture on a
   hairline rail. Selecting a colour never repaints the page:
   the swatch is always the fixed white square and the garment
   colour is communicated as words.
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

  // The product owns its head: title, description and canonical all come from
  // the live row, so a shared product link previews the actual piece.
  useEffect(() => {
    applyMeta(
      `/product/${product?.slug ?? slug ?? ''}`,
      product
        ? {
            title: `${product.name} — THREE WAYS STUDIOS`,
            description:
              product.description?.trim() ||
              `${product.name} from Three Ways Studios — cut in Cairo, cash on delivery across Egypt.`,
            canonical: `/product/${product.slug}`,
          }
        : { title: 'Product — THREE WAYS STUDIOS' },
    );
  }, [product, slug]);

  const frames = useMemo(() => galleryImagesFor(product), [product]);
  const sizes = useMemo(() => sizeOptionsFor(product, selectedColor), [product, selectedColor]);
  const selectedVariant = useMemo(
    () => resolveVariant(product, size, selectedColor),
    [product, size, selectedColor]
  );

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
      <section className="flex min-h-[70svh] flex-col items-center justify-center px-4 pb-16 pt-32 text-center">
        <p className="tws-eyebrow text-crimson">{loading ? 'Loading' : 'Not found'}</p>
        <h1
          className="mt-4 font-display uppercase leading-[0.9] text-ink"
          style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)' }}
        >
          {loading ? 'Opening the rail…' : 'That piece is not here'}
        </h1>
        {!loading ? (
          <Link to="/shop" className="tws-pill mt-7">
            Back to the shop
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
    setSize(firstAvailableSize(product, color));
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
          ? 'Taking you to checkout…'
          : `Added ${quantity} to bag`
        : (result.message ?? 'Not available')
    );
    window.setTimeout(() => setNote(null), 2600);
  };

  return (
    <div className="pb-16">
      <div className="mx-auto w-full max-w-[1800px] px-4 pt-[92px] sm:px-6 sm:pt-[104px] lg:px-10">
        {/* breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 border-b border-ink/16 pb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
        >
          <Link to="/" className="transition-colors hover:text-crimson">
            Home
          </Link>
          <span aria-hidden="true" className="text-ink/30">
            /
          </span>
          <Link to="/shop" className="transition-colors hover:text-crimson">
            Shop
          </Link>
          <span aria-hidden="true" className="text-ink/30">
            /
          </span>
          <span className="truncate text-ink">{product.name}</span>
        </nav>

        <div className="mt-6 grid gap-9 lg:grid-cols-12 lg:gap-12">
          {/* ——— gallery ——— */}
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden bg-[rgba(23,19,15,0.045)]">
              <div className="flex aspect-[4/5] w-full items-end justify-center px-4 pt-8 sm:px-8 sm:pt-10">
                {currentFrame ? (
                  <img
                    key={currentFrame.id}
                    src={currentFrame.url}
                    alt={currentFrame.alt}
                    fetchPriority="high"
                    decoding="async"
                    className={
                      currentFrame.isEditorial
                        ? 'h-full w-full object-cover'
                        : 'h-full w-auto object-contain object-bottom'
                    }
                  />
                ) : null}
              </div>

              {currentFrame ? (
                <span className="absolute left-4 top-4 text-[9px] font-bold uppercase tracking-[0.24em] text-ink/55">
                  {currentFrame.label}
                </span>
              ) : null}

              {frames.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="Previous product image"
                    className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink/16 bg-[rgba(247,244,237,0.9)] text-ink backdrop-blur-sm transition-colors hover:border-crimson hover:text-crimson"
                  >
                    <ChevronLeft className="h-5 w-5" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="Next product image"
                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink/16 bg-[rgba(247,244,237,0.9)] text-ink backdrop-blur-sm transition-colors hover:border-crimson hover:text-crimson"
                  >
                    <ChevronRight className="h-5 w-5" strokeWidth={1.6} />
                  </button>
                  <span className="absolute bottom-4 right-4 text-[9.5px] font-bold tabular-nums tracking-[0.2em] text-ink/60">
                    {String(activeImageIdx + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}
                  </span>
                </>
              ) : null}
            </div>

            {frames.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2.5 sm:grid-cols-5" role="tablist" aria-label="Product views">
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
                        'group relative flex aspect-[3/4] items-end justify-center overflow-hidden bg-[rgba(23,19,15,0.045)] p-1.5 transition-all',
                        active ? 'outline outline-1 outline-offset-2 outline-crimson' : 'hover:opacity-80',
                      ].join(' ')}
                    >
                      <img
                        src={frame.url}
                        alt={frame.alt}
                        loading="lazy"
                        className={
                          frame.isEditorial ? 'h-full w-full object-cover' : 'h-full w-auto object-contain object-bottom'
                        }
                      />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* ——— purchase rail ——— */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <div className="flex items-baseline justify-between gap-4">
                <p className="tws-eyebrow text-crimson">
                  {product.collection_name || 'Drop 01 — 2026'}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-faint">
                  {String(product.sort_order).padStart(2, '0')}
                </p>
              </div>

              <h1
                className="mt-3 font-display uppercase leading-[0.86] tracking-[0.004em] text-ink"
                style={{ fontSize: 'clamp(2rem, 5.4vw, 3.4rem)' }}
              >
                {product.name}
              </h1>

              <div className="mt-4 flex flex-wrap items-baseline gap-3 border-b border-ink/16 pb-4">
                <p className="text-[19px] font-semibold tabular-nums text-ink">
                  {formatEGP(product.price)}
                </p>
                {discount ? (
                  <p className="text-[11px] tracking-[0.06em] text-ink-faint">
                    <span className="line-through">{formatEGP(product.original_price ?? 0)}</span>
                    <span className="ml-2 font-bold uppercase tracking-[0.16em] text-crimson">
                      Save {discount}%
                    </span>
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id)}
                  aria-pressed={saved}
                  aria-label={saved ? 'Remove from saved pieces' : 'Save this piece'}
                  className={[
                    'ml-auto flex h-9 w-9 items-center justify-center border transition-colors',
                    saved
                      ? 'border-crimson text-crimson'
                      : 'border-ink/20 text-ink-soft hover:border-crimson hover:text-crimson',
                  ].join(' ')}
                >
                  <Heart className="h-4 w-4" strokeWidth={1.8} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>

              <p className="mt-4 font-serif text-[15px] italic leading-[1.62] text-ink-soft">
                {product.description}
              </p>

              {/* colour — words, never paint */}
              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink">
                    Colour
                  </span>
                  <span className="text-[11px] tracking-[0.06em] text-ink-soft">{selectedColor}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {colors.map((color) => {
                    const active = color === selectedColor;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSelectColor(color)}
                        aria-pressed={active}
                        className={[
                          'inline-flex items-center gap-2.5 border px-3 py-2 text-[11px] font-medium transition-colors',
                          active
                            ? 'border-ink text-ink'
                            : 'border-ink/20 text-ink-soft hover:border-ink/50',
                        ].join(' ')}
                      >
                        <ColourChip />
                        <span>{color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* size */}
              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <span id="pdp-size-label" className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink">
                    Size
                  </span>
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-crimson underline underline-offset-4 transition-opacity hover:opacity-70"
                  >
                    <Ruler className="h-3.5 w-3.5" strokeWidth={2} />
                    Size guide
                  </button>
                </div>

                <div role="radiogroup" aria-labelledby="pdp-size-label" className="mt-2.5 grid grid-cols-4 gap-2">
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
                          'flex h-11 items-center justify-center border text-[11px] font-bold uppercase tracking-[0.8em] transition-all',
                          option.soldOut
                            ? 'cursor-not-allowed border-ink/10 text-ink/25 line-through'
                            : selected
                              ? 'border-ink bg-ink text-[#f7f4ed]'
                              : 'border-ink/22 text-ink hover:border-ink',
                        ].join(' ')}
                      >
                        {option.size}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <span
                    aria-hidden="true"
                    className={[
                      'h-1.5 w-1.5 rounded-full',
                      variantOutOfStock
                        ? 'bg-ink/30'
                        : variantStock <= lowThreshold
                          ? 'bg-crimson'
                          : 'bg-emerald-700',
                    ].join(' ')}
                  />
                  <span className="text-ink-soft">
                    {variantOutOfStock
                      ? `Size ${size} is out of stock`
                      : variantStock <= lowThreshold
                        ? `Low stock — ${variantStock} left in size ${size}`
                        : `In stock — ${variantStock} in size ${size}`}
                  </span>
                </div>
              </div>

              {/* buy */}
              <div className="mt-6 space-y-2.5 border-t border-ink/16 pt-5">
                <div className="flex items-stretch gap-2.5">
                  <div className="inline-flex h-[52px] items-center border border-ink/24">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || variantOutOfStock}
                      aria-label="Decrease quantity"
                      className="flex h-full w-10 items-center justify-center text-ink transition-colors hover:text-crimson disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                    <span aria-label="Quantity" className="min-w-7 text-center text-[13px] font-semibold tabular-nums text-ink">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(Math.max(1, variantStock || 10), q + 1))}
                      disabled={variantOutOfStock || (variantStock > 0 && quantity >= variantStock)}
                      aria-label="Increase quantity"
                      className="flex h-full w-10 items-center justify-center text-ink transition-colors hover:text-crimson disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdd(false)}
                    disabled={soldOut || variantOutOfStock}
                    className="tws-pill h-[52px] flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShoppingBag className="h-4 w-4" strokeWidth={1.9} />
                    {soldOut || variantOutOfStock ? 'Sold out' : (note ?? 'Add to bag')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleAdd(true)}
                  disabled={soldOut || variantOutOfStock}
                  className="tws-pill tws-pill--outline h-[52px] w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Buy now — cash on delivery
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>

                <button
                  type="button"
                  onClick={() => setFitOpen(true)}
                  className="w-full pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-faint underline-offset-4 transition-colors hover:text-crimson hover:underline"
                >
                  Find my size
                </button>
              </div>

              {/* details */}
              <div className="mt-7 border-t border-ink/16">
                {(
                  [
                    {
                      key: 'details',
                      label: 'Fabric & fit',
                      body: `${product.fit_info} ${product.fabric_info}`,
                    },
                    { key: 'care', label: 'Care', body: product.care_instructions },
                    {
                      key: 'shipping',
                      label: 'Delivery & returns',
                      body:
                        'Dispatched from Cairo in 1–2 working days. Cash on delivery across Egypt (EGP 75, free over EGP 3,500). 14-day returns, unworn with tags.',
                    },
                  ] as const
                ).map((section) => {
                  const isOpen = panel === section.key;
                  return (
                    <div key={section.key} className="border-b border-ink/14">
                      <button
                        type="button"
                        onClick={() => setPanel(isOpen ? null : section.key)}
                        aria-expanded={isOpen}
                        aria-controls={`pdp-panel-${section.key}`}
                        className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
                          {section.label}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-300 ${isOpen ? 'rotate-180 text-crimson' : ''}`}
                          strokeWidth={2}
                        />
                      </button>
                      <div id={`pdp-panel-${section.key}`} className="tws-accordion-grid" data-open={isOpen}>
                        <div className="overflow-hidden">
                          <p className="pb-4 pr-6 text-[12.5px] leading-relaxed text-ink-soft">
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

        {/* related */}
        {related.length > 0 ? (
          <section aria-label="More from the house" className="mt-16 border-t border-ink/16 pt-9 sm:mt-20">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="tws-index">Also in the drop</p>
                <h2
                  className="mt-2 font-display uppercase leading-[0.9] text-ink"
                  style={{ fontSize: 'clamp(1.5rem, 3.6vw, 2.4rem)' }}
                >
                  The other silhouette
                </h2>
              </div>
              <Link to="/shop" className="tws-link text-ink hover:text-crimson">
                View all
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
            <div className="mt-7 grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2">
              {related.map((item, index) => (
                <ProductPlate key={item.id} product={item} index={index} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

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
