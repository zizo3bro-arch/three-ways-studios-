import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, ShoppingBag } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCatalog } from '../../hooks/useCatalog';
import { useAddToBag } from '../../hooks/useAddToBag';
import { colourNameFor, editorialFor, findProductBySlug, imagesOf } from '../../data/catalog';
import { formatEGP, getDiscountPercent } from '../../lib/format';
import type { Size } from '../../data/catalog';
import { ColourChip } from '../ui/ColourChip';
import { Overlay } from '../ui/Overlay';
import { SizeRow } from './SizeRow';

/* =========================================================
   QUICK VIEW — the bag path without leaving the page. URL driven
   (?piece=slug) so it can be shared, refreshed and closed with Back.
   ========================================================= */

export function QuickView() {
  const { quickViewSlug, closeQuickView } = useUI();
  const { products } = useCatalog();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const addToBag = useAddToBag();
  const navigate = useNavigate();

  const product = useMemo(() => findProductBySlug(products, quickViewSlug || undefined), [products, quickViewSlug]);
  const [size, setSize] = useState<Size>('M');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const options = product.variants ?? [];
    const firstAvailable = options.find((variant) => variant.stock_quantity > 0)?.size_name;
    if (firstAvailable) setSize(firstAvailable as Size);
  }, [product]);

  const open = Boolean(quickViewSlug && product);
  const editorial = editorialFor(product);
  const images = imagesOf(product);
  const discount = product ? getDiscountPercent(product.price, product.original_price) : null;
  const saved = product ? isWishlisted(product.id) : false;

  if (!product) return null;

  const handleAdd = () => {
    const result = addToBag(product, size, { openDrawer: true });
    setNote(result.ok ? 'In your bag' : (result.message ?? 'Not available'));
    window.setTimeout(() => setNote(null), 2400);
  };

  return (
    <Overlay open={open} onClose={closeQuickView} label={`${product.name} — quick view`} placement="full" panelClassName="max-w-[1080px]">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto md:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] md:gap-6 md:overflow-hidden">
        {/* photography */}
        <div className="relative flex items-end justify-center overflow-hidden bg-[rgba(23,19,15,0.045)] px-5 py-6 md:min-h-[460px]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[18%] bottom-6 h-9 rounded-[100%] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(22,19,15,0.16)_0%,rgba(22,19,15,0.05)_52%,transparent_78%)]"
          />
          <img
            src={images[0]?.url}
            alt={images[0]?.alt_text ?? product.name}
            width={522}
            height={1223}
            decoding="async"
            className="relative max-h-[38vh] w-auto object-contain object-bottom md:max-h-[52vh]"
          />
          <p className="absolute bottom-3 left-4 text-[8.5px] font-bold uppercase tracking-[0.28em] text-ink-faint">
            {product.collection_name}
          </p>
        </div>

        {/* information */}
        <div className="flex flex-col pb-2 pt-1 md:overflow-y-auto md:pr-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="tws-eyebrow text-crimson-bright">
                {editorial.chapter} · {product.is_new_arrival ? 'New arrival' : 'Signature'}
              </p>
              <h2 className="mt-2 font-display text-[clamp(1.9rem,4.4vw,2.8rem)] uppercase leading-[0.88] tracking-[0.004em] text-ink">
                {product.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-label={saved ? 'Remove from saved pieces' : 'Save this piece'}
              aria-pressed={saved}
              className={[
                'flex h-9 w-9 shrink-0 items-center justify-center border transition-colors duration-300',
                saved
                  ? 'border-crimson bg-crimson text-[#f7f4ed]'
                  : 'border-ink/18 text-ink-soft hover:border-crimson-bright hover:text-crimson-bright',
              ].join(' ')}
            >
              <Heart className="h-4 w-4" strokeWidth={1.9} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-display text-[1.7rem] leading-none tracking-[0.01em] text-ink">
              {formatEGP(product.price)}
            </p>
            {discount ? (
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                <span className="line-through decoration-ink/35">{formatEGP(product.original_price ?? 0)}</span>
                <span className="ml-2 font-bold text-crimson-bright">Save {discount}%</span>
              </p>
            ) : null}
          </div>

          <ColourChip label={colourNameFor(product)} size="lg" className="mt-4" />

          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">{editorial.blurb}</p>

          <div className="mt-5">
            <SizeRow product={product} value={size} onChange={(next) => setSize(next as Size)} idPrefix="quick" />
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button type="button" onClick={handleAdd} className="tws-pill h-13 flex-1 justify-center">
              <ShoppingBag className="h-4 w-4" strokeWidth={1.9} />
              {note ?? 'Add to bag'}
            </button>
            <button
              type="button"
              onClick={() => {
                addToBag(product, size);
                closeQuickView();
                navigate('/checkout');
              }}
              className="tws-pill tws-pill--outline h-13 flex-1 justify-center"
            >
              Buy now
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <Link
            to={`/product/${product.slug}`}
            onClick={closeQuickView}
            className="mt-3 inline-flex items-center gap-2 self-start text-[10px] font-bold uppercase tracking-[0.2em] text-ink underline decoration-ink/25 underline-offset-4 transition-colors hover:text-crimson-bright hover:decoration-crimson-bright"
          >
            Open the full piece page
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-ink/12 pt-4 text-[11px]">
            <div>
              <dt className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-ink-faint">Cloth</dt>
              <dd className="mt-1 uppercase leading-snug tracking-[0.04em] text-ink">{product.fabric_info}</dd>
            </div>
            <div>
              <dt className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-ink-faint">Fit</dt>
              <dd className="mt-1 uppercase leading-snug tracking-[0.04em] text-ink">{product.fit_info}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Overlay>
  );
}
