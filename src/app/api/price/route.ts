import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { player, year, set, card_number, sport } = await request.json();
    const zylaKey = process.env.ZYLA_API_KEY;
    
    if (!zylaKey) {
      return NextResponse.json({ error: "No pricing API configured" }, { status: 400 });
    }

    // Try just player name for cleaner search
    const query = player || [year, set, card_number].filter(Boolean).join(" ");
    console.log("=== ZYLA PRICE SEARCH ===");
    console.log("Query:", query);

    const searchRes = await fetch("https://zylalabs.com/api/2511/sports+card+and+trading+card+api/2494/card+search?search=" + encodeURIComponent(query), {
      headers: { "Authorization": "Bearer " + zylaKey },
    });
    const searchData = await searchRes.json();
    console.log("Search status:", searchRes.status);
    console.log("FULL RESPONSE:", JSON.stringify(searchData).substring(0, 1000));

    if (!searchData || (Array.isArray(searchData) && searchData.length === 0)) {
      return NextResponse.json({ error: "Card not found", query });
    }

    // Find matching card from search results
    const cards = Array.isArray(searchData) ? searchData : searchData.results || searchData.data || [searchData];
    
    // Try to find exact match by year and name
    let match = cards[0];
    if (year && cards.length > 1) {
      const yearMatch = cards.find((c: any) => String(c.year) === String(year) || (c.name && c.name.includes(String(year))));
      if (yearMatch) match = yearMatch;
    }

    console.log("Selected card:", JSON.stringify(match).substring(0, 300));

    const cardId = match.card_id || match.id || match._id;
    if (!cardId) {
      return NextResponse.json({ success: true, prices: { raw: null, psa10: null, psa9: null, psa8: null }, card_info: match, message: "No card ID for price lookup" });
    }

    // Get prices for each grade
    const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };
    
    for (const [grade, key] of [["PSA 10", "psa10"], ["PSA 9", "psa9"], ["PSA 8", "psa8"], ["Ungraded", "raw"]]) {
      try {
        const priceRes = await fetch("https://zylalabs.com/api/2511/sports+card+and+trading+card+api/2496/get+card+prices?card_id=" + encodeURIComponent(cardId) + "&days=90&grade=" + encodeURIComponent(grade), {
          headers: { "Authorization": "Bearer " + zylaKey },
        });
        const priceData = await priceRes.json();
        if (Array.isArray(priceData) && priceData.length > 0) {
          const avg = priceData.reduce((sum: number, p: any) => sum + parseFloat(p.price || "0"), 0) / priceData.length;
          prices[key] = +(avg / 100).toFixed(2);
        }
      } catch (e) {}
    }

    // Estimate raw from graded if missing
    if (!prices.raw && prices.psa10) prices.raw = +(prices.psa10 * 0.2).toFixed(2);
    if (!prices.raw && prices.psa9) prices.raw = +(prices.psa9 * 0.5).toFixed(2);

    console.log("Final prices:", JSON.stringify(prices));

    return NextResponse.json({ success: true, prices });
  } catch (error: any) {
    console.log("PRICE ERROR:", error.message);
    return NextResponse.json({ error: "Price lookup failed: " + error.message }, { status: 500 });
  }
}
