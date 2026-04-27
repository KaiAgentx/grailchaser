/**
 * GET /api/tcg/cards/[id]/price-history
 *
 * Returns historical price points for sparkline rendering.
 *
 * Auth model:
 *   The price-history table (`card_price_history`) is intentionally shared
 *   across users — one timeline per catalog_card_id, not per user-owned card
 *   row. Two users who own the same Pikachu ex pull from the same history.
 *
 *   The user-ownership check is on the `cards` row (the [id] in the URL must
 *   belong to the requester); after that, the response reads history by
 *   the card's catalog_card_id. This means the API surface stays tied to a
 *   user's collection — there's no way to read history for a card you don't
 *   own — but the underlying storage isn't duplicated per-user.
 *
 * Future Phase: card_price_history grows by up to 8 rows per refresh-price
 * call per catalog card across all users. The 60s per-card cooldown bounds
 * upper growth rate, but with thousands of users hitting popular cards this
 * table will need dedup/rollup logic (e.g., one row per day per price_type
 * per source for points older than 30 days). Acceptable for Phase A.
 *
 * Query params:
 *   price_type (optional, default "tcg_market") — must match the
 *     card_price_history CHECK enum.
 *   days       (optional, default 30, min 1, max 365) — window of history.
 *
 * Response:
 *   { points: [{ captured_at, value_usd }, ...], price_type, days, catalog_card_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";

const ROUTE = "/api/tcg/cards/[id]/price-history";
const ECOSYSTEM = "tcg";

const VALID_PRICE_TYPES = [
  "tcg_market", "tcg_low", "tcg_mid", "tcg_high",
  "ebay_raw", "psa10", "psa9", "psa8",
] as const;
type PriceType = typeof VALID_PRICE_TYPES[number];

const DEFAULT_PRICE_TYPE: PriceType = "tcg_market";
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const MIN_DAYS = 1;

function isPriceType(v: string): v is PriceType {
  return (VALID_PRICE_TYPES as readonly string[]).includes(v);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(req.headers);
  const startedAt = Date.now();
  let userId: string | null = null;

  const respond = (resp: NextResponse): NextResponse => {
    resp.headers.set("X-Request-ID", requestId);
    logRequest({ requestId, route: ROUTE, method: "GET", userId, ecosystem: ECOSYSTEM, status: resp.status, latencyMs: Date.now() - startedAt, errorCode: resp.headers.get("x-error-code") });
    return resp;
  };

  try {
    // Auth
    userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return respond(errorResponse({ code: ErrorCode.UNAUTHORIZED, requestId }));

    // Card ID from path
    const { id: cardId } = await context.params;
    if (!cardId) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "card id required", requestId }));

    // Parse query params
    const priceTypeRaw = req.nextUrl.searchParams.get("price_type") || DEFAULT_PRICE_TYPE;
    if (!isPriceType(priceTypeRaw)) {
      return respond(errorResponse({
        code: ErrorCode.INVALID_BODY,
        details: `invalid price_type; must be one of: ${VALID_PRICE_TYPES.join(", ")}`,
        requestId,
      }));
    }
    const priceType: PriceType = priceTypeRaw;

    const daysRaw = req.nextUrl.searchParams.get("days");
    let days = DEFAULT_DAYS;
    if (daysRaw != null) {
      const parsed = parseInt(daysRaw, 10);
      if (!Number.isFinite(parsed)) {
        return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "days must be an integer", requestId }));
      }
      days = Math.max(MIN_DAYS, Math.min(MAX_DAYS, parsed));
    }

    // Ownership check via cards row. Service role read, scoped by user_id.
    const svc = serviceRoleClient();
    const { data: card, error: loadErr } = await svc
      .from("cards")
      .select("id, catalog_card_id")
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (loadErr) {
      console.error(`[${ROUTE}] load error:`, loadErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }
    if (!card || !card.catalog_card_id) {
      return respond(errorResponse({ code: ErrorCode.NOT_FOUND, details: "card not found", requestId }));
    }

    // Query history. Window = now() - days, sorted ascending for sparkline plot.
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: rows, error: histErr } = await svc
      .from("card_price_history")
      .select("captured_at, value_usd")
      .eq("catalog_card_id", card.catalog_card_id)
      .eq("price_type", priceType)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true });

    if (histErr) {
      console.error(`[${ROUTE}] history query failed:`, histErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }

    return respond(NextResponse.json({
      points: rows ?? [],
      price_type: priceType,
      days,
      catalog_card_id: card.catalog_card_id,
    }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
