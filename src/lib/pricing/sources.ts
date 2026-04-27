/**
 * Unified pricing fetcher.
 *
 * Combines two upstream sources:
 *   - Scrydex / Pokemon TCG API → TCGPlayer market/low/mid/high
 *   - PPT (Pokemon Price Tracker) → eBay sold comps + PSA grade comps
 *
 * Both calls run in parallel. If one source fails (network error, 404, missing
 * key, timeout) the other source's fields still populate; the failed source
 * contributes null fields and never throws.
 */

import { getCardGradedComps } from "@/lib/ppt/client";

const SCRYDEX_TIMEOUT_MS = 5000;
const PRICE_TYPE_PRIORITY = ["holofoil", "1stEditionHolofoil", "unlimitedHolofoil", "reverseHolofoil", "normal"];

export interface PricingPayload {
  // TCGPlayer (from Scrydex)
  tcgplayer_market_usd: number | null;
  tcgplayer_low_usd: number | null;
  tcgplayer_mid_usd: number | null;
  tcgplayer_high_usd: number | null;
  tcgplayer_avg7_usd: number | null;
  tcgplayer_avg30_usd: number | null;

  // eBay (from PPT graded-comps)
  ebay_raw_avg_usd: number | null;
  psa10_avg_usd: number | null;
  psa9_avg_usd: number | null;
  psa8_avg_usd: number | null;

  // Trend/derivatives
  trend_30d_direction: "up" | "down" | "flat" | null;
  trend_30d_pct: number | null;

  // Meta
  price_source: "tcgplayer" | "ebay" | "mixed";
  last_updated: string; // ISO timestamp

  // Source-specific raw responses (for debug + future fields)
  raw_scrydex?: unknown;
  raw_ppt?: unknown;
}

