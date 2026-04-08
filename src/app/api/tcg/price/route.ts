import { NextRequest, NextResponse } from "next/server";

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
  const cardId = req.nextUrl.searchParams.get("cardId");
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  // Check cache
  const cached = priceCache.get(cardId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const apiKey = process.env.POKEMONTCG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "POKEMONTCG_API_KEY not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) {
      console.log(`[tcg/price] Pokemon API ${res.status} for ${cardId}`);
      return NextResponse.json({ error: `Card not found: ${cardId}` }, { status: 404 });
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

    // Extract CardMarket prices
    const cm = card?.cardmarket?.prices || {};

    const result = {
      market: tcgData?.market ?? null,
      low: tcgData?.low ?? null,
      mid: tcgData?.mid ?? null,
      high: tcgData?.high ?? null,
      avg7: cm.avg7 ?? null,
      avg30: cm.avg30 ?? null,
      trend: cm.trendPrice ?? null,
      priceType: priceType || "none",
      updatedAt: card?.tcgplayer?.updatedAt ?? null,
      tcgplayerUrl: card?.tcgplayer?.url ?? null,
      cardmarketUrl: card?.cardmarket?.url ?? null,
    };

    // Cache the result
    priceCache.set(cardId, { data: result, ts: Date.now() });

    console.log(`[tcg/price] ${cardId}: market=$${result.market} type=${result.priceType}`);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[tcg/price] Error:", err.message);
    return NextResponse.json({ error: "Price lookup failed" }, { status: 500 });
  }
}
