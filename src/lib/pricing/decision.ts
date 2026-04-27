/**
 * Show Mode decision metrics.
 *
 * Pure-function utility for live deal-flow math: given a card's pricing
 * payload + the user's "Dealer Ask" input, computes the verdict / max-buy
 * ceiling / risk level / ROI estimates that drive the show-mode UI.
 *
 * No DB access, no async. Re-runs on every keystroke as the user adjusts
 * the ask price.
 */

// ─── Policy constants ───
//
// All thresholds and assumptions are hardcoded for Phase B. Each constant
// is a TODO for a future user-settings surface — different collectors will
// want to dial these.

/**
 * Maximum acceptable buy as a fraction of TCGPlayer market.
 * 0.75 → "don't pay more than 75% of TCGPlayer market".
 * Above this the verdict flips to 'above_max'.
 * TODO: surface as a user setting in profile preferences.
 */
const MAX_BUY_PCT = 0.75;

/**
 * Risk-level thresholds, expressed as the ask's percent of market.
 * Below RISK_LOW_BAND (50% of market) → 'low' risk (clear deal).
 * Below RISK_HIGH_BAND (80% of market) → 'medium' risk.
 * At or above RISK_HIGH_BAND → 'high' risk (paying near or above retail).
 * TODO: surface as a user setting.
 */
const RISK_LOW_BAND = 0.50;
const RISK_HIGH_BAND = 0.80;

/**
 * Flat shipping estimate for a single raw card sold on eBay (BMWT/PWE
 * average). Used to net out from raw_resale ROI.
 * TODO: tier by sale price (PWE for low value, BMWT for mid, box for high).
 */
const SHIPPING_EST_USD = 4;

/**
 * PSA value-tier grading cost. Excludes shipping/insurance to PSA.
 * TODO: support other graders (BGS, CGC) once a grader-pref setting lands.
 */
const PSA_GRADING_COST = 25;

/**
 * Probability the card grades PSA 10. Used to compute expected value of
 * the PSA submission path: gem_value × p(10) + nine_value × p(9) + ...
 * Phase B simplifies to a 2-grade model (10 vs 9).
 *
 * 0.4 is a pessimistic raw-shipping-quality default. The real probability
 * comes from a per-card Grade Check assessment. When a card has a recent
 * last_psa10_probability, callers should override this default. For Phase
 * B no override path exists yet — every card uses GEM_RATE.
 */
const GEM_RATE = 0.4;

// ─── Types ───

export interface DecisionContext {
  /** What the dealer is asking — the only user-supplied field. */
  ask_usd: number;
  /** TCGPlayer market price; the canonical "Market Value" anchor. */
  tcgplayer_market_usd: number | null;
  /** eBay raw sold-comp average; the resale anchor. */
  ebay_raw_avg_usd: number | null;
  /** Average sold PSA 10 price. Used in the grade-path ROI estimate. */
  psa10_avg_usd: number | null;
  /** Average sold PSA 9 price. Used in the grade-path expected value. */
  psa9_avg_usd: number | null;
}

export type RiskLevel = "low" | "medium" | "high";

export interface DecisionMetrics {
  /** ask / market × 100. null when market is unknown. */
  pct_of_market: number | null;
  /** (market − ask) / market × 100. null when market is unknown. */
  pct_off_comp: number | null;
  /** market × MAX_BUY_PCT (the recommended ceiling). null when market unknown. */
  max_buy_usd: number | null;
  /** True if ask exceeds max_buy_usd. False when market is unknown
   *  (can't be above an unset ceiling). */
  above_max: boolean;
  /** Banded risk read. Defaults to 'high' when market is unknown. */
  risk_level: RiskLevel;
  /** Net-and-percent estimates for the two viable resale paths. Each path
   *  is null when the input data needed for it is missing. */
  roi_estimates: {
    /** Sell raw on eBay. net = ebay_raw_avg − ask − ship. */
    raw_resale: { net_usd: number; pct: number } | null;
    /** Submit for PSA grading. expected_value weights PSA10/PSA9 by GEM_RATE.
     *  Only populated when both psa10_avg_usd AND psa9_avg_usd are non-null. */
    psa10_path: { expected_net_usd: number; pct: number } | null;
  };
}

// ─── Compute ───

/**
 * Compute decision metrics from a pricing context.
 *
 * Edge cases:
 *   - ask_usd <= 0 produces NaN/Infinity in pct math; caller is responsible
 *     for not invoking with invalid asks. UI gates the call behind a
 *     positive-number input.
 *   - market unknown → market-derived fields are all null, above_max=false,
 *     risk_level falls back to 'high' (default-safe for the user).
 *   - Either ROI estimate may be null independently.
 *
 * @example
 *   const m = computeDecisionMetrics({
 *     ask_usd: 25,
 *     tcgplayer_market_usd: 31.24,
 *     ebay_raw_avg_usd: 56.50,
 *     psa10_avg_usd: 174.76,
 *     psa9_avg_usd: 39.36,
 *   });
 *   // m.pct_of_market ≈ 80.0
 *   // m.max_buy_usd ≈ 23.43
 *   // m.above_max = true
 *   // m.risk_level = 'high'
 *   // m.roi_estimates.raw_resale ≈ { net_usd: 27.50, pct: 110.0 }
 *   // m.roi_estimates.psa10_path ≈ { expected_net_usd: 39.52, pct: 158.1 }
 */
export function computeDecisionMetrics(ctx: DecisionContext): DecisionMetrics {
  const { ask_usd, tcgplayer_market_usd, ebay_raw_avg_usd, psa10_avg_usd, psa9_avg_usd } = ctx;

  let pct_of_market: number | null = null;
  let pct_off_comp: number | null = null;
  let max_buy_usd: number | null = null;
  let above_max = false;
  let risk_level: RiskLevel = "high";

  if (tcgplayer_market_usd != null && tcgplayer_market_usd > 0) {
    pct_of_market = (ask_usd / tcgplayer_market_usd) * 100;
    pct_off_comp = ((tcgplayer_market_usd - ask_usd) / tcgplayer_market_usd) * 100;
    max_buy_usd = tcgplayer_market_usd * MAX_BUY_PCT;
    above_max = ask_usd > max_buy_usd;

    if (pct_of_market < RISK_LOW_BAND * 100) risk_level = "low";
    else if (pct_of_market < RISK_HIGH_BAND * 100) risk_level = "medium";
    else risk_level = "high";
  }

  // Raw resale: sell ungraded on eBay
  let raw_resale: { net_usd: number; pct: number } | null = null;
  if (ebay_raw_avg_usd != null) {
    const net = ebay_raw_avg_usd - ask_usd - SHIPPING_EST_USD;
    raw_resale = {
      net_usd: net,
      pct: ask_usd > 0 ? (net / ask_usd) * 100 : 0,
    };
  }

  // PSA path: submit for grading; expected_value weights 10/9
  let psa10_path: { expected_net_usd: number; pct: number } | null = null;
  if (psa10_avg_usd != null && psa9_avg_usd != null) {
    const expected_value = GEM_RATE * psa10_avg_usd + (1 - GEM_RATE) * psa9_avg_usd;
    const expected_net = expected_value - ask_usd - PSA_GRADING_COST - SHIPPING_EST_USD;
    psa10_path = {
      expected_net_usd: expected_net,
      pct: ask_usd > 0 ? (expected_net / ask_usd) * 100 : 0,
    };
  }

  return {
    pct_of_market,
    pct_off_comp,
    max_buy_usd,
    above_max,
    risk_level,
    roi_estimates: { raw_resale, psa10_path },
  };
}
