import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Plus } from 'lucide-react';
import { editorialFor, firstAvailableSize, imagesOf, sizeOptionsFor, colourNameFor } from '../../data/catalog';
import { useWishlist } from '../../context/WishlistContext';
import { useUI } from '../../context/UIContext';
import { useAddToBag } from '../../hooks/useAddToBag';
import { formatEGP, getDiscountPercent } from '../../lib/format';
import type { Product } from '../../types/database';
import { ColourChip } from '../ui/ColourChip';
import { Reveal } from '../ui/Reveal';

/* =========================================================
   PRODUCT PLATE — monumental photography, minimal information:
   name, price, cloth line, size row, two actions. The colour plate
   is fixed white. Hover only nudges the image and lifts the actions.
   ========================================================= */

interface ProductPlateProps {
  product: Product;
  index: number;
}

export function ProductPlate({ product, index }: ProductPlateProps) {
  const editorial = editorialFor(product);
  const images = imagesOf(product);
  const sizes = sizeOptionsFor(product);
  const discount = getDiscountPercent(product.price, product.original_price);
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { openQuickView } = useUI();
  const addToBag = useAddToBag();

  const [selectedSize, setSelectedSize] = useState(() => firstAvailableSize(product));
  const [feedback, setFeedback] = useState<string | null>(null);
  const saved = isWishlisted(product.id);
  const soldOut = useMemo(() => sizes.every((size) => size.soldOut), [sizes]);

  const handleAdd = () => {
    const result = addToBag(product, selectedSize);
    setFeedback(result.ok ? 'Added to bag' : (result.message ?? 'Could not add'));
    window.setTimeout(() => setFeedback(null), 2200);
  };

  return (
    <Reveal className="group/plate flex flex-col" preset="soft" delay={index * 0.06}>
      <article className="tws-plate relative flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-ink/12 bg-paper shadow-plate transition-shadow duration-500 hover:shadow-lift sm:rounded-[1.75rem]">
        {/* ——— media ——— */}
        <Link
          to={`/product/${product.slug}`}
          aria-label={`View ${product.name}`}
          className="tws-plate-media relative block aspect-[522/860] w-full sm:aspect-[522/950]"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[16%] bottom-[6%] h-10 rounded-[100%] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(22,19,15,0.16)_0%,rgba(22,19,15,0.06)_52%,transparent_78%)]"
          />
          <img
            src={images[0]?.url}
            alt={images[0]?.alt_text ?? product.name}
            width={522}
            height={1223}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className="pointer-events-none absolute inset-x-0 bottom-0 top-0 mx-auto h-full w-auto object-contain object-bottom"
          />

          <span className="absolute left-3.5 top-3.5 flex items-center gap-2 rounded-full border border-ink/12 bg-paper/85 px-2.5 py-1 backdrop-blur-sm">
            <ColourChip />
            <span className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-ink-soft">
              {colourNameFor(product)}
            </span>
          </span>

          <span className="pointer-events-none absolute bottom-3.5 left-1/2 flex h-10 -translate-x-1/2 translate-y-3 items-center gap-2 rounded-full bg-ink px-4 text-[9px] font-bold uppercase tracking-[0.2em] text-ivory opacity-0 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/plate:translate-y-0 group-hover/plate:opacity-100">
            View the piece
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </Link>

        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={saved ? `Remove ${product.name} from saved pieces` : `Save ${product.name}`}
          aria-pressed={saved}
          className={[
            'absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-300',
            saved
              ? 'border-crimson-bright bg-crimson-bright text-ivory'
              : 'border-ink/12 bg-paper/85 text-ink-soft hover:border-crimson-bright hover:text-crimson-bright',
          ].join(' ')}
        >
          <Heart className="h-4 w-4" strokeWidth={1.9} fill={saved ? 'currentColor' : 'none'} />
        </button>

        {/* ——— information ——— */}
        <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="tws-eyebrow text-crimson-bright">{editorial.chapter}</p>
              <h3 className="mt-1.5 font-display text-[1.35rem] uppercase leading-[0.98] tracking-[0.005em] text-ink sm:text-[1.55rem]">
                {product.name}
              </h3>
            </div>
            <p className="shrink-0 text-right leading-none">
              <span className="block font-display text-[1.28rem] tracking-[0.01em] text-ink sm:text-[1.5rem]">
                {formatEGP(product.price)}
              </span>
              {discount ? (
                <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-crimson-bright">
                  Was {formatEGP(product.original_price ?? 0)}
                </span>
              ) : (
                <span className="mt-1 block text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                  Incl. duties
                </span>
              )}
            </p>
          </div>

          <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">{editorial.blurb}</p>

          <p className="mt-3 border-t border-ink/10 pt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            {product.fabric_info}
          </p>

          {/* size row */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={`Choose a size for ${product.name}`}>
            {sizes.map((option) => {
              const active = option.size === selectedSize;
              return (
                <button
                  key={option.size}
                  type="button"
                  disabled={option.soldOut}
                  onClick={() => setSelectedSize(option.size as typeof selectedSize)}
                  aria-pressed={active}
                  aria-label={option.soldOut ? `Size ${option.size} sold out` : `Size ${option.size}`}
                  className={[
                    'flex h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] transition-all duration-250',
                    option.soldOut
                      ? 'cursor-not-allowed border-ink/10 text-ink/25 line-through'
                      : active
                        ? 'border-ink bg-ink text-ivory'
                        : 'border-ink/20 text-ink-soft hover:border-ink hover:text-ink',
                  ].join(' ')}
                >
                  {option.size}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => openQuickView(product.slug)}
              className="ml-auto text-[9px] font-bold uppercase tracking-[0.2em] text-ink-soft underline decoration-ink/25 underline-offset-4 transition-colors hover:text-crimson-bright hover:decoration-crimson-bright"
            >
              Quick view
            </button>
          </div>

          <div className="mt-3.5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleAdd}
              disabled={soldOut}
              className="tws-pill h-12 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              {soldOut ? 'Sold out' : feedback ? feedback : `Add size ${selectedSize}`}
              {!soldOut && !feedback ? <Plus className="h-4 w-4" strokeWidth={2.2} /> : null}
            </button>
            <Link to={`/product/${product.slug}`} className="tws-pill tws-pill--outline h-12 w-12 justify-center p-0" aria-label={`Open the full page for ${product.name}`}>
              <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
            </Link>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
