import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { player, year, set, card_number, sport } = await request.json();
    const apiKey = process.env.CARDSIGHT_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No CARDSIGHT_API_KEY in environment" }, { status: 400 });
    }

    if (!player) {
      return NextResponse.json({ error: "Player name required" }, { status: 400 });
    }

    // Step 1: Search for the card — include set/brand if provided for better matching
    const query = [player, set].filter(Boolean).join(" ");
    const searchParams = new URLSearchParams({ q: query });
    if (year) searchParams.set("year", String(year));

    console.log("=== CARDSIGHT PRICE SEARCH ===");
    console.log("Query:", query, "| Year:", year || "any");

    const searchRes = await fetch("https://api.cardsight.ai/v1/catalog/search?" + searchParams.toString(), {
      headers: { "X-API-Key": apiKey },
    });
    const searchData = await searchRes.json();
    console.log("Search status:", searchRes.status);
    console.log("Results:", JSON.stringify(searchData).substring(0, 500));

    const cards = searchData.results || [];
    if (cards.length === 0) {
      return NextResponse.json({ error: "Card not found", query: player });
    }

    // Prefer exact player name match (not multi-player cards)
    let match = cards[0];
    const exactMatch = cards.find((c: any) => c.name === player);
    if (exactMatch) match = exactMatch;

    console.log("Selected card:", match.id, match.name, match.setName, match.releaseName, match.year);

    // Step 2: Get pricing data
    const priceRes = await fetch("https://api.cardsight.ai/v1/pricing/" + match.id + "?period=90d", {
      headers: { "X-API-Key": apiKey },
    });
    const priceData = await priceRes.json();

    const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };

    // Raw prices
    if (priceData.raw && priceData.raw.count > 0) {
      const rawPrices = priceData.raw.records.map((r: any) => r.price);
      prices.raw = +(rawPrices.reduce((s: number, p: number) => s + p, 0) / rawPrices.length).toFixed(2);
      console.log(`[Raw] Avg: $${prices.raw} from ${rawPrices.length} sales (sample: $${rawPrices.slice(0, 3).join(", $")})`);
    }

    // Graded prices — find PSA specifically
    const psa = (priceData.graded || []).find((co: any) => co.company_name === "PSA");
    if (psa) {
      for (const grade of psa.grades || []) {
        const gv = String(grade.grade_value);
        const key = gv === "10" ? "psa10" : gv === "9" ? "psa9" : gv === "8" ? "psa8" : null;
        if (key && grade.count > 0) {
          const gradePrices = grade.records.map((r: any) => r.price);
          prices[key] = +(gradePrices.reduce((s: number, p: number) => s + p, 0) / gradePrices.length).toFixed(2);
          console.log(`[PSA ${gv}] Avg: $${prices[key]} from ${gradePrices.length} sales (sample: $${gradePrices.slice(0, 3).join(", $")})`);
        }
      }
    }

    // Estimate raw from graded if missing
    if (!prices.raw && prices.psa9) prices.raw = +(prices.psa9 * 0.6).toFixed(2);
    else if (!prices.raw && prices.psa10) prices.raw = +(prices.psa10 * 0.35).toFixed(2);

    console.log("Final prices:", JSON.stringify(prices));

    return NextResponse.json({
      success: true,
      prices,
      card_info: {
        name: match.name,
        set: match.setName,
        release: match.releaseName,
        year: match.year,
      },
    });
  } catch (error: any) {
    console.log("PRICE ERROR:", error.message);
    return NextResponse.json({ error: "Price lookup failed: " + error.message }, { status: 500 });
  }
}
