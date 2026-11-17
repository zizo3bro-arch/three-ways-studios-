import { resolveVariant } from '../../data/catalog';
import type { Product } from '../../types/database';

/* =========================================================
   SizeRow — the size selector, shared by quick view and any other
   surface that needs one. Sold-out sizes are struck through and
   still readable; the selected size is inverted, not highlighted
   with a colour.
   ========================================================= */

interface SizeRowProps {
  product: Product;
  value: string;
  onChange: (size: string) => void;
  idPrefix?: string;
}

export function SizeRow({ product, value, onChange, idPrefix = 'size' }: SizeRowProps) {
  const variants = product.variants ?? [];
  const sizes = Array.from(new Set(variants.map((variant) => variant.size_name)));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p id={`${idPrefix}-size-label`} className="tws-eyebrow text-ink-soft">
          Size
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          {sizes.length > 0 ? 'S – XL' : 'One size'}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${idPrefix}-size-label`}
        className="mt-2.5 flex flex-wrap items-center gap-2"
      >
        {sizes.map((size) => {
          const variant = resolveVariant(product, size);
          const soldOut = (variant?.stock_quantity ?? 0) <= 0;
          const selected = size === value;
          return (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={soldOut}
              onClick={() => onChange(size)}
              className={[
                'flex h-10 min-w-[3.1rem] items-center justify-center border px-3 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors',
                soldOut
                  ? 'cursor-not-allowed border-ink/12 text-ink/25 line-through'
                  : selected
                    ? 'border-ink bg-ink text-[#f7f4ed]'
                    : 'border-ink/22 text-ink hover:border-ink',
              ].join(' ')}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}
