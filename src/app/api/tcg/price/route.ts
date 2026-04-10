import { NextRequest, NextResponse } from "next/server";
import { extractUserId } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";

const ROUTE = "/api/tcg/price";
const ECOSYSTEM = "tcg";

// ─── In-memory price cache (1 hour TTL per cardId) ───
const priceCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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

    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) {
      console.log(`[tcg/price] Pokemon API ${res.status} for ${cardId}`);
      return respond(errorResponse({ code: ErrorCode.NOT_FOUND, details: `Card not found: ${cardId}`, requestId }));
    }

    const { data: card } = await res.json();

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

    const result = {
      market: tcgData?.market ?? null,
      low: tcgData?.low ?? null,
      mid: tcgData?.mid ?? null,
      high: tcgData?.high ?? null,
      avg7: cm.avg7 ?? null,
      avg30: cm.avg30 ?? null,
      trend: cm.trendPrice ?? null,
      priceType: priceType || "none",
      allPrices,
      reverseHoloCardmarket,
      updatedAt: card?.tcgplayer?.updatedAt ?? null,
      tcgplayerUrl: card?.tcgplayer?.url ?? null,
      cardmarketUrl: card?.cardmarket?.url ?? null,
      currency: { tcgplayer: "USD", cardmarket: "EUR" },
    };

    // Cache the result
    priceCache.set(cardId, { data: result, ts: Date.now() });

    return respond(NextResponse.json(result));
  } catch (err: any) {
    console.error("[tcg/price] Error:", err.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
