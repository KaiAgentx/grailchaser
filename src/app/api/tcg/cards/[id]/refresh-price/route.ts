/**
 * POST /api/tcg/cards/[id]/refresh-price
 *
 * On-demand price refresh. Fetches from Scrydex (TCGPlayer) and PPT (eBay/PSA)
 * in parallel via fetchAllPrices(), writes the full multi-source pricing
 * payload onto the card row, and inserts one row per non-null price into
 * card_price_history for sparkline use.
 *
 * Cooldown: 60s per card via last_price_check_at. ALWAYS set on completion,
 * even when both sources returned no data — prevents retry-storms on truly
 * unpriced cards.
 *
 * Non-destructive on failure: a transient upstream error returns the existing
 * price untouched (null fields are written, but raw_value falls through to
 * deriveRawValue which prefers any source that did return).
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { fetchAllPrices, deriveRawValue, type PricingPayload } from "@/lib/pricing/sources";
import { calcTier } from "@/lib/utils";

const ROUTE = "/api/tcg/cards/[id]/refresh-price";
const ECOSYSTEM = "tcg";
const COOLDOWN_MS = 60_000; // 60 seconds per card

interface HistoryRow {
  catalog_card_id: string;
  price_type: "tcg_market" | "tcg_low" | "tcg_mid" | "tcg_high" | "ebay_raw" | "psa10" | "psa9" | "psa8";
  value_usd: number;
  source: "scrydex" | "ppt";
}

function buildHistoryRows(catalogCardId: string, p: PricingPayload): HistoryRow[] {
  const rows: HistoryRow[] = [];
  const push = (price_type: HistoryRow["price_type"], value_usd: number | null, source: HistoryRow["source"]) => {
    if (value_usd != null) rows.push({ catalog_card_id: catalogCardId, price_type, value_usd, source });
  };
  push("tcg_market", p.tcgplayer_market_usd, "scrydex");
  push("tcg_low",    p.tcgplayer_low_usd,    "scrydex");
  push("tcg_mid",    p.tcgplayer_mid_usd,    "scrydex");
  push("tcg_high",   p.tcgplayer_high_usd,   "scrydex");
  push("ebay_raw",   p.ebay_raw_avg_usd,     "ppt");
  push("psa10",      p.psa10_avg_usd,        "ppt");
  push("psa9",       p.psa9_avg_usd,         "ppt");
  push("psa8",       p.psa8_avg_usd,         "ppt");
  return rows;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(req.headers);
  const startedAt = Date.now();
  let userId: string | null = null;

  const respond = (resp: NextResponse): NextResponse => {
    resp.headers.set("X-Request-ID", requestId);
    logRequest({ requestId, route: ROUTE, method: "POST", userId, ecosystem: ECOSYSTEM, status: resp.status, latencyMs: Date.now() - startedAt, errorCode: resp.headers.get("x-error-code") });
    return resp;
  };

  try {
    // Auth
    userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return respond(errorResponse({ code: ErrorCode.UNAUTHORIZED, requestId }));

    // User-scoped rate limit
    const limit = checkRateLimit(userId, "default");
    if (!limit.allowed) {
      return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));
    }

    // Card ID from params
    const { id: cardId } = await context.params;
    if (!cardId) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "card id required", requestId }));

    // Load card row
    const svc = serviceRoleClient();
    const { data: card, error: loadErr } = await svc
      .from("cards")
      .select("id, user_id, player, set, card_number, catalog_card_id, raw_value, tier, last_price_check_at")
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (loadErr) {
      console.error(`[${ROUTE}] load error:`, loadErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }
    if (!card) return respond(errorResponse({ code: ErrorCode.NOT_FOUND, details: "card not found", requestId }));

    // Per-card 60s cooldown
    if (card.last_price_check_at) {
      const elapsed = Date.now() - new Date(card.last_price_check_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return respond(NextResponse.json(
          { outcome: "rate_limited", retry_after_seconds: retryAfter, card },
          { status: 429, headers: { "Retry-After": String(retryAfter) } }
        ));
      }
    }

    // Fetch from both sources in parallel. Resolves with partial data on
    // upstream failure; never throws.
    const payload = await fetchAllPrices({
      catalogCardId: card.catalog_card_id || "",
      name: card.player,
      setName: card.set,
      cardNumber: card.card_number,
    });

    const newRawValue = deriveRawValue(payload);
    const newTier = calcTier(newRawValue);
    const nowIso = new Date().toISOString();

    // CRITICAL: last_price_check_at is set on EVERY completion, including the
    // both-sources-empty path. Earlier today this branch left the cooldown
    // unset on not_found, producing a retry-storm against PPT for unpriced
    // cards (Bisharp/Dedenne/Spewpa/Espurr). Don't reintroduce that.
    const updates = {
      raw_value: newRawValue,
      tier: newTier,
      last_price_check_at: nowIso,

      // TCGPlayer
      tcgplayer_market_usd: payload.tcgplayer_market_usd,
      tcgplayer_low_usd:    payload.tcgplayer_low_usd,
      tcgplayer_mid_usd:    payload.tcgplayer_mid_usd,
      tcgplayer_high_usd:   payload.tcgplayer_high_usd,
      tcgplayer_avg7_usd:   payload.tcgplayer_avg7_usd,   // null in Phase A
      tcgplayer_avg30_usd:  payload.tcgplayer_avg30_usd,  // null in Phase A
      tcgplayer_listings_count: null, // null in Phase A (Pokemon TCG API doesn't surface)
      tcgplayer_sellers_count:  null, // null in Phase A

      // eBay + PSA grades
      ebay_raw_avg_usd: payload.ebay_raw_avg_usd,
      psa10_avg_usd:    payload.psa10_avg_usd,
      psa9_avg_usd:     payload.psa9_avg_usd,
      psa8_avg_usd:     payload.psa8_avg_usd,

      // Population — null in Phase A (PPT Business tier)
      psa10_pop: null,
      psa9_pop:  null,
      psa8_pop:  null,

      // Trend / volatility
      trend_30d_direction: payload.trend_30d_direction,
      trend_30d_pct:       payload.trend_30d_pct,    // null in Phase A
      volatility_30d:      null,                      // null in Phase A
      avg_sale_30d_usd:    null,                      // null in Phase A
      time_to_sell_days:   null,                      // null in Phase A

      // Source attribution
      price_source:          payload.price_source,
      price_data_updated_at: payload.last_updated,
    };

    const { data: updated, error: updateErr } = await svc
      .from("cards")
      .update(updates)
      .eq("id", cardId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateErr) {
      console.error(`[${ROUTE}] update error:`, updateErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }

    // Best-effort price-history insert. Skipped if the card lacks a
    // catalog_card_id (legacy rows) or if the upsert returns no non-null
    // values to record. A failure here is logged but does not fail the
    // user's request — history is a derived log; the card row carries the
    // canonical pricing state.
    if (card.catalog_card_id) {
      const historyRows = buildHistoryRows(card.catalog_card_id, payload);
      if (historyRows.length > 0) {
        const { error: histErr } = await svc.from("card_price_history").insert(historyRows);
        if (histErr) console.warn(`[${ROUTE}] history insert failed:`, histErr.message);
      }
    }

    const outcome = newRawValue != null ? "refreshed" : "not_found";

    return respond(NextResponse.json({
      outcome,
      card: updated,
      before: { raw_value: card.raw_value, tier: card.tier },
      after:  { raw_value: newRawValue, tier: newTier },
    }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
