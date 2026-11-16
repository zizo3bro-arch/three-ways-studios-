import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Facebook,
  Instagram,
  MoveHorizontal,
  Twitter,
  Youtube,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import { getDiscountPercent } from '../lib/format';
import { ProductDetailsView } from './ProductDetailsView';

const SIZES = ['S', 'M', 'L', 'XL'] as const;
type Size = (typeof SIZES)[number];

interface ShowcaseMeta {
  headlineTop: string;
  headlineBottom: string;
  blurb: string;
  scriptLine: string;
  capsLine: string;
}

const SHOWCASE_META: ShowcaseMeta[] = [
  {
    headlineTop: 'MIDNIGHT',
    headlineBottom: 'WIDE-FLARE',
    blurb:
      'Raw midnight selvedge, cut with a sculpted high rise and a sweeping wide-flare. Heavyweight, silent, architectural.',
    scriptLine: 'the midnight hour, tailored',
    capsLine: 'RAW SELVEDGE · WIDE-FLARE · 14 OZ',
  },
  {
    headlineTop: 'ONYX',
    headlineBottom: 'SUPER-FLARE',
    blurb:
      'Onyx black denim with a sculptural rise and an exaggerated super-flare sweep. Matte, monumental — the last look of the night.',
    scriptLine: 'gravity, worn as a silhouette',
    capsLine: 'ONYX BLACK · SUPER-FLARE · 13 OZ',
  },
];

const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/threewaysstudios', Icon: Instagram },
  { label: 'Facebook', href: 'https://www.facebook.com/threewaysstudios', Icon: Facebook },
  { label: 'YouTube', href: 'https://www.youtube.com/@threewaysstudios', Icon: Youtube },
  { label: 'Twitter / X', href: 'https://www.twitter.com/threewaysstudio', Icon: Twitter },
];

