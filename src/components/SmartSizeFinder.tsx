import { useMemo, useState } from 'react';
import { Ruler, Sparkles } from 'lucide-react';
import { recommendSizeFromChart } from '../lib/sizeFinder';
import type { ProductVariant, SizeChartRow } from '../types/database';

interface SmartSizeFinderProps {
  sizeCharts: SizeChartRow[];
  variants: ProductVariant[];
  selectedColor: string;
  onSelectSize: (sizeName: string) => void;
}

export function SmartSizeFinder({
  sizeCharts,
  variants,
  selectedColor,
  onSelectSize,
}: SmartSizeFinderProps) {
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [showManualChart, setShowManualChart] = useState(false);

  const weightNum = Number(weightInput);
  const heightNum = Number(heightInput);

  const recommendation = useMemo(() => {
    if (!weightInput || !heightInput) return null;
    if (weightNum < 30 || weightNum > 200 || heightNum < 120 || heightNum > 220) {
      return null;
    }
    return recommendSizeFromChart(sizeCharts, weightNum, heightNum);
  }, [sizeCharts, weightInput, heightInput, weightNum, heightNum]);

  const recommendedVariantStock = useMemo(() => {
    if (!recommendation) return null;
    const match = variants.find(
      (v) =>
        v.size_name.toLowerCase() === recommendation.recommendedSize.toLowerCase() &&
        (!selectedColor || v.color_name.toLowerCase() === selectedColor.toLowerCase())
    );
    return match ? match.stock_quantity : 0;
  }, [recommendation, variants, selectedColor]);

  const sortedChart = useMemo(
    () => [...sizeCharts].sort((a, b) => a.size_order - b.size_order),
    [sizeCharts]
  );

  return (
    <div className="border border-white/12 bg-black/35 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#d4121b]" />
          <h3 className="text-xs font-medium tracking-[0.2em] text-white uppercase">
            Smart Size Finder
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowManualChart((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.14em] text-[#cfc6c6] uppercase transition-colors hover:text-white"
        >
          <Ruler className="h-3.5 w-3.5" />
          {showManualChart ? 'Hide Size Chart' : 'Manual Size Chart'}
        </button>
      </div>

      {sortedChart.length === 0 ? (
        <p className="mt-4 text-xs leading-relaxed text-[#9e9494]">
          Product-specific size chart measurements have not been published for this style yet.
          Contact THREE WAYS STUDIOS for bespoke sizing guidance.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-[#a99e9e]">
            Enter your weight and height to receive a fit estimate calculated from this specific
            garment&apos;s measurements.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="finder-weight"
                className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#9e9494] uppercase"
              >
                Weight (kg)
              </label>
              <input
                id="finder-weight"
                type="number"
                min={30}
                max={200}
                step="0.5"
                placeholder="e.g. 58"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full border border-white/15 bg-[#0a0607] px-3 py-2 text-xs text-white placeholder-[#665c5c] focus:border-[#b30e16] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="finder-height"
                className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#9e9494] uppercase"
              >
                Height (cm)
              </label>
              <input
                id="finder-height"
                type="number"
                min={120}
                max={220}
                step="1"
                placeholder="e.g. 166"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                className="w-full border border-white/15 bg-[#0a0607] px-3 py-2 text-xs text-white placeholder-[#665c5c] focus:border-[#b30e16] focus:outline-none"
              />
            </div>
          </div>

          {weightInput && heightInput && !recommendation && (
            <p className="mt-3 text-[11px] text-[#e5989b]">
              Please enter a realistic weight (30–200 kg) and height (120–220 cm).
            </p>
          )}

          {recommendation && (
            <div className="mt-4 border border-[#b30e16]/45 bg-[#1b0709]/65 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] tracking-[0.2em] text-[#cfc6c6] uppercase">
                    Recommended Size
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-2.5">
                    <span className="text-2xl font-semibold text-white">
                      {recommendation.recommendedSize}
                    </span>
                    <span className="text-[11px] tracking-[0.12em] text-[#e87a80] uppercase">
                      {recommendation.matchQuality === 'exact'
                        ? 'Direct Chart Match'
                        : recommendation.matchQuality === 'close'
                        ? 'Close Match'
                        : 'Closest Fit'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={recommendedVariantStock === 0}
                  onClick={() => onSelectSize(recommendation.recommendedSize)}
                  className="rounded-full border border-white/25 bg-[#b30e16] px-4 py-1.5 text-[11px] font-medium tracking-[0.16em] text-white uppercase transition-colors hover:bg-[#d4121b] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[#847878]"
                >
                  {recommendedVariantStock === 0
                    ? 'Out of Stock in Color'
                    : `Select Size ${recommendation.recommendedSize}`}
                </button>
              </div>

              <p className="mt-2.5 text-[11px] leading-relaxed text-[#d6cece]">
                {recommendation.note}
              </p>
            </div>
          )}

          {showManualChart && (
            <div className="mt-5 overflow-x-auto border-t border-white/10 pt-4">
              <p className="mb-2.5 text-[10px] tracking-[0.2em] text-[#9e9494] uppercase">
                Garment Manual Size Chart (cm / kg)
              </p>
              <table className="w-full min-w-[460px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/15 text-[10px] tracking-[0.14em] text-[#9e9494] uppercase">
                    <th className="py-2 pr-3 font-medium">Size</th>
                    <th className="py-2 pr-3 font-medium">Weight (kg)</th>
                    <th className="py-2 pr-3 font-medium">Height (cm)</th>
                    <th className="py-2 pr-3 font-medium">Waist</th>
                    <th className="py-2 pr-3 font-medium">Hip</th>
                    <th className="py-2 pr-3 font-medium">Inseam</th>
                    <th className="py-2 font-medium">Length</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 text-[#e6dfdf]">
                  {sortedChart.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        recommendation?.recommendedSize === row.size_name
                          ? 'bg-[#b30e16]/18'
                          : ''
                      }
                    >
                      <td className="py-2 pr-3 font-semibold text-white">{row.size_name}</td>
                      <td className="py-2 pr-3">
                        {row.weight_min_kg}–{row.weight_max_kg}
                      </td>
                      <td className="py-2 pr-3">
                        {row.height_min_cm}–{row.height_max_cm}
                      </td>
                      <td className="py-2 pr-3">{row.waist_cm || '—'}</td>
                      <td className="py-2 pr-3">{row.hip_cm || '—'}</td>
                      <td className="py-2 pr-3">{row.inseam_cm || '—'}</td>
                      <td className="py-2">{row.length_cm || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
