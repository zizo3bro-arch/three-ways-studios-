import { Ruler, X } from 'lucide-react';
import { HOUSE_SIZE_GUIDE } from '../../data/catalog';
import { useBodyScrollLock, useEscapeKey } from '../../lib/scrollLock';
import type { Product } from '../../types/database';

interface SizeGuideModalProps {
  open: boolean;
  product: Product;
  onClose: () => void;
  onOpenFitCalculator: () => void;
}

export function SizeGuideModal({
  open,
  product,
  onClose,
  onOpenFitCalculator,
}: SizeGuideModalProps) {
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  if (!open) return null;

  const dbCharts = product.size_charts ?? [];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tws-size-guide-title"
    >
      <button
        type="button"
        aria-label="Close size guide"
        onClick={onClose}
        className="tws-fade-in absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
      />

      <div className="tws-sheet-in relative z-10 max-h-[90svh] w-full overflow-y-auto rounded-t-2xl border border-black/10 bg-white p-6 text-ink shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
          <div>
            <p className="tws-eyebrow flex items-center gap-2 text-crimson">
              <Ruler className="h-3.5 w-3.5" strokeWidth={2} />
              Size Guide
            </p>
            <h3 id="tws-size-guide-title" className="mt-1.5 text-xl font-semibold text-ink">
              {product.name} — Measurements
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close size guide"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 text-ink transition-colors hover:border-crimson hover:bg-crimson hover:text-white"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          {product.fit_info || 'High-rise fitted hip with an architectural wide-flare leg. True to size, cut long in the leg.'}
        </p>

        <div className="mt-5 overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[480px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-black/10 bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint">
                <th scope="col" className="px-4 py-3">Size</th>
                <th scope="col" className="px-4 py-3">Waist</th>
                <th scope="col" className="px-4 py-3">Hip</th>
                <th scope="col" className="px-4 py-3">Thigh</th>
                <th scope="col" className="px-4 py-3">Inseam</th>
                <th scope="col" className="px-4 py-3">Length</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/8">
              {dbCharts.length > 0
                ? dbCharts.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAFAF8]">
                      <th scope="row" className="px-4 py-3 font-bold text-ink">{row.size_name}</th>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.waist_cm} cm</td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.hip_cm} cm</td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.thigh_cm} cm</td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.inseam_cm} cm</td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.length_cm} cm</td>
                    </tr>
                  ))
                : HOUSE_SIZE_GUIDE.map((row) => (
                    <tr key={row.size} className="hover:bg-[#FAFAF8]">
                      <th scope="row" className="px-4 py-3 font-bold text-ink">{row.size}</th>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.waist}</td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.hip}</td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.thigh}</td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.inseam}</td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">{row.length}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
          <p className="text-xs text-ink-faint">
            Not sure which size to pick? Calculate from your weight and height.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFitCalculator();
            }}
            className="tws-pill h-10 px-5 text-[10px]"
          >
            Find My Size
          </button>
        </div>
      </div>
    </div>
  );
}
