// Abstracted PPT client — this is the single place we integrate PPT.
// Future methods to add as we expand:
//   getCardHistory(params, days)        - /cards?includeHistory=true
//   getSets()                           - /sets
//   getSealedProducts(setId?)           - /sealed-products
//   getPopulation(cardId)               - /population (2 credits)
//   parseListingTitle(title)            - POST /parse-title (2+ credits)

const BASE_URL = "https://www.pokemonpricetracker.com/api/v2";
const TIMEOUT_MS = 5000;
// Tighter timeout for the show-mode pricing waterfall — keeps total
// /api/tcg/price latency under ~1s in the rare miss case.
const RAW_TIMEOUT_MS = 800;

export interface GradedComps {
  raw_market: number | null;
  psa10_avg: number | null;
  psa9_avg: number | null;
  psa8_avg: number | null;
  trend30d: string | null;
  last_updated: string | null;
}

// Outcome discriminated union so callers can tell "PPT has no row" (not_found)
// apart from transport failures. Maps onto HTTP status in the route layer.
export type GradedCompsOutcome =
  | { status: "ok"; comps: GradedComps }
  | { status: "not_found" }
  | { status: "timeout" }
  | { status: "rate_limited"; retryAfterSeconds?: number }
  | { status: "error"; message?: string };

// "004/102" → "4"; "4" → "4"; "4/102" → "4"
function normalizeCardNumber(n: string | null | undefined): string {
  if (!n) return "";
  const base = n.split("/")[0];
  const stripped = base.replace(/^0+/, "");
  return stripped || base;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function getCardGradedComps(input: {
  name: string;
  setName: string;
  cardNumber: string;
  rarity?: string;
}): Promise<GradedCompsOutcome> {
  const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;
  if (!apiKey) {
    console.warn("[ppt] POKEMON_PRICE_TRACKER_API_KEY not set");
    return { status: "error", message: "api key not configured" };
  }

  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set("search", `${input.name} ${input.cardNumber}`);
  url.searchParams.set("set", input.setName);
  url.searchParams.set("includeEbay", "true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
      return { status: "rate_limited", retryAfterSeconds };
    }
    if (!res.ok) {
      console.warn(`[ppt] non-ok response: ${res.status}`);
      return { status: "error", message: `upstream ${res.status}` };
    }
    const body = await res.json();
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    if (rows.length === 0) return { status: "not_found" };

    const target = normalizeCardNumber(input.cardNumber);
    const exactNum = rows.filter(r => normalizeCardNumber(r?.cardNumber) === target);
    if (exactNum.length === 0) return { status: "not_found" };

    // If multiple rows share the same cardNumber (error variants, etc.),
    // prefer the one whose name matches the query exactly.
    const wantName = input.name.trim().toLowerCase();
    const match = exactNum.find(r => (r?.name ?? "").trim().toLowerCase() === wantName) ?? exactNum[0];

    const byGrade = match?.ebay?.salesByGrade ?? {};
    // Prefer eBay ungraded sold-comp smart market price — actual sold comps are
    // a better negotiation anchor at card shows than TCGPlayer retail asking.
    // Fall back to TCGPlayer market when eBay lacks ungraded data.
    const rawMarket = num(byGrade?.ungraded?.smartMarketPrice?.price) ?? num(match?.prices?.market);
    return {
      status: "ok",
      comps: {
        raw_market: rawMarket,
        psa10_avg: num(byGrade?.psa10?.averagePrice),
        psa9_avg: num(byGrade?.psa9?.averagePrice),
        psa8_avg: num(byGrade?.psa8?.averagePrice),
        trend30d: typeof byGrade?.ungraded?.marketTrend === "string" ? byGrade.ungraded.marketTrend : null,
        last_updated:
          (typeof match?.prices?.lastUpdated === "string" && match.prices.lastUpdated) ||
          (typeof match?.ebay?.updatedAt === "string" && match.ebay.updatedAt) ||
          null,
      },
    };
  } catch (err) {
    if ((err as any)?.name === "AbortError" || controller.signal.aborted) {
      return { status: "timeout" };
    }
    console.warn("[ppt] fetch failed:", err instanceof Error ? err.message : err);
    return { status: "error", message: err instanceof Error ? err.message : "fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Raw market prices (TCGPlayer-shape) — used by /api/tcg/price waterfall ───
//
// Different return shape from getCardGradedComps because the show-mode pricing
// path wants TCGPlayer-style market/low (PPT's prices.* section) for dealer-
// anchor consistency, NOT eBay sold-comp data. PPT often has TCGPlayer pricing
// for promos and older sets that the Pokemon TCG API misses.

export interface PptRawPrices {
  market: number | null;
  low: number | null;
  lastUpdated: string | null;
}

export type PptRawOutcome =
  | { status: "ok"; prices: PptRawPrices }
  | { status: "not_found" }
  | { status: "error"; message?: string };

/**
 * Fetch TCGPlayer-style raw market prices from PPT for a single catalog card.
 * Returns "not_found" when PPT has no row matching name+cardNumber, "error" on
 * transport failure / missing API key. Never throws. Used as waterfall stage 2
 * in /api/tcg/price.
 *
 * Per Show Mode pricing decision: explicitly does NOT fall back to PPT's
 * eBay smartMarketPrice — that runs higher than TCGPlayer market and breaks
 * dealer-anchor consistency with stage 1 (Pokemon TCG API → TCGPlayer).
 * If PPT row exists but prices.market is null → status: "not_found",
 * so the waterfall can continue to CardMarket.
 */
export async function getCardRawPrices(input: {
  name: string;
  setName: string;
  cardNumber: string;
}): Promise<PptRawOutcome> {
  const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;
  if (!apiKey) {
    console.warn("[ppt-raw] POKEMON_PRICE_TRACKER_API_KEY not set");
    return { status: "error", message: "api key not configured" };
  }

  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set("search", `${input.name} ${input.cardNumber}`);
  url.searchParams.set("set", input.setName);
  // Skip includeEbay — we don't read it on this path; saves payload size.

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RAW_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[ppt-raw] non-ok response: ${res.status}`);
      return { status: "error", message: `upstream ${res.status}` };
    }
    const body = await res.json();
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    if (rows.length === 0) return { status: "not_found" };

    // Filter to exact cardNumber matches; pick the one with name match.
    const target = normalizeCardNumber(input.cardNumber);
    const exactNum = rows.filter(r => normalizeCardNumber(r?.cardNumber) === target);
    if (exactNum.length === 0) return { status: "not_found" };

    const wantName = input.name.trim().toLowerCase();
    const match = exactNum.find(r => (r?.name ?? "").trim().toLowerCase() === wantName) ?? exactNum[0];

    const market = num(match?.prices?.market);
    const low = num(match?.prices?.low);

    // No TCGPlayer market price on this row → don't fall back to eBay sold-comp;
    // bubble up "not_found" so the waterfall can continue to CardMarket.
    if (market == null && low == null) return { status: "not_found" };

    return {
      status: "ok",
      prices: {
        market,
        low,
        lastUpdated: typeof match?.prices?.lastUpdated === "string" ? match.prices.lastUpdated : null,
      },
    };
  } catch (err) {
    if ((err as any)?.name === "AbortError" || controller.signal.aborted) {
      console.warn(`[ppt-raw] timed out after ${RAW_TIMEOUT_MS}ms`);
      return { status: "error", message: "timeout" };
    }
    console.warn("[ppt-raw] fetch failed:", err instanceof Error ? err.message : err);
    return { status: "error", message: err instanceof Error ? err.message : "fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}
