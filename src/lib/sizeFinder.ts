import type { SizeChartRow } from '../types/database';

export interface SizeRecommendation {
  recommendedSize: string;
  row: SizeChartRow;
  matchQuality: 'exact' | 'close' | 'closest';
  note: string;
}

function outsideRangeDistance(value: number, min: number, max: number): number {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

/**
 * Product-specific Smart Size Finder.
 * Uses only weight (kg) and height (cm) against the product's own database size chart rows.
 */
export function recommendSizeFromChart(
  sizeCharts: SizeChartRow[],
  weightKg: number,
  heightCm: number
): SizeRecommendation | null {
  if (!sizeCharts || sizeCharts.length === 0) return null;
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const sorted = [...sizeCharts].sort((a, b) => a.size_order - b.size_order);

  let bestRow = sorted[0];
  let bestScore = Number.POSITIVE_INFINITY;
  let bestExact = false;

  for (const row of sorted) {
    const wOut = outsideRangeDistance(weightKg, row.weight_min_kg, row.weight_max_kg);
    const hOut = outsideRangeDistance(heightCm, row.height_min_cm, row.height_max_cm);
    const isExact = wOut === 0 && hOut === 0;

    const wSpan = Math.max(4, row.weight_max_kg - row.weight_min_kg);
    const hSpan = Math.max(4, row.height_max_cm - row.height_min_cm);

    const wMid = (row.weight_min_kg + row.weight_max_kg) / 2;
    const hMid = (row.height_min_cm + row.height_max_cm) / 2;

    const outPenalty = (wOut / wSpan) * 1.4 + (hOut / hSpan) * 1.0;
    const midDistance =
      (Math.abs(weightKg - wMid) / wSpan) * 0.25 + (Math.abs(heightCm - hMid) / hSpan) * 0.15;

    const score = outPenalty * 10 + midDistance;

    if (score < bestScore) {
      bestScore = score;
      bestRow = row;
      bestExact = isExact;
    }
  }

  const wDist = outsideRangeDistance(weightKg, bestRow.weight_min_kg, bestRow.weight_max_kg);
  const hDist = outsideRangeDistance(heightCm, bestRow.height_min_cm, bestRow.height_max_cm);

  let matchQuality: 'exact' | 'close' | 'closest' = 'closest';
  let note =
    'Estimate only: Based on your measurements, this is the closest match in this garment’s size chart. Review the manual measurements below for your preferred fit.';

  if (bestExact) {
    matchQuality = 'exact';
    note =
      'Estimate only: Your weight and height fall directly within this garment’s recommended range for size ' +
      bestRow.size_name +
      '.';
  } else if (wDist <= 4 && hDist <= 5) {
    matchQuality = 'close';
    note =
      'Estimate only: Size ' +
      bestRow.size_name +
      ' is a close match for your proportions. Check waist and hip measurements below if you prefer a looser or tighter silhouette.';
  }

  return {
    recommendedSize: bestRow.size_name,
    row: bestRow,
    matchQuality,
    note,
  };
}
