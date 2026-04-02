import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.cardsight.ai";

async function probeEndpoint(url: string, apiKey: string, label: string) {
  console.log(`\n>>> ${label}`);
  console.log(`    URL: ${url}`);
  try {
    const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    const bodyText = await res.text();
    let body: any;
    try { body = JSON.parse(bodyText); } catch { body = bodyText; }
    console.log(`    Status: ${res.status}`);
    console.log(`    Headers:`, JSON.stringify(headers));
    console.log(`    Body:`, typeof body === "string" ? body.substring(0, 500) : JSON.stringify(body).substring(0, 1500));
    return { status: res.status, headers, body };
  } catch (e: any) {
    console.log(`    FETCH ERROR: ${e.message}`);
    return { status: 0, headers: {}, body: null, error: e.message };
  }
}

function extractPrices(priceData: any) {
  const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };

  if (priceData.raw && priceData.raw.count > 0) {
    const rawPrices = priceData.raw.records.map((r: any) => r.price);
    prices.raw = +(rawPrices.reduce((s: number, p: number) => s + p, 0) / rawPrices.length).toFixed(2);
    console.log(`  [Raw] $${prices.raw} avg from ${rawPrices.length} sales`);
  }

  for (const co of priceData.graded || []) {
    for (const grade of co.grades || []) {
      if (grade.count === 0) continue;
      const gv = String(grade.grade_value);
      const key = gv === "10" ? "psa10" : gv === "9" || gv === "9.5" ? "psa9" : gv === "8" || gv === "8.5" || gv === "7" || gv === "6" || gv === "5" ? "psa8" : null;
      if (!key) continue;
      if (prices[key] && key === "psa8") continue;
      const gradePrices = grade.records.map((r: any) => r.price);
      const avg = +(gradePrices.reduce((s: number, p: number) => s + p, 0) / gradePrices.length).toFixed(2);
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
    const { player, year, set, card_number, sport, card_id: inputCardId } = await request.json();
    const apiKey = process.env.CARDSIGHT_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No CARDSIGHT_API_KEY in environment" }, { status: 400 });
    }

    if (!player && !inputCardId) {
      return NextResponse.json({ error: "Player name or card_id required" }, { status: 400 });
    }

    console.log("\n" + "=".repeat(60));
    console.log("CARDSIGHT FULL ENDPOINT PROBE");
    console.log("=".repeat(60));
    console.log("Input:", JSON.stringify({ player, year, set, card_number, card_id: inputCardId }));

    // Step 1: Find card ID — either from input or search
    let cardId = inputCardId;
    let selectedMatch: any = null;
    const debugEndpoints: any[] = [];

    if (!cardId) {
      // Search for the card
      const query = [player, set].filter(Boolean).join(" ");
      const searchParams = new URLSearchParams({ q: query });
      if (year) searchParams.set("year", String(year));

      const searchResult = await probeEndpoint(
        `${BASE}/v1/catalog/search?${searchParams.toString()}`,
        apiKey,
        "SEARCH"
      );
      debugEndpoints.push({ endpoint: "catalog/search", ...searchResult });

      const cards = searchResult.body?.results || [];
      if (cards.length > 0) {
        const normalize = (s: string) => s.replace(/[.,]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
        const playerNorm = normalize(player || "");
        const match = cards.find((c: any) => normalize(c.name || "") === playerNorm) || cards[0];
        cardId = match.id;
        selectedMatch = match;
        console.log(`\n    Selected: ${match.name} | ${match.setName} | ${match.releaseName} ${match.year} | ID: ${cardId}`);
      }
    }

    if (!cardId) {
      return NextResponse.json({ error: "Card not found", debug: debugEndpoints });
    }

    // Step 2: Probe EVERY possible pricing/detail endpoint
    const catalogResult = await probeEndpoint(
      `${BASE}/v1/catalog/cards/${cardId}`,
      apiKey,
      "CATALOG CARD DETAIL"
    );
    debugEndpoints.push({ endpoint: `catalog/cards/${cardId}`, ...catalogResult });

    const pricingResult = await probeEndpoint(
      `${BASE}/v1/pricing/${cardId}?period=90d`,
      apiKey,
      "PRICING (90d)"
    );
    debugEndpoints.push({ endpoint: `pricing/${cardId}?period=90d`, ...pricingResult });

    const pricingAllResult = await probeEndpoint(
      `${BASE}/v1/pricing/${cardId}?period=all`,
      apiKey,
      "PRICING (all time)"
    );
    debugEndpoints.push({ endpoint: `pricing/${cardId}?period=all`, ...pricingAllResult });

    // Probe endpoints the user wants to test
    for (const path of [
      `v1/market/prices/${cardId}`,
      `v1/market/${cardId}`,
      `v1/market/prices?card_id=${cardId}`,
      `v1/cards/${cardId}/prices`,
      `v1/cards/${cardId}`,
      `v1/catalog/cards/${cardId}/prices`,
      `v1/catalog/cards/${cardId}/pricing`,
      `v1/catalog/cards/${cardId}/market`,
      `v1/sales/${cardId}`,
      `v1/comps/${cardId}`,
      `v1/valuations/${cardId}`,
      `v1/estimates/${cardId}`,
      `v1/price-guide/${cardId}`,
      `v1/analytics/${cardId}`,
    ]) {
      const result = await probeEndpoint(`${BASE}/${path}`, apiKey, path.toUpperCase());
      debugEndpoints.push({ endpoint: path, ...result });
    }

    // Step 3: Extract prices from whichever pricing endpoint worked
    let prices: any = { raw: null, psa10: null, psa9: null, psa8: null };
    const pricingBody = pricingResult.body || pricingAllResult.body;

    if (pricingBody && pricingBody.meta?.total_records > 0) {
      prices = extractPrices(pricingBody);
    }

    // If no pricing found, try broader search (player name only)
    if (!hasPricing(prices) && set && player) {
      console.log("\n--- Broad search fallback (player only) ---");
      const broadParams = new URLSearchParams({ q: player });
      if (year) broadParams.set("year", String(year));
      const broadResult = await probeEndpoint(
        `${BASE}/v1/catalog/search?${broadParams.toString()}`,
        apiKey,
        "BROAD SEARCH"
      );

      const normalize = (s: string) => s.replace(/[.,]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      const playerNorm = normalize(player);
      const broadCards = (broadResult.body?.results || []).filter((c: any) => {
        const n = normalize(c.name || "");
        return n === playerNorm || n.startsWith(playerNorm);
      }).slice(0, 5);

      for (const match of broadCards) {
        console.log(`  Trying: ${match.name} | ${match.releaseName} ${match.year}`);
        const pr = await probeEndpoint(
          `${BASE}/v1/pricing/${match.id}?period=90d`,
          apiKey,
          `PRICING ${match.releaseName}`
        );
        if (pr.body?.meta?.total_records > 0) {
          prices = extractPrices(pr.body);
          selectedMatch = match;
          if (hasPricing(prices)) break;
        }
      }
    }

    // Estimate raw from graded if missing
    if (!prices.raw && prices.psa9) prices.raw = +(prices.psa9 * 0.6).toFixed(2);
    else if (!prices.raw && prices.psa10) prices.raw = +(prices.psa10 * 0.35).toFixed(2);
    else if (!prices.raw && prices.psa8) prices.raw = +(prices.psa8 * 0.8).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log("FINAL PRICES:", JSON.stringify(prices));
    console.log("=".repeat(60));

    // Build summary of what worked vs didn't
    const endpointSummary = debugEndpoints.map((e: any) => ({
      endpoint: e.endpoint,
      status: e.status,
      hasData: e.status === 200 && e.body && !e.body?.error,
    }));

    return NextResponse.json({
      success: true,
      prices,
      card_info: selectedMatch ? {
        name: selectedMatch.name,
        set: selectedMatch.setName,
        release: selectedMatch.releaseName,
        year: selectedMatch.year,
        id: cardId,
      } : { id: cardId },
      debug: {
        endpoints_probed: endpointSummary,
        card_id_used: cardId,
      },
    });
  } catch (error: any) {
    console.log("PRICE ERROR:", error.message);
    return NextResponse.json({ error: "Price lookup failed: " + error.message }, { status: 500 });
  }
}