interface ScrydexNormalized {
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  updatedAt: string | null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Fetch TCGPlayer pricing from the Pokemon TCG API for a single catalog card id
 * (e.g. "sv8-219"). Picks the highest-priority price type the card actually has
 * data for. Returns null on any failure (no key, network error, timeout, 4xx,
 * card has no TCGPlayer prices) — caller treats absence as "Scrydex contributed
 * nothing" rather than a hard error.
 */
async function fetchScrydex(catalogCardId: string): Promise<ScrydexNormalized | null> {
  const apiKey = process.env.POKEMONTCG_API_KEY;
  if (!apiKey) {
    console.warn("[pricing] POKEMONTCG_API_KEY not set; skipping scrydex");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRYDEX_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${catalogCardId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status !== 404) console.warn(`[pricing] scrydex ${res.status} for ${catalogCardId}`);
      return null;
    }
    const body = await res.json();
    const card = body?.data;
    const tcgPrices = card?.tcgplayer?.prices || {};

    let priceData: any = null;
    for (const pt of PRICE_TYPE_PRIORITY) {
      const p = tcgPrices[pt];
      if (p && (p.market || p.mid)) {
        priceData = p;
        break;
      }
    }
    if (!priceData) return null;

    return {
      market: num(priceData.market),
      low: num(priceData.low),
      mid: num(priceData.mid),
      high: num(priceData.high),
      updatedAt: typeof card?.tcgplayer?.updatedAt === "string" ? card.tcgplayer.updatedAt : null,
    };
  } catch (err) {
    if ((err as any)?.name === "AbortError" || controller.signal.aborted) {
      console.warn(`[pricing] scrydex timed out after ${SCRYDEX_TIMEOUT_MS}ms for ${catalogCardId}`);
    } else {
      console.warn("[pricing] scrydex fetch failed:", err instanceof Error ? err.message : err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch pricing from Scrydex (TCGPlayer) and PPT (eBay/PSA) in parallel and
 * return a normalized payload. Failures on either side produce null fields,
 * never throw — the function always resolves with a valid PricingPayload.
 *
 * `last_updated` prefers the freshest source-reported timestamp and falls
 * back to now() if neither source returns one.
 *
 * `price_source` attribution (per Phase A decision):
 *   - both sources returned data → "mixed"
 *   - only Scrydex returned data → "tcgplayer"
 *   - only PPT returned data → "ebay" (PPT's primary value prop is eBay sold-
 *     comp data; if PPT silently fell back to TCGPlayer internally, its response
 *     doesn't reliably expose that, so we label it "ebay" by default)
 *   - neither source returned data → "ebay" (raw_value will be null regardless)
 *
 * @example
 *   const p = await fetchAllPrices({
 *     catalogCardId: "sv8-219",
 *     name: "Pikachu ex",
 *     setName: "Surging Sparks",
 *     cardNumber: "219",
 *   });
 *   const rawValue = deriveRawValue(p);
 */
export async function fetchAllPrices(args: {
  catalogCardId: string;
  name: string;
  setName: string;
  cardNumber: string;
}): Promise<PricingPayload> {
  const [scrydex, pptOutcome] = await Promise.all([
    fetchScrydex(args.catalogCardId),
    getCardGradedComps({ name: args.name, setName: args.setName, cardNumber: args.cardNumber }),
  ]);

  const ppt = pptOutcome.status === "ok" ? pptOutcome.comps : null;

  // Map PPT's trend direction string to our enum.
  // TODO: trend_30d_pct stays null until we can compute a magnitude from
  // card_price_history deltas (Phase B / sparkline work).
  const trendStr = typeof ppt?.trend30d === "string" ? ppt.trend30d.toLowerCase() : null;
  const trend_30d_direction: PricingPayload["trend_30d_direction"] =
    trendStr === "up" ? "up" :
    trendStr === "down" ? "down" :
    (trendStr === "stable" || trendStr === "flat") ? "flat" :
    null;

  const tcgplayer_market_usd = scrydex?.market ?? null;
  const ebay_raw_avg_usd = ppt?.raw_market ?? null;

  const hasScrydex = tcgplayer_market_usd != null;
  const hasPpt = ebay_raw_avg_usd != null;
  const price_source: PricingPayload["price_source"] =
    hasScrydex && hasPpt ? "mixed" :
    hasScrydex ? "tcgplayer" :
    "ebay";

  const last_updated =
    (ppt?.last_updated && typeof ppt.last_updated === "string" ? ppt.last_updated : null) ??
    (scrydex?.updatedAt ?? null) ??
    new Date().toISOString();

  return {
    tcgplayer_market_usd,
    tcgplayer_low_usd: scrydex?.low ?? null,
    tcgplayer_mid_usd: scrydex?.mid ?? null,
    tcgplayer_high_usd: scrydex?.high ?? null,
    // TODO: tcgplayer_avg7_usd / avg30_usd populated when Scrydex direct
    // integration lands. The current Pokemon TCG API surfaces only CardMarket
    // (EUR) avgs, not TCGPlayer USD — left null intentionally.
    tcgplayer_avg7_usd: null,
    tcgplayer_avg30_usd: null,

    ebay_raw_avg_usd,
    psa10_avg_usd: ppt?.psa10_avg ?? null,
    psa9_avg_usd: ppt?.psa9_avg ?? null,
    psa8_avg_usd: ppt?.psa8_avg ?? null,

    trend_30d_direction,
    trend_30d_pct: null,

    price_source,
    last_updated,
    raw_scrydex: scrydex,
    raw_ppt: pptOutcome,
  };
}

/**
 * Pick the canonical raw_value from a pricing payload.
 *
 * Policy (Phase A): TCGPlayer market is the conservative dealer-anchor
 * reference — what a buyer would actually pay at a card show. Falls back to
 * eBay raw sold-comp average when Scrydex contributed no data. Returns null
 * only when neither source has a price (truly unpriced card).
 *
 *   1st: tcgplayer_market_usd
 *   2nd: ebay_raw_avg_usd
 *   3rd: null
 *
 * @example
 *   const p = await fetchAllPrices({...});
 *   const rawValue = deriveRawValue(p);
 *   // → number when at least one source returned data, null otherwise
 */
export function deriveRawValue(p: PricingPayload): number | null {
  if (p.tcgplayer_market_usd != null) return p.tcgplayer_market_usd;
  if (p.ebay_raw_avg_usd != null) return p.ebay_raw_avg_usd;
  return null;
}
