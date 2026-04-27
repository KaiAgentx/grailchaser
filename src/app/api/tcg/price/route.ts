import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCardRawPrices } from "@/lib/ppt/client";

const ROUTE = "/api/tcg/price";
const ECOSYSTEM = "tcg";

// ─── In-memory price cache ───
// 15min balances TCGPlayer API rate limits against stale pricing during volatile market moves
const priceCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// EUR → USD conversion for the CardMarket fallback. Fixed for now; PPT and
// Pokemon TCG API are USD-native so this only fires for the rare cardmarket-
// only path (typically modern S&V Black Star Promos).
// TODO: replace with a daily-refreshed FX rate (e.g. via a /fx-rate endpoint
// that hits open.er-api.com or similar). 1.05 is a reasonable mid-2025 anchor.
const EUR_TO_USD = 1.05;

type PriceSource = "tcgplayer" | "ppt" | "cardmarket_eur" | null;

// Price type priority — pick the first one that has data
const PRICE_TYPE_PRIORITY = [
  "holofoil",
  "1stEditionHolofoil",
  "unlimitedHolofoil",
  "reverseHolofoil",
  "normal",
];

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);
  const startedAt = Date.now();
  let userId: string | null = null;

  const respond = (resp: NextResponse): NextResponse => {
    resp.headers.set("X-Request-ID", requestId);
    logRequest({ requestId, route: ROUTE, method: "GET", userId, ecosystem: ECOSYSTEM, status: resp.status, latencyMs: Date.now() - startedAt, errorCode: resp.headers.get("x-error-code") });
    return resp;
  };

  try {
    userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return respond(errorResponse({ code: ErrorCode.UNAUTHORIZED, requestId }));

    const limit = checkRateLimit(userId, "default");
    if (!limit.allowed) return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));

    const cardId = req.nextUrl.searchParams.get("cardId");
    if (!cardId) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "cardId required", requestId }));

    // Check cache
    const cached = priceCache.get(cardId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return respond(NextResponse.json(cached.data));
    }

    const apiKey = process.env.POKEMONTCG_API_KEY;
    if (!apiKey) {
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, details: "POKEMONTCG_API_KEY not configured", requestId }));
    }

    // ── Upstream Pokemon TCG API fetch with graceful degradation ──
    // When upstream returns non-ok OR throws, mark as missed and fall back to
    // the local catalog_cards row. The waterfall (stages 2 + 3) then runs
    // against whatever name/set_name/card_number we can synthesize. This
    // recovers from transient upstream blips (rate limits, brief 5xx, stale
    // CDN 404s) without showing the user "Unpriced" when we have a perfectly
    // good catalog row locally.
    //
    // apiRes.status is logged explicitly so future failures are diagnosable
    // (today we were flying blind on whether upstream returned 401/404/429).
    let card: any = null;
    let upstreamMissed = false;
    try {
      const apiRes = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, {
        headers: { "X-Api-Key": apiKey },
      });
      if (apiRes.ok) {
        const body = await apiRes.json();
        card = body?.data ?? null;
        if (!card) {
          upstreamMissed = true;
          console.warn(`[tcg/price] upstream 200 but body.data missing for ${cardId} — falling back to local catalog`);
        }
      } else {
        upstreamMissed = true;
        console.warn(`[tcg/price] upstream non-ok status=${apiRes.status} for ${cardId} — falling back to local catalog`);
      }
    } catch (fetchErr: any) {
      upstreamMissed = true;
      console.warn(`[tcg/price] upstream fetch threw for ${cardId}:`, fetchErr?.message ?? fetchErr);
    }

    // ── Local catalog fallback ──
    if (upstreamMissed) {
      const [setCode, ...numParts] = cardId.split("-");
      const cardNumber = numParts.join("-");
      if (setCode && cardNumber) {
        try {
          const sb = serviceRoleClient();
          const { data: row } = await sb
            .from("catalog_cards")
            .select("name, set_name, card_number")
            .eq("set_code", setCode)
            .eq("card_number", cardNumber)
            .limit(1)
            .maybeSingle();
          if (row) {
            // Synthesize a Pokemon-TCG-API-shaped object so the existing
            // waterfall code reads .name / .set.name / .number identically.
            // tcgplayer + cardmarket are absent → stages 1 and 3 skip naturally.
            card = {
              name: row.name,
              set: { name: row.set_name },
              number: row.card_number,
            };
            console.warn(`[tcg/price] catalog-fallback hit for ${cardId} — running stage 2 (PPT) only`);
          }
        } catch (catalogErr: any) {
          console.warn(`[tcg/price] catalog lookup threw for ${cardId}:`, catalogErr?.message ?? catalogErr);
        }
      }
    }

    // Genuine miss — both upstream and catalog have nothing.
    // Skip cache write: cardId might be a typo OR a future catalog row that
    // gets backfilled later; we don't want a 15min poison value.
    if (!card) {
      return respond(NextResponse.json(
        { ok: false, error: "card_not_found", message: `Card not found: ${cardId}` },
        { status: 404 }
      ));
    }

    // Extract TCGPlayer prices — pick best available price type
    const tcgPrices = card?.tcgplayer?.prices || {};
    let priceType: string | null = null;
    let tcgData: any = null;

    for (const pt of PRICE_TYPE_PRIORITY) {
      if (tcgPrices[pt] && (tcgPrices[pt].market || tcgPrices[pt].mid)) {
        priceType = pt;
        tcgData = tcgPrices[pt];
        break;
      }
    }

    // Build all TCGPlayer variants
    const allPrices: Record<string, { market: number | null; low: number | null; mid: number | null; high: number | null }> = {};
    for (const [type, data] of Object.entries(tcgPrices)) {
      allPrices[type] = {
        market: (data as any).market ?? null,
        low: (data as any).low ?? null,
        mid: (data as any).mid ?? null,
        high: (data as any).high ?? null,
      };
    }

    // Extract CardMarket prices
    const cm = card?.cardmarket?.prices || {};
    const reverseHoloCardmarket = cm ? {
      avg7: cm.reverseHoloAvg7 || null,
      avg30: cm.reverseHoloAvg30 || null,
      trend: cm.reverseHoloTrend || null,
    } : null;

    // ── Pricing waterfall ──
    // Stage 1 — TCGPlayer (USD) from Pokemon TCG API. Already extracted into tcgData.
    // Stage 2 — PPT (USD) when stage 1 is empty. Often covers older promos.
    // Stage 3 — CardMarket (EUR × 1.05) when both upstream sources are empty.
    //           Modern S&V Black Star Promos (svp-*) typically only have CM data.
    // Each stage's failure (network, missing key, no match) falls through silently.
    let market: number | null = tcgData?.market ?? null;
    let low: number | null = tcgData?.low ?? null;
    let mid: number | null = tcgData?.mid ?? null;
    let high: number | null = tcgData?.high ?? null;
    let source: PriceSource = market != null ? "tcgplayer" : null;
    let updatedAt: string | null = card?.tcgplayer?.updatedAt ?? null;

    // Stage 2 — PPT fallback
    if (source == null && card?.name && card?.set?.name && card?.number) {
      try {
        const pptOutcome = await getCardRawPrices({
          name: card.name,
          setName: card.set.name,
          cardNumber: String(card.number),
        });
        if (pptOutcome.status === "ok") {
          market = pptOutcome.prices.market;
          low = pptOutcome.prices.low;
          source = "ppt";
          updatedAt = pptOutcome.prices.lastUpdated ?? updatedAt;
        }
      } catch (err) {
        // Defense in depth — getCardRawPrices already swallows internal errors,
        // but if anything reaches here, log + continue.
        console.warn("[tcg/price] PPT fallback threw:", err instanceof Error ? err.message : err);
      }
    }

    // Stage 3 — CardMarket EUR fallback
    if (source == null) {
      const eurMarket = (typeof cm.avg7 === "number" && cm.avg7 > 0)
        ? cm.avg7
        : (typeof cm.trendPrice === "number" && cm.trendPrice > 0 ? cm.trendPrice : null);
      const eurLow = typeof cm.lowPrice === "number" && cm.lowPrice > 0 ? cm.lowPrice : null;
      if (eurMarket != null) {
        market = +(eurMarket * EUR_TO_USD).toFixed(2);
        if (eurLow != null) low = +(eurLow * EUR_TO_USD).toFixed(2);
        source = "cardmarket_eur";
      }
    }

    // No pricing data anywhere — card exists but no source yielded a market.
    if (source == null) {
      const notFoundResult = { ok: true, pricing: null, reason: "not_found" as const };
      priceCache.set(cardId, { data: notFoundResult, ts: Date.now() });
      return respond(NextResponse.json(notFoundResult));
    }

    const result = {
      ok: true as const,
      market,
      low,
      mid,
      high,
      avg7: cm.avg7 ?? null,
      avg30: cm.avg30 ?? null,
      trend: cm.trendPrice ?? null,
      priceType: priceType || "none",
      allPrices,
      reverseHoloCardmarket,
      updatedAt,
      tcgplayerUrl: card?.tcgplayer?.url ?? null,
      cardmarketUrl: card?.cardmarket?.url ?? null,
      currency: { tcgplayer: "USD", cardmarket: "EUR" },
      source,
    };

    // Cache the result
    priceCache.set(cardId, { data: result, ts: Date.now() });

    return respond(NextResponse.json(result));
  } catch (err: any) {
    console.error("[tcg/price] Error:", err.message);
    return respond(NextResponse.json({ ok: false, error: "price_fetch_failed", message: "Could not fetch pricing data" }, { status: 502 }));
  }
}
