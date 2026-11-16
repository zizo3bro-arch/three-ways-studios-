import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Ruler, ShoppingBag, X } from 'lucide-react';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import { formatEGP, getDiscountPercent } from '../lib/format';
import { useBodyScrollLock, useEscapeKey } from '../lib/scrollLock';
import { FindSizeModal } from './FindSizeModal';

type Size = 'S' | 'M' | 'L' | 'XL';
const SIZES: Size[] = ['S', 'M', 'L', 'XL'];

interface ProductDetailsViewProps {
  open: boolean;
  activeIndex: number;
  size: Size;
  onSizeChange: (size: Size) => void;
  onColorChange: (index: number) => void;
  onClose: () => void;
  onBuyNow: (size: Size) => boolean;
}

type AccordionKey = 'details' | 'care';

const COLORWAYS = DEMO_PRODUCTS.map((product, index) => {
  const variant = product.variants?.[0];
  const fullName = variant?.color_name ?? product.name;
  return {
    index,
    fullName,
    shortName: fullName.split(' ').slice(-1)[0],
    hex: variant?.color_hex ?? '#201d1a',
  };
});

export function ProductDetailsView({
  open,
  activeIndex,
  size,
  onSizeChange,
  onColorChange,
  onClose,
  onBuyNow,
}: ProductDetailsViewProps) {
  const [openSection, setOpenSection] = useState<AccordionKey | null>('details');
  const [findSizeOpen, setFindSizeOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const product = DEMO_PRODUCTS[activeIndex];
  const discount = getDiscountPercent(product.price, product.original_price);
  const stockFor = (candidate: Size) =>
    product.variants?.find((variant) => variant.size_name === candidate)?.stock_quantity ?? 0;

  useBodyScrollLock(open);
  useEscapeKey(open && !findSizeOpen, onClose);

  useEffect(() => {
    if (!open) {
      setFindSizeOpen(false);
      return;
    }
    const timer = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const toggleSection = (key: AccordionKey) => {
    setOpenSection((current) => (current === key ? null : key));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close product details"
        onClick={onClose}
        className="tws-fade-in absolute inset-0 cursor-default bg-[#08070a]/72"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tws-details-title"
        className="tws-panel-in relative z-10 flex h-[100svh] w-full max-w-5xl flex-col overflow-hidden border-ink/10 bg-[#FFFFFF] text-ink sm:h-auto sm:max-h-[92svh] sm:rounded-[1.75rem] sm:border"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-ink/10 bg-[#FFFFFF] px-5 py-4 sm:px-7">
          <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-crimson">
            Drop 01 · Product details
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/20 bg-white text-ink transition-colors duration-200 hover:border-ink hover:bg-ink hover:text-white"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain md:grid-cols-2">
          {/* ——— Visual (Clean White Studio Backdrop) ——— */}
          <div className="relative flex items-center justify-center overflow-hidden border-b border-ink/10 bg-[#FFFFFF] px-6 py-8 md:min-h-[520px] md:border-r md:border-b-0">
            <div
              aria-hidden="true"
              className="tws-white-floor-shadow absolute bottom-7 left-1/2 h-11 w-[62%] -translate-x-1/2 rounded-[100%]"
            />
            <img
              src={product.images?.[0]?.url}
              alt={product.images?.[0]?.alt_text ?? product.name}
              draggable={false}
              className="relative h-[36vh] max-h-[420px] w-auto object-contain md:h-[54vh] md:max-h-[460px]"
            />
            <p className="absolute bottom-4 left-5 text-[8px] font-semibold uppercase tracking-[0.32em] text-ink-faint">
              {product.collection_name}
            </p>
          </div>

          {/* ——— Info ——— */}
          <div className="flex flex-col bg-[#fbfaf7] px-5 py-6 sm:px-7 sm:py-8">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-ink-faint">
              {product.category} · {product.is_new_arrival ? 'New arrival' : 'Signature'}
            </p>
            <h2
              id="tws-details-title"
              className="mt-2 font-display text-[2rem] uppercase leading-[0.95] sm:text-[2.4rem]"
            >
              {product.name}
            </h2>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-display text-2xl tracking-[0.01em] text-ink">
                {formatEGP(product.price)}
              </p>
              {discount && (
                <>
                  <p className="text-sm text-ink-faint line-through">
                    {formatEGP(product.original_price ?? 0)}
                  </p>
                  <p className="rounded-full bg-crimson-bright px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white">
                    Save {discount}%
                  </p>
                </>
              )}
            </div>

            {/* Colours */}
            <div className="mt-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-ink-soft">
                Colour · <span className="text-ink">{COLORWAYS[activeIndex]?.fullName}</span>
              </p>
              <div role="radiogroup" aria-label="Available colours" className="mt-2.5 flex items-center gap-2">
                {COLORWAYS.map((colorway) => {
                  const selected = colorway.index === activeIndex;
                  return (
                    <button
                      key={colorway.index}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={colorway.fullName}
                      onClick={() => onColorChange(colorway.index)}
                      className={[
                        'flex h-10 items-center gap-2 rounded-full border-2 pl-1.5 pr-3.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors duration-200',
                        selected
                          ? 'border-ink bg-ink text-white'
                          : 'border-ink/20 bg-white text-ink-soft hover:border-ink/45 hover:text-ink',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden="true"
                        className="h-6 w-6 rounded-full ring-1 ring-inset ring-white/30"
                        style={{ backgroundColor: colorway.hex }}
                      />
                      {colorway.shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sizes */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-ink-soft">
                  Size · <span className="text-ink">{size}</span>
                </p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-ink-faint">S — XL</p>
              </div>
              <div role="radiogroup" aria-label="Available sizes" className="mt-2.5 flex items-center gap-2">
                {SIZES.map((candidate) => {
                  const selected = candidate === size;
                  const stock = stockFor(candidate);
                  const soldOut = stock <= 0;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Size ${candidate}${soldOut ? ' — sold out' : ''}`}
                      disabled={soldOut}
                      onClick={() => onSizeChange(candidate)}
                      className={[
                        'h-11 w-11 rounded-full border-2 text-[11px] font-bold tracking-wide transition-colors duration-200',
                        selected
                          ? 'border-ink bg-ink text-white'
                          : soldOut
                            ? 'cursor-not-allowed border-ink/10 text-ink/25'
                            : 'border-ink/20 bg-white text-ink-soft hover:border-ink/50 hover:text-ink',
                      ].join(' ')}
                    >
                      {candidate}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setFindSizeOpen(true)}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-ink transition-colors duration-200 hover:border-ink hover:bg-ink hover:text-white"
              >
                <Ruler className="h-3.5 w-3.5" strokeWidth={2} />
                Find size
              </button>
            </div>

            {/* Buy now — fixed geometry, crisp white text */}
            <button
              type="button"
              onClick={() => onBuyNow(size)}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-crimson-bright text-[11px] font-bold uppercase tracking-[0.26em] text-white transition-colors duration-200 hover:bg-crimson-deep active:bg-crimson-deep"
            >
              <ShoppingBag className="h-4 w-4" strokeWidth={2} />
              Buy now — {size}
            </button>
            <p className="mt-2.5 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Cash on delivery · Egypt-wide · Free over EGP 3,500
            </p>

            {/* Accordions */}
            <div className="mt-6 border-t border-ink/15">
              {(
                [
                  {
                    key: 'details' as AccordionKey,
                    label: 'Details',
                  },
                  {
                    key: 'care' as AccordionKey,
                    label: 'Shipping & Care',
                  },
                ] as const
              ).map(({ key, label }) => {
                const isOpen = openSection === key;
                return (
                  <div key={key} className="border-b border-ink/15">
                    <button
                      type="button"
                      onClick={() => toggleSection(key)}
                      aria-expanded={isOpen}
                      aria-controls={`tws-accordion-${key}`}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-ink">
                        {label}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className={[
                          'h-4 w-4 shrink-0 text-ink-soft transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                          isOpen ? 'rotate-90' : 'rotate-0',
                        ].join(' ')}
                        strokeWidth={2}
                      />
                    </button>
                    <div
                      id={`tws-accordion-${key}`}
                      className="tws-accordion-grid"
                      data-open={isOpen}
                    >
                      <div className="overflow-hidden">
                        <div className="pb-4 text-[13px] leading-relaxed text-ink-soft">
                          {key === 'details' ? (
                            <div className="space-y-3">
                              <p>{product.description}</p>
                              <p className="text-[11px] uppercase leading-relaxed tracking-[0.14em] text-ink">
                                {product.fit_info}
                              </p>
                              <p className="text-[11px] uppercase leading-relaxed tracking-[0.14em] text-ink-faint">
                                {product.fabric_info}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p>{product.care_instructions}</p>
                              <p>
                                Dispatched from our Cairo atelier in 1–2 working days. Cash on
                                delivery nationwide in 2–5 days; standard shipping EGP 75 (free over
                                EGP 3,500).
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <FindSizeModal
        open={findSizeOpen}
        currentSize={size}
        onClose={() => setFindSizeOpen(false)}
        onApply={onSizeChange}
      />
    </div>
  );
}
