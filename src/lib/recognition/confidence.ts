/**
 * Confidence bands for hash-based card matching.
 *
 * Thresholds are placeholders for Phase 1A and will be tuned
 * in Phase 1B against the benchmark dataset.
 */

export type ConfidenceBand = "exact" | "likely" | "choose_version" | "unclear";

/** Weighted-distance thresholds. Values are inclusive upper bounds. */
export const CONFIDENCE_THRESHOLDS = {
  exact: 6,
  likely: 12,
  choose_version: 20,
} as const;

/**
 * Map a weighted distance to a confidence band.
 *
 * @param d — weighted distance from weightedDistance()
 * @returns the confidence band
 */
export function bandFromDistance(d: number): ConfidenceBand {
  if (d <= CONFIDENCE_THRESHOLDS.exact) return "exact";
  if (d <= CONFIDENCE_THRESHOLDS.likely) return "likely";
  if (d <= CONFIDENCE_THRESHOLDS.choose_version) return "choose_version";
  return "unclear";
}
