import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, Heart, ShoppingBag } from 'lucide-react';
import { useCatalog } from '../hooks/useCatalog';
import { useAddToBag } from '../hooks/useAddToBag';
import { useWishlist } from '../context/WishlistContext';
import {
  colourNameFor,
  editorialFor,
  findProductBySlug,
  firstAvailableSize,
  imagesOf,
  relatedProducts,
  sizeOptionsFor,
  type Size,
} from '../data/catalog';
import { formatEGP, getDiscountPercent } from '../lib/format';
import { ColourChip } from '../components/ui/ColourChip';
import { Reveal } from '../components/ui/Reveal';
import { SizeRow } from '../components/shop/SizeRow';
import { ProductPlate } from '../components/shop/ProductPlate';
import { SmokeField } from '../components/ui/SmokeField';

/* =========================================================
   /product/:slug — the full piece page.
   Real photography, real variant stock, one fixed white colour
   plate, and the atelier fit tool. Nothing here repaints the site.
   ========================================================= */

type Panel = 'details' | 'care' | 'shipping' | null;

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { products, loading } = useCatalog();
  const addToBag = useAddToBag();
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const product = useMemo(() => findProductBySlug(products, slug), [products, slug]);
  const [size, setSize] = useState<Size>('M');
  const [panel, setPanel] = useState<Panel>('details');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setSize(firstAvailableSize(product));
    setNote(null);
  }, [product]);

  useEffect(() => {
    document.title = product
      ? `${product.name} — THREE WAYS STUDIOS`
      : 'Piece — THREE WAYS STUDIOS';
  }, [product]);

  if (!product) {
    return (
      <section className="tws-paper relative flex min-h-[70svh] flex-col items-center justify-center px-4 pb-16 pt-[130px] text-center">
        <p className="tws-eyebrow text-crimson-bright">{loading ? 'Loading' : 'Not in the archive'}</p>
        <h1 className="mt-4 font-display text-[clamp(2rem,6vw,3.4rem)] uppercase leading-[0.92] text-ink">
          {loading ? 'One moment…' : 'We cannot find that piece'}
        </h1>
        {!loading ? (
          <>
            <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-ink-soft">
              It may have sold through. Two silhouettes are always in the shop.
            </p>
            <Link to="/shop" className="tws-pill mt-6 h-12">
              Back to the shop
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </>
        ) : null}
      </section>
    );
  }

  const editorial = editorialFor(product);
  const images = imagesOf(product);
  const discount = getDiscountPercent(product.price, product.original_price);
  const sizes = sizeOptionsFor(product);
  const soldOut = sizes.every((option) => option.soldOut);
  const saved = isWishlisted(product.id);
  const related = relatedProducts(products, product.slug, 2);

  const handleAdd = (openCheckout = false) => {
    const result = addToBag(product, size, { openDrawer: !openCheckout });
    if (result.ok && openCheckout) navigate('/checkout');
    setNote(result.ok ? (openCheckout ? 'Taking you to checkout…' : 'Added to bag') : (result.message ?? 'Not available'));
    window.setTimeout(() => setNote(null), 2600);
  };

  return (
    <div className="relative">
      <div className="mx-auto w-full max-w-[1660px] px-4 pb-16 pt-[92px] sm:px-6 sm:pt-[120px] lg:px-10">
        {/* breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">
          <Link to="/" className="transition-colors hover:text-crimson-bright">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/shop" className="transition-colors hover:text-crimson-bright">Shop</Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">{product.name}</span>
        </nav>

        <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:gap-10">
          {/* ——— photography ——— */}
          <div className="lg:col-span-7">
            <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-ink/12 bg-paper">
              <SmokeField variant="soft" opacity="low" />
              <div className="relative z-10 flex aspect-[522/760] items-end justify-center px-6 pb-8 pt-10 sm:aspect-[522/860]">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[16%] bottom-6 h-12 rounded-[100%] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(22,19,15,0.18)_0%,rgba(22,19,15,0.06)_52%,transparent_78%)]"
                />
                <img
                  key={images[0]?.id}
                  src={images[0]?.url}
                  alt={images[0]?.alt_text ?? product.name}
                  width={522}
                  height={1223}
                  fetchPriority="high"
                  decoding="async"
                  className="tws-swap-in relative h-full w-auto object-contain object-bottom"
                />
              </div>
              <p className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-ink/12 bg-paper/85 px-3 py-1.5 backdrop-blur-sm">
                <ColourChip label={colourNameFor(product)} />
              </p>
              <p className="absolute bottom-4 right-4 z-10 text-[8.5px] font-bold uppercase tracking-[0.28em] text-ink-faint">
                {product.collection_name}
              </p>
            </div>

            {/* secondary plates: the same negative, different crops — no invented photography */}
            {images.length > 1 ? (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {images.slice(0, 3).map((image) => (
                  <div key={image.id} className="flex aspect-[522/620] items-end justify-center overflow-hidden rounded-[0.9rem] border border-ink/12 bg-paper">
                    <img src={image.url} alt={image.alt_text ?? product.name} loading="lazy" className="h-full w-auto object-contain object-bottom" />
                  </div>
                ))}
              </div>
            ) : null}

            <Reveal className="mt-3 grid gap-3 sm:grid-cols-2" preset="soft">
              <figure className="relative overflow-hidden rounded-[0.9rem] border border-ink/12">
                <img src={editorial.campaignImage} alt={editorial.campaignCaption} loading="lazy" className="h-40 w-full object-cover sm:h-48" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#16130f]/80 to-transparent px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.2em] text-ivory/90">
                  {editorial.campaignCaption}
                </figcaption>
              </figure>
              <div className="flex flex-col justify-between rounded-[0.9rem] border border-ink/12 bg-paper px-4 py-3.5">
                <p className="tws-signature tws-signature--ink text-[1.7rem] leading-none">{editorial.scriptLine}</p>
                <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">{editorial.capsLine}</p>
              </div>
            </Reveal>
          </div>

          {/* ——— purchase column ——— */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[112px]">
              <p className="tws-eyebrow text-crimson-bright">
                {editorial.chapter} · {product.category} · {product.is_new_arrival ? 'New arrival' : 'Signature'}
              </p>
              <h1 className="mt-3 font-display uppercase leading-[0.88] tracking-[0.002em] text-ink text-[clamp(2.1rem,6vw,3.6rem)]">
                {product.name.split(' ').map((word, index) => (
                  <span key={`${word}-${index}`} className="block">
                    {word}
                  </span>
                ))}
              </h1>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-display text-[2rem] leading-none tracking-[0.01em] text-ink">{formatEGP(product.price)}</p>
                {discount ? (
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    <span className="line-through decoration-ink/35">{formatEGP(product.original_price ?? 0)}</span>
                    <span className="ml-2 font-bold text-crimson-bright">Save {discount}%</span>
                  </p>
                ) : (
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">Incl. all duties</p>
                )}
              </div>

              <p className="mt-5 font-serif text-[15px] italic leading-relaxed text-ink-soft sm:text-[16px]">
                {product.description}
              </p>

              <div className="mt-6 rounded-[1.25rem] border border-ink/14 bg-paper p-4 sm:p-5">
                <SizeRow product={product} value={size} onChange={setSize} idPrefix="pdp" />

                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => handleAdd(false)}
                    disabled={soldOut}
                    className="tws-pill h-13 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ShoppingBag className="h-4 w-4" strokeWidth={1.9} />
                    {soldOut ? 'Sold out' : note ?? `Add size ${size} — ${formatEGP(product.price)}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    aria-pressed={saved}
                    aria-label={saved ? 'Remove from saved pieces' : 'Save this piece'}
                    className={[
                      'flex h-13 w-13 shrink-0 items-center justify-center rounded-full border transition-colors duration-300',
                      saved
                        ? 'border-crimson-bright bg-crimson-bright text-ivory'
                        : 'border-ink/20 text-ink-soft hover:border-crimson-bright hover:text-crimson-bright',
                    ].join(' ')}
                  >
                    <Heart className="h-4 w-4" strokeWidth={1.9} fill={saved ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <button type="button" onClick={() => handleAdd(true)} disabled={soldOut} className="tws-pill tws-pill--crimson mt-2.5 h-13 w-full justify-center disabled:opacity-40">
                  Buy now
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>

                <p className="mt-3 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  Cash on delivery · Egypt-wide · Free over EGP 3,500
                </p>
              </div>

              {/* accordions */}
              <div className="mt-6 border-t border-ink/12">
                {(
                  [
                    { key: 'details', label: 'Details & fit', body: `${product.fit_info} ${product.fabric_info}` },
                    { key: 'care', label: 'Care', body: product.care_instructions },
                    {
                      key: 'shipping',
                      label: 'Delivery & returns',
                      body: 'Dispatched from the Cairo atelier in 1–2 working days. Nationwide delivery in 2–5 days, EGP 75 (free over EGP 3,500). 14-day returns, unworn with tags.',
                    },
                  ] as const
                ).map((section) => {
                  const isOpen = panel === section.key;
                  return (
                    <div key={section.key} className="border-b border-ink/12">
                      <button
                        type="button"
                        onClick={() => setPanel(isOpen ? null : section.key)}
                        aria-expanded={isOpen}
                        aria-controls={`pdp-panel-${section.key}`}
                        className="flex w-full items-center justify-between gap-4 py-4 text-left"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink">{section.label}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${isOpen ? 'rotate-180' : ''}`}
                          strokeWidth={2}
                        />
                      </button>
                      <div id={`pdp-panel-${section.key}`} className="tws-accordion-grid" data-open={isOpen}>
                        <div className="overflow-hidden">
                          <p className="pb-4 text-[13px] leading-relaxed text-ink-soft">{section.body}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <section aria-label="More from the drop" className="mt-16 border-t border-ink/12 pt-10 sm:mt-20">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(1.6rem,4vw,2.6rem)]">
                Also in the drop
              </h2>
              <Link to="/shop" className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft transition-colors hover:text-crimson-bright">
                All pieces
              </Link>
            </div>
            <div className="mt-7 grid gap-5 md:grid-cols-2 md:gap-6 lg:gap-8">
              {related.map((item, index) => (
                <ProductPlate key={item.id} product={item} index={index} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
