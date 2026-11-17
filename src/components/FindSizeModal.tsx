import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Ruler, X } from 'lucide-react';
import {
  HEIGHT_RANGE,
  WEIGHT_RANGE,
  recommendPantsSize,
  type FitRecommendation,
} from '../lib/fitCalculator';
import { useBodyScrollLock, useEscapeKey } from '../lib/scrollLock';

type Size = 'S' | 'M' | 'L' | 'XL';

interface FindSizeModalProps {
  open: boolean;
  currentSize: Size;
  onClose: () => void;
  onApply: (size: Size) => void;
}

export function FindSizeModal({ open, currentSize, onClose, onApply }: FindSizeModalProps) {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FitRecommendation | null>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(open);
  useEscapeKey(open, onClose);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    const timer = window.setTimeout(() => weightRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const weightKg = Number.parseFloat(weight.replace(',', '.'));
    const heightCm = Number.parseFloat(height.replace(',', '.'));

    if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) {
      setError('Enter both your weight and height to continue.');
      return;
    }
    if (weightKg < WEIGHT_RANGE.min || weightKg > WEIGHT_RANGE.max) {
      setError(`Weight should be between ${WEIGHT_RANGE.min} and ${WEIGHT_RANGE.max} kg.`);
      return;
    }
    if (heightCm < HEIGHT_RANGE.min || heightCm > HEIGHT_RANGE.max) {
      setError(`Height should be between ${HEIGHT_RANGE.min} and ${HEIGHT_RANGE.max} cm.`);
      return;
    }

    const recommendation = recommendPantsSize(weightKg, heightCm);
    if (!recommendation) {
      setError('We could not calculate a size — please check your measurements.');
      return;
    }
    setResult(recommendation);
  };

  const applySize = () => {
    if (!result) return;
    onApply(result.size);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close find my size"
        onClick={onClose}
        className="tws-fade-in absolute inset-0 cursor-default bg-[#0c0a0b]/72"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tws-find-size-title"
        className="tws-sheet-in relative z-10 max-h-[92svh] w-full overflow-y-auto rounded-t-2xl border border-black/10 bg-white p-6 text-ink shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-crimson">
              <Ruler className="h-3.5 w-3.5" strokeWidth={2} />
              Find my size
            </p>
            <h3 id="tws-find-size-title" className="mt-2 font-display text-3xl uppercase leading-none">
              Weight &amp; Height
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/20 bg-cream-card text-ink transition-colors duration-200 hover:border-ink hover:bg-ink hover:text-cream"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {result ? (
          <div className="mt-6">
            <div className="rounded-2xl border-2 border-ink bg-ink px-6 py-7 text-center text-cream">
              <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-cream/60">
                Your recommended size
              </p>
              <p className="mt-2 font-display text-[5.5rem] leading-none text-cream" aria-live="polite">
                {result.size}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-cream/55">
                BMI {result.bmi} · {result.confidence === 'exact' ? 'Confident match' : 'Best match'}
              </p>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">{result.note}</p>
            <p className="mt-2 text-[10px] leading-relaxed uppercase tracking-[0.14em] text-ink-faint">
              Estimate only — not a guarantee of fit.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={applySize}
                className="inline-flex h-14 min-h-12 w-full items-center justify-center gap-2.5 rounded-full bg-crimson-bright px-6 text-[11px] font-bold uppercase tracking-[0.24em] text-cream transition-colors duration-200 hover:bg-crimson-deep"
              >
                <Check className="h-4 w-4" strokeWidth={2.6} />
                Select size {result.size}
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="inline-flex h-12 w-full items-center justify-center rounded-full border-2 border-ink/25 px-6 text-[10px] font-bold uppercase tracking-[0.24em] text-ink transition-colors duration-200 hover:border-ink"
              >
                Recalculate
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6" noValidate>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Two numbers are all we need. We&apos;ll match you to the closest fit in this
              garment&apos;s chart.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="tws-find-weight"
                  className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-ink"
                >
                  Weight (kg)
                </label>
                <input
                  ref={weightRef}
                  id="tws-find-weight"
                  type="number"
                  inputMode="decimal"
                  min={WEIGHT_RANGE.min}
                  max={WEIGHT_RANGE.max}
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="72"
                  className="h-14 w-full rounded-xl border-2 border-ink/35 bg-white px-4 text-base font-semibold text-ink outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-ink-faint focus:border-crimson-bright"
                />
              </div>
              <div>
                <label
                  htmlFor="tws-find-height"
                  className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-ink"
                >
                  Height (cm)
                </label>
                <input
                  id="tws-find-height"
                  type="number"
                  inputMode="decimal"
                  min={HEIGHT_RANGE.min}
                  max={HEIGHT_RANGE.max}
                  step="1"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="178"
                  className="h-14 w-full rounded-xl border-2 border-ink/35 bg-white px-4 text-base font-semibold text-ink outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-ink-faint focus:border-crimson-bright"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-xs font-semibold text-crimson-bright">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-5 inline-flex h-14 min-h-12 w-full items-center justify-center gap-2.5 rounded-full bg-ink px-6 text-[11px] font-bold uppercase tracking-[0.24em] text-cream transition-colors duration-200 hover:bg-crimson-bright"
            >
              Calculate my size
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
            </button>

            <p className="mt-3 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
              Currently selected · Size {currentSize}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
