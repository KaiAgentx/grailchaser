import { NextRequest, NextResponse } from "next/server";

function extractPrices(priceData: any) {
  const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };

  // Raw prices
  if (priceData.raw && priceData.raw.count > 0) {
    const rawPrices = priceData.raw.records.map((r: any) => r.price);
    prices.raw = +(rawPrices.reduce((s: number, p: number) => s + p, 0) / rawPrices.length).toFixed(2);
    console.log(`  [Raw] $${prices.raw} avg from ${rawPrices.length} sales`);
  }

  // Graded prices — check all grading companies, prefer PSA
  for (const co of priceData.graded || []) {
    for (const grade of co.grades || []) {
      if (grade.count === 0) continue;
      const gv = String(grade.grade_value);
      const key = gv === "10" ? "psa10" : gv === "9" || gv === "9.5" ? "psa9" : gv === "8" || gv === "8.5" || gv === "7" || gv === "6" || gv === "5" ? "psa8" : null;
      if (!key) continue;
      if (prices[key] && key === "psa8") continue; // keep highest grade match for psa8 bucket
      const gradePrices = grade.records.map((r: any) => r.price);
      const avg = +(gradePrices.reduce((s: number, p: number) => s + p, 0) / gradePrices.length).toFixed(2);
      // PSA overrides other companies; otherwise first company wins
      if (!prices[key] || co.company_name === "PSA") {
        prices[key] = avg;
        console.log(`  [${co.company_name} ${gv}] $${avg} avg from ${gradePrices.length} sales`);
      }
    }
  }

  return prices;
}

function hasPricing(prices: any) {
  return prices.raw || prices.psa10 || prices.psa9 || prices.psa8;
}

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

    // Search — include set/brand if provided for better matching
    const query = [player, set].filter(Boolean).join(" ");
    const searchParams = new URLSearchParams({ q: query });
    if (year) searchParams.set("year", String(year));

    const searchUrl = "https://api.cardsight.ai/v1/catalog/search?" + searchParams.toString();
    console.log("=== CARDSIGHT PRICE SEARCH ===");
    console.log("Query:", query, "| Year:", year || "any");
    console.log("Search URL:", searchUrl);

    const searchRes = await fetch(searchUrl, {
      headers: { "X-API-Key": apiKey },
    });
    const searchData = await searchRes.json();
    const resultNames = (searchData.results || []).slice(0, 5).map((r: any) => `${r.name} (${r.releaseName} ${r.year})`);
    console.log("Search status:", searchRes.status, "| Results:", (searchData.results || []).length);
    console.log("Top results:", resultNames.join(" | "));

    const cards = searchData.results || [];
    if (cards.length === 0) {
      return NextResponse.json({ error: "Card not found", query: player });
    }

    // Try up to 3 search results to find one with pricing data
    let prices: any = { raw: null, psa10: null, psa9: null, psa8: null };
    let selectedMatch = cards[0];
    const candidates = cards.filter((c: any) => c.name === player || c.name === player.replace(/\.$/, "")).slice(0, 3);
    if (candidates.length === 0) candidates.push(...cards.slice(0, 3));

    for (const match of candidates) {
      const pricingUrl = "https://api.cardsight.ai/v1/pricing/" + match.id + "?period=90d";
      console.log("Trying:", match.name, "|", match.setName, "|", match.releaseName, match.year);
      console.log("  Pricing URL:", pricingUrl);
      try {
        const priceRes = await fetch(pricingUrl, {
          headers: { "X-API-Key": apiKey },
        });
        const priceData = await priceRes.json();
        console.log("  Pricing status:", priceRes.status);
        const totalRecords = priceData.meta?.total_records || 0;
        const rawCount = priceData.raw?.count || 0;
        const gradedSummary = (priceData.graded || []).map((co: any) => co.company_name + ": " + (co.grades || []).filter((g: any) => g.count > 0).map((g: any) => g.grade_value + "(" + g.count + ")").join(",")).filter(Boolean).join(" | ");
        console.log("  Total records:", totalRecords, "| Raw:", rawCount, "| Graded:", gradedSummary || "none");

        if (totalRecords > 0) {
          prices = extractPrices(priceData);
          selectedMatch = match;
          if (hasPricing(prices)) break;
        }
      } catch (e) {
        console.log("  Pricing fetch failed");
      }
    }

    // Estimate raw from graded if missing
    if (!prices.raw && prices.psa9) prices.raw = +(prices.psa9 * 0.6).toFixed(2);
    else if (!prices.raw && prices.psa10) prices.raw = +(prices.psa10 * 0.35).toFixed(2);
    else if (!prices.raw && prices.psa8) prices.raw = +(prices.psa8 * 0.8).toFixed(2);

    console.log("Final prices:", JSON.stringify(prices));

    return NextResponse.json({
      success: true,
      prices,
      card_info: {
        name: selectedMatch.name,
        set: selectedMatch.setName,
        release: selectedMatch.releaseName,
        year: selectedMatch.year,
      },
    });
  } catch (error: any) {
    console.log("PRICE ERROR:", error.message);
    return NextResponse.json({ error: "Price lookup failed: " + error.message }, { status: 500 });
  }
}