const COUNT = DEMO_PRODUCTS.length;
const SLIDE_SHIFT = 100 / COUNT;
const SWIPE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function ProductsSection() {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [size, setSize] = useState<Size>('M');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const suppressClickRef = useRef(false);
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    dx: 0,
    axis: 'none' as 'none' | 'x' | 'y',
    startTime: 0,
  });

  activeRef.current = active;

  const product = DEMO_PRODUCTS[active];
  const meta = SHOWCASE_META[active];
  const discount = getDiscountPercent(product.price, product.original_price);

  /** Write the track transform straight to the DOM — no React state during the gesture. */
  const paintTrack = useCallback((offsetPx: number, index: number, animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform 620ms ${SWIPE_EASING}`
      : 'none';
    track.style.transform = `translate3d(calc(${-(index * SLIDE_SHIFT)}% + ${offsetPx}px), 0px, 0px)`;
  }, []);

  useEffect(() => {
    paintTrack(0, active, true);
  }, [active, paintTrack]);

  const goTo = useCallback((nextIndex: number) => {
    const normalized = ((nextIndex % COUNT) + COUNT) % COUNT;
    setActive(normalized);
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-no-swipe]')) return;

    const drag = dragRef.current;
    drag.active = true;
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.dx = 0;
    drag.axis = 'none';
    drag.startTime = performance.now();

    const track = trackRef.current;
    if (track) track.style.transition = 'none';

    try {
      if (!stageRef.current?.hasPointerCapture?.(event.pointerId)) {
        stageRef.current?.setPointerCapture?.(event.pointerId);
      }
    } catch {
      // capture is a nicety, never a requirement
    }
    stageRef.current?.classList.add('is-dragging');
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.axis === 'none') {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        drag.axis = 'x';
      } else if (Math.abs(dy) > 10) {
        // Vertical intent — hand the gesture back to native scrolling.
        drag.active = false;
        stageRef.current?.classList.remove('is-dragging');
        paintTrack(0, activeRef.current, true);
        return;
      }
    }

    if (drag.axis !== 'x') return;

    const stageWidth = stageRef.current?.offsetWidth || 320;
    const clamped = Math.max(-stageWidth, Math.min(stageWidth, dx));
    drag.dx = clamped;
    paintTrack(clamped, activeRef.current, false);
  }, [paintTrack]);

  const resetDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;

      const elapsed = performance.now() - drag.startTime;
      const stageWidth = stageRef.current?.offsetWidth || 320;
      const travelled = Math.abs(drag.dx);
      const velocity = travelled / Math.max(elapsed, 1);

      drag.active = false;
      drag.pointerId = -1;
      stageRef.current?.classList.remove('is-dragging');
      try {
        if (stageRef.current?.hasPointerCapture?.(event.pointerId)) {
          stageRef.current.releasePointerCapture(event.pointerId);
        }
      } catch {
        // pointer already released by the browser
      }

      if (drag.axis !== 'x') return;

      // A real drag must never be mistaken for a tap.
      if (travelled > 8) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 280);
      }

      if (!commit) {
        paintTrack(0, activeRef.current, true);
        return;
      }

      const shouldAdvance = travelled > Math.max(56, stageWidth * 0.18) || velocity > 0.45;
      if (shouldAdvance) {
        goTo(drag.dx < 0 ? activeRef.current + 1 : activeRef.current - 1);
      } else {
        paintTrack(0, activeRef.current, true);
      }
    },
    [goTo, paintTrack]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => resetDrag(event, true),
    [resetDrag]
  );

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => resetDrag(event, false),
    [resetDrag]
  );

  const handleStageClick = useCallback(() => {
    if (suppressClickRef.current) return;
    setDetailsOpen(true);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(activeRef.current + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(activeRef.current - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setDetailsOpen(true);
      }
    },
    [goTo]
  );

  const handleBuyNow = useCallback(
    (targetSize: Size) => {
      const selected = DEMO_PRODUCTS[activeRef.current];
      const variant =
        selected.variants?.find((v) => v.size_name === targetSize) ?? selected.variants?.[0];
      if (!variant) return false;
      const result = addItem({
        variant_id: variant.id,
        product_id: selected.id,
        product_name: selected.name,
        product_slug: selected.slug,
        product_image: selected.images?.[0]?.url ?? null,
        color_name: variant.color_name,
        color_hex: variant.color_hex,
        size_name: variant.size_name,
        unit_price: selected.price,
        original_price: selected.original_price,
        quantity: 1,
        max_stock: variant.stock_quantity,
      });
      if (!result.ok) return false;

      // Buy now → straight to checkout with the piece in the bag.
      setDetailsOpen(false);
      window.setTimeout(() => navigate('/checkout'), 60);
      return true;
    },
    [addItem, navigate]
  );

  return (
    <section
      id="products"
      aria-label="Products — Drop 01"
      className="relative px-3 pb-16 pt-10 sm:px-5 sm:pb-20 lg:px-8 lg:pb-24"
    >
      <div className="relative mx-auto max-w-[1560px] overflow-hidden rounded-[1.75rem] ring-1 ring-black/60 sm:rounded-[2.5rem] lg:h-[80vh] lg:min-h-[660px] lg:max-h-[880px]">
        {/* Ambient backdrop layers — opacity-only crossfade on the GPU */}
        <div
          aria-hidden="true"
          className={`tws-showcase-navy absolute inset-0 transition-opacity duration-700 ease-out ${active === 0 ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          aria-hidden="true"
          className={`tws-showcase-onyx absolute inset-0 transition-opacity duration-700 ease-out ${active === 1 ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* Soft central spotlight pools behind the garment */}
        <div
          aria-hidden="true"
          className={`tws-spotlight-navy absolute inset-0 transition-opacity duration-700 ease-out ${active === 0 ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          aria-hidden="true"
          className={`tws-spotlight-onyx absolute inset-0 transition-opacity duration-700 ease-out ${active === 1 ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* Archival grain, static */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.86' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E\")",
            backgroundSize: '210px 210px',
          }}
        />

        {/* Editorial corner strips (desktop) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-10 right-10 top-6 z-10 hidden items-center justify-between text-[9px] font-semibold uppercase tracking-[0.32em] text-white/35 lg:flex"
        >
          <span>Three Ways Studios — 2026 Drop</span>
          <span>Fashion Beyond Limits</span>
          <span>Cairo — Worldwide</span>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-7 px-6 pb-8 pt-9 sm:px-9 sm:pt-12 lg:grid-cols-12 lg:gap-4 lg:px-12 lg:pb-9 lg:pt-16">
          {/* ——— LEFT · headline, blurb, CTA, socials ——— */}
          <div className="flex flex-col lg:col-span-4">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.32em] text-[#e1606b]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e1606b]" aria-hidden="true" />
              Drop 01 — Piece {active + 1}/02
            </p>

            <h2 className="mt-3 font-display uppercase leading-[0.88] text-cream">
              <span className="block text-[2.6rem] tracking-[0.01em] sm:text-6xl lg:text-6xl xl:text-[4.4rem]">
                {meta.headlineTop}
              </span>
              <span
                className="block text-[2.6rem] tracking-[0.01em] text-transparent sm:text-6xl lg:text-6xl xl:text-[3.75rem]"
                style={{ WebkitTextStroke: '1.5px rgba(245,242,235,0.92)' }}
              >
                {meta.headlineBottom}
              </span>
            </h2>

            <p className="mt-4 max-w-[285px] text-[13px] leading-relaxed text-white/70">
              {meta.blurb}
            </p>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="group inline-flex h-12 items-center gap-3 rounded-full bg-cream pl-6 pr-2 text-[11px] font-bold uppercase tracking-[0.22em] text-ink transition-colors duration-300 hover:bg-white"
              >
                View details
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream transition-transform duration-300 group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </span>
              </button>
              <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/40">
                Cash on delivery · Egypt-wide
              </p>
            </div>

            {/* Socials pinned low-left */}
            <div className="mt-7 flex items-center gap-2.5 lg:mt-auto lg:pt-8">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/65 transition-colors duration-300 hover:border-white/40 hover:text-cream"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.6} />
                </a>
              ))}
            </div>
          </div>

          {/* ——— CENTER · swipeable garment stage + tagline ——— */}
          <div className="relative flex flex-col items-center justify-center lg:col-span-5">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 hidden select-none font-display text-[6.5rem] leading-none text-white/[0.055] lg:block xl:text-[8rem]"
            >
              0{active + 1}
            </span>

            <div
              ref={stageRef}
              role="button"
              tabIndex={0}
              aria-label={`${product.name} — tap for product details, swipe left or right to switch colour`}
              aria-roledescription="carousel"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onClick={handleStageClick}
              onKeyDown={handleKeyDown}
              className="tws-swipe-stage relative aspect-[522/1223] h-[44vh] max-h-[400px] cursor-grab touch-pan-y select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream/70 sm:h-[48vh] sm:max-h-[460px] lg:h-[46vh] lg:max-h-[490px] xl:h-[48vh] xl:max-h-[510px]"
            >
              {/* Floor shadow pool — cheap radial, no live blur */}
              <div
                aria-hidden="true"
                className="tws-floor-shadow pointer-events-none absolute -bottom-4 left-1/2 h-16 w-[86%] -translate-x-1/2 rounded-[100%]"
              />

              <div ref={trackRef} className="tws-swipe-track h-full">
                {DEMO_PRODUCTS.map((p, i) => (
                  <div key={p.id} className="tws-swipe-slide h-full" aria-hidden={active !== i}>
                    <img
                      src={p.images?.[0]?.url}
                      alt={p.images?.[0]?.alt_text ?? p.name}
                      draggable={false}
                      decoding="async"
                      fetchPriority={i === 0 ? 'high' : 'auto'}
                      className="pointer-events-none h-full w-full object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Swipe hint + colour dots */}
            <div className="mt-3 flex flex-col items-center gap-1.5 sm:mt-4">
              <div className="flex items-center gap-3">
                {DEMO_PRODUCTS.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    data-no-swipe
                    onClick={() => goTo(i)}
                    aria-label={`Switch to ${p.name}`}
                    aria-pressed={active === i}
                    className={[
                      'flex h-8 items-center gap-2 rounded-full border px-3 text-[9px] font-bold uppercase tracking-[0.18em] transition-colors duration-300',
                      active === i
                        ? 'border-cream/70 bg-cream/15 text-cream'
                        : 'border-white/20 text-white/55 hover:border-white/45 hover:text-cream',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
                      style={{ backgroundColor: i === 0 ? '#152c4e' : '#09090b' }}
                    />
                    {i === 0 ? 'Navy' : 'Black'}
                  </button>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.28em] text-white/40 sm:text-[9px]">
                <MoveHorizontal className="h-3.5 w-3.5" strokeWidth={1.8} />
                Swipe to switch colour
              </p>
            </div>

            <div className="mt-3 h-[62px] text-center lg:mt-4">
              <p key={`script-${product.id}`} className="tws-swap-in font-script text-2xl leading-tight text-cream/95 sm:text-3xl">
                {meta.scriptLine}
              </p>
              <p
                key={`caps-${product.id}`}
                className="tws-swap-in mt-1.5 text-[9px] font-semibold uppercase tracking-[0.34em] text-white/50 sm:text-[10px]"
                style={{ animationDelay: '70ms' }}
              >
                {meta.capsLine}
              </p>
            </div>
          </div>

          {/* ——— RIGHT · price, next, sizes, switcher thumbnail ——— */}
          <div className="flex flex-wrap items-center justify-between gap-6 sm:gap-8 lg:col-span-3 lg:flex-col lg:flex-nowrap lg:items-end lg:justify-center lg:gap-8">
            {/* Price + circular next arrow */}
            <div className="flex items-center gap-5 sm:gap-7">
              <div key={`price-${product.id}`} className="tws-swap-in text-left lg:text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-white/40">The Price</p>
                <p className="mt-1 leading-none text-cream">
                  <span className="align-top text-[11px] font-semibold tracking-[0.2em] text-white/55">EGP&nbsp;</span>
                  <span className="font-display text-5xl tracking-[0.01em] xl:text-6xl">
                    {product.price.toLocaleString('en-US')}
                  </span>
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  {discount ? (
                    <>
                      <span className="mr-2 line-through decoration-white/35">
                        EGP {product.original_price?.toLocaleString('en-US')}
                      </span>
                      <span className="text-[#e1606b]">Save {discount}%</span>
                    </>
                  ) : (
                    'Incl. all duties'
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => goTo(active - 1)}
                  aria-label={`Previous piece — ${DEMO_PRODUCTS[(active - 1 + COUNT) % COUNT].name}`}
                  className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-cream transition-colors duration-300 hover:border-cream hover:bg-cream hover:text-ink"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(active + 1)}
                  aria-label={`Next piece — ${DEMO_PRODUCTS[(active + 1) % COUNT].name}`}
                  className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-cream transition-colors duration-300 hover:border-cream hover:bg-cream hover:text-ink"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* Size selector */}
            <div className="text-left lg:text-right">
              <p id="tws-size-label" className="text-[9px] font-bold uppercase tracking-[0.32em] text-white/40">
                Choose your size
              </p>
              <div role="radiogroup" aria-labelledby="tws-size-label" className="mt-3 flex items-center gap-2">
                {SIZES.map((s) => {
                  const selected = s === size;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSize(s)}
                      className={[
                        'flex h-11 w-11 items-center justify-center rounded-full border text-[11px] font-bold tracking-wide transition-colors duration-200 xl:h-12 xl:w-12',
                        selected
                          ? 'border-cream bg-cream text-ink'
                          : 'border-white/20 text-white/80 hover:border-white/45 hover:text-cream',
                      ].join(' ')}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[9px] uppercase tracking-[0.18em] text-white/35">
                True to size · Runs long
              </p>
            </div>

            {/* Other-piece thumbnail — tap to switch horizontally */}
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label={`View ${DEMO_PRODUCTS[(active + 1) % COUNT].name}`}
              className="group ml-auto flex flex-col items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.055] p-3 transition-colors duration-300 hover:border-white/28 hover:bg-white/[0.09] lg:ml-0 lg:mt-auto"
            >
              <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/40 transition-colors duration-300 group-hover:text-white/70">
                Tap to switch
              </span>
              <span className="flex h-24 w-14 items-end justify-center overflow-hidden sm:h-28 sm:w-16">
                <img
                  src={DEMO_PRODUCTS[(active + 1) % COUNT].images?.[0]?.url}
                  alt={DEMO_PRODUCTS[(active + 1) % COUNT].name}
                  draggable={false}
                  decoding="async"
                  loading="lazy"
                  className="h-full w-auto object-contain object-bottom transition-transform duration-500 group-hover:scale-105"
                />
              </span>
              <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-cream/85">
                {DEMO_PRODUCTS[(active + 1) % COUNT].name.replace('The ', '')}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <ProductDetailsView
        open={detailsOpen}
        activeIndex={active}
        size={size}
        onSizeChange={setSize}
        onColorChange={goTo}
        onClose={() => setDetailsOpen(false)}
        onBuyNow={handleBuyNow}
      />
    </section>
  );
}
