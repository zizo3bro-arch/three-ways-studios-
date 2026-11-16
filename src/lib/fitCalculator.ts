export const FIT_SIZES = ['S', 'M', 'L', 'XL'] as const;
export type FitSize = (typeof FIT_SIZES)[number];

interface FitRange {
  size: FitSize;
  minWeight: number;
  maxWeight: number;
  minHeight: number;
  maxHeight: number;
}

/**
 * Simple, transparent weight/height bands for the Drop 01 wide-flare block.
 * Bands overlap on purpose — the scoring below picks the closest centre.
 */
const FIT_RANGES: FitRange[] = [
  { size: 'S', minWeight: 48, maxWeight: 64, minHeight: 152, maxHeight: 174 },
  { size: 'M', minWeight: 61, maxWeight: 77, minHeight: 163, maxHeight: 183 },
  { size: 'L', minWeight: 74, maxWeight: 91, minHeight: 172, maxHeight: 191 },
  { size: 'XL', minWeight: 88, maxWeight: 130, minHeight: 178, maxHeight: 208 },
];

export interface FitRecommendation {
  size: FitSize;
  bmi: number;
  confidence: 'exact' | 'close' | 'closest';
  note: string;
}

export const WEIGHT_RANGE = { min: 35, max: 220 } as const;
export const HEIGHT_RANGE = { min: 130, max: 220 } as const;

function outside(value: number, min: number, max: number): number {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

/**
 * Recommend a pants size from weight (kg) and height (cm).
 * Returns null for values outside a sensible human range.
 */
export function recommendPantsSize(weightKg: number, heightCm: number): FitRecommendation | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg < WEIGHT_RANGE.min || weightKg > WEIGHT_RANGE.max) return null;
  if (heightCm < HEIGHT_RANGE.min || heightCm > HEIGHT_RANGE.max) return null;

  const bmi = weightKg / Math.pow(heightCm / 100, 2);

  let best = FIT_RANGES[0];
  let bestScore = Number.POSITIVE_INFINITY;
  let exact = false;

  for (const range of FIT_RANGES) {
    const weightSpan = Math.max(4, range.maxWeight - range.minWeight);
    const heightSpan = Math.max(4, range.maxHeight - range.minHeight);

    const wOut = outside(weightKg, range.minWeight, range.maxWeight);
    const hOut = outside(heightCm, range.minHeight, range.maxHeight);
    const inside = wOut === 0 && hOut === 0;

    const weightMid = (range.minWeight + range.maxWeight) / 2;
    const heightMid = (range.minHeight + range.maxHeight) / 2;

    const penalty = (wOut / weightSpan) * 1.5 + (hOut / heightSpan) * 0.9;
    const centering =
      (Math.abs(weightKg - weightMid) / weightSpan) * 0.22 +
      (Math.abs(heightCm - heightMid) / heightSpan) * 0.1;

    const score = penalty * 10 + centering;

    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = range;
      exact = inside;
    }
  }

  const wOut = outside(weightKg, best.minWeight, best.maxWeight);
  const hOut = outside(heightCm, best.minHeight, best.maxHeight);

  let confidence: FitRecommendation['confidence'] = 'closest';
  let note = `Closest match in our fit chart. If you prefer a roomier leg, consider sizing up to the next size.`;

  if (exact) {
    confidence = 'exact';
    note = `Your weight and height sit inside our ${best.size} fit band — a confident match.`;
  } else if (wOut <= 4 && hOut <= 5) {
    confidence = 'close';
    note = `A close match for your proportions. Size up for a looser, floor-skimming drape.`;
  }

  return { size: best.size, bmi: Math.round(bmi * 10) / 10, confidence, note };
}
