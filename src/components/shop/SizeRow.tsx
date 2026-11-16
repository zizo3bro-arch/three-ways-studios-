import { useState } from 'react';
import { Ruler } from 'lucide-react';
import { sizeOptionsFor, type Size, type SizeOption } from '../../data/catalog';
import { FindSizeModal } from '../FindSizeModal';
import type { Product } from '../../types/database';

/* =========================================================
   SIZE ROW — availability read from the variant rows, with the
   atelier fit tool wired to the same state. Sold-out sizes are
   disabled, never silently skipped.
   ========================================================= */

interface SizeRowProps {
  product: Product;
  value: Size;
  onChange: (size: Size) => void;
  idPrefix: string;
  showFitTool?: boolean;
  compact?: boolean;
}

export function SizeRow({ product, value, onChange, idPrefix, showFitTool = true, compact = false }: SizeRowProps) {
  const options: SizeOption[] = sizeOptionsFor(product);
  const [fitOpen, setFitOpen] = useState(false);
  const active = options.find((option) => option.size === value);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p id={`${idPrefix}-size-label`} className="tws-eyebrow text-ink-soft">
          Size
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          {active?.soldOut
            ? 'Sold out in this size'
            : active && active.stock <= 4
              ? `Only ${active.stock} left`
              : 'S — XL · cut long'}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={`${idPrefix}-size-label`}
        className="mt-2.5 flex flex-wrap items-center gap-2"
      >
        {options.map((option) => {
          const selected = option.size === value;
          return (
            <button
              key={option.size}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.soldOut}
              onClick={() => onChange(option.size as Size)}
              className={[
                'flex items-center justify-center rounded-full border text-[11px] font-bold uppercase tracking-[0.05em] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                compact ? 'h-10 min-w-10 px-2.5' : 'h-11 min-w-11 px-3',
                option.soldOut
                  ? 'cursor-not-allowed border-ink/10 text-ink/25 line-through'
                  : selected
                    ? 'border-ink bg-ink text-ivory shadow-[0_8px_20px_-12px_rgba(22,19,15,0.8)]'
                    : 'border-ink/20 text-ink-soft hover:border-ink hover:text-ink',
              ].join(' ')}
            >
              {option.size}
            </button>
          );
        })}

        {showFitTool ? (
          <button
            type="button"
            onClick={() => setFitOpen(true)}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-full border border-ink/20 px-3.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-ivory"
          >
            <Ruler className="h-3.5 w-3.5" strokeWidth={2} />
            Find my size
          </button>
        ) : null}
      </div>

      <FindSizeModal
        open={fitOpen}
        currentSize={value}
        onClose={() => setFitOpen(false)}
        onApply={(size) => onChange(size)}
      />
    </div>
  );
}
