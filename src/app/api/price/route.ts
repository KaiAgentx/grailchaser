import { NextRequest, NextResponse } from "next/server";

const BASE = "https://api.cardsight.ai/v1";

async function csFetch(url: string, apiKey: string, label: string, init?: RequestInit) {
  console.log(`\n>>> ${label}`);
  console.log(`    ${init?.method || "GET"} ${url}`);
  if (init?.body) console.log(`    Body: ${String(init.body).substring(0, 300)}`);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "X-API-Key": apiKey, ...(init?.headers || {}) },
    });
    const bodyText = await res.text();
    let body: any;
    try { body = JSON.parse(bodyText); } catch { body = bodyText; }
    console.log(`    Status: ${res.status}`);
    console.log(`    Response: ${JSON.stringify(body).substring(0, 1500)}`);
    return { status: res.status, body, ok: res.status >= 200 && res.status < 300 };
  } catch (e: any) {
    console.log(`    ERROR: ${e.message}`);
    return { status: 0, body: null, ok: false, error: e.message };
  }
}

function extractSoldPrices(priceData: any) {
  const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };

  if (priceData.raw?.count > 0) {
    const rp = priceData.raw.records.map((r: any) => r.price);
    prices.raw = +(rp.reduce((s: number, p: number) => s + p, 0) / rp.length).toFixed(2);
    console.log(`  [Raw] $${prices.raw} avg from ${rp.length} sales`);
  }

  for (const co of priceData.graded || []) {
    for (const grade of co.grades || []) {
      if (grade.count === 0) continue;
      const gv = String(grade.grade_value);
      const key = gv === "10" ? "psa10" : gv === "9" || gv === "9.5" ? "psa9" : gv === "8" || gv === "8.5" || gv === "7" || gv === "6" || gv === "5" ? "psa8" : null;
      if (!key) continue;
      if (prices[key] && key === "psa8") continue;
      const gp = grade.records.map((r: any) => r.price);
      const avg = +(gp.reduce((s: number, p: number) => s + p, 0) / gp.length).toFixed(2);
      if (!prices[key] || co.company_name === "PSA") {
        prices[key] = avg;
        console.log(`  [${co.company_name} ${gv}] $${avg} avg from ${gp.length} sales`);
      }
    }
  }

  return prices;
}

function extractMarketplacePrices(data: any) {
  const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };

  // Marketplace has same structure as pricing: raw.records and graded[].grades[].records
  if (data.raw?.count > 0) {
    const records = data.raw.records.filter((r: any) => r.price);
    if (records.length > 0) {
      prices.raw = +(records.reduce((s: number, r: any) => s + r.price, 0) / records.length).toFixed(2);
      console.log(`  [Marketplace Raw] $${prices.raw} from ${records.length} listings`);
    }
  }

  for (const co of data.graded || []) {
    for (const grade of co.grades || []) {
      if (grade.count === 0) continue;
      const gv = String(grade.grade_value);
      const key = gv === "10" ? "psa10" : gv === "9" || gv === "9.5" ? "psa9" : gv === "8" || gv === "8.5" ? "psa8" : null;
      if (!key) continue;
      const records = (grade.records || []).filter((r: any) => r.price);
      if (records.length > 0 && (!prices[key] || co.company_name === "PSA")) {
        prices[key] = +(records.reduce((s: number, r: any) => s + r.price, 0) / records.length).toFixed(2);
        console.log(`  [Marketplace ${co.company_name} ${gv}] $${prices[key]} from ${records.length} listings`);
      }
    }
  }

  // Also check for direct price fields
  if (data.raw_price || data.raw_value) prices.raw = +(data.raw_price || data.raw_value);
  if (data.psa10 || data.psa_10) prices.psa10 = +(data.psa10 || data.psa_10);
  if (data.psa9 || data.psa_9) prices.psa9 = +(data.psa9 || data.psa_9);
  if (data.psa8 || data.psa_8) prices.psa8 = +(data.psa8 || data.psa_8);

  return prices;
}

function extractAiPrices(data: any) {
  const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };

  // Try to parse structured pricing from AI response
  const answer = data.answer || data.response || data.result || data.text || data.message || "";
  console.log(`  AI answer: ${String(answer).substring(0, 500)}`);

  // Check for structured data fields
  if (data.prices) return { ...prices, ...data.prices };
  if (data.pricing) return { ...prices, ...data.pricing };
  if (data.values) return { ...prices, ...data.values };

  // Try to parse dollar amounts from text — handles "Raw | $243" and "PSA 10: $737" formats
  if (typeof answer === "string") {
    const rawMatch = answer.match(/\*?\*?raw\*?\*?[^$\d]*\$?([\d,]+\.?\d*)/i);
    const psa10Match = answer.match(/\*?\*?psa\s*10\*?\*?[^$\d]*\$?([\d,]+\.?\d*)/i);
    const psa9Match = answer.match(/\*?\*?psa\s*9\*?\*?[^$\d]*\$?([\d,]+\.?\d*)/i);
    const psa8Match = answer.match(/\*?\*?psa\s*8\*?\*?[^$\d]*\$?([\d,]+\.?\d*)/i);
    if (rawMatch) { prices.raw = +rawMatch[1].replace(/,/g, ""); console.log(`  Parsed raw: $${prices.raw}`); }
    if (psa10Match) { prices.psa10 = +psa10Match[1].replace(/,/g, ""); console.log(`  Parsed PSA 10: $${prices.psa10}`); }
    if (psa9Match) { prices.psa9 = +psa9Match[1].replace(/,/g, ""); console.log(`  Parsed PSA 9: $${prices.psa9}`); }
    if (psa8Match) { prices.psa8 = +psa8Match[1].replace(/,/g, ""); console.log(`  Parsed PSA 8: $${prices.psa8}`); }
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
    console.log("CARDSIGHT PRICING FLOW");
    console.log("=".repeat(60));
    console.log("Input:", JSON.stringify({ player, year, set, card_id: inputCardId }));

    const debugLog: any[] = [];

    // ─── RESOLVE CARD ID ───
    let cardId = inputCardId;
    let selectedMatch: any = null;
    const normalize = (s: string) => s.replace(/[.,]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

    if (!cardId && player) {
      const query = [player, set].filter(Boolean).join(" ");
      const searchParams = new URLSearchParams({ q: query });
      if (year) searchParams.set("year", String(year));

      const searchResult = await csFetch(
        `${BASE}/catalog/search?${searchParams.toString()}`,
        apiKey, "1. CATALOG SEARCH"
      );
      debugLog.push({ step: "catalog/search", status: searchResult.status, hasData: searchResult.ok && searchResult.body?.results?.length > 0 });

      const cards = searchResult.body?.results || [];
      if (cards.length > 0) {
        const playerNorm = normalize(player);
        selectedMatch = cards.find((c: any) => normalize(c.name || "") === playerNorm) || cards[0];
        cardId = selectedMatch.id;
        console.log(`    Selected: ${selectedMatch.name} | ${selectedMatch.setName} | ${selectedMatch.releaseName} ${selectedMatch.year} | ID: ${cardId}`);
      }
    }

    if (!cardId) {
      return NextResponse.json({ error: "Card not found", debug: debugLog });
    }

    // ─── GET CARD DETAIL ───
    const catalogResult = await csFetch(
      `${BASE}/catalog/cards/${cardId}`,
      apiKey, "2. CATALOG CARD DETAIL"
    );
    debugLog.push({ step: "catalog/cards", status: catalogResult.status, hasData: catalogResult.ok });

    let prices: any = { raw: null, psa10: null, psa9: null, psa8: null };
    let priceSource = "none";

    // ─── TIER 1: SOLD PRICING ───
    const soldResult = await csFetch(
      `${BASE}/pricing/${cardId}?period=90d`,
      apiKey, "3. PRICING (sold data)"
    );
    debugLog.push({ step: "pricing/sold", status: soldResult.status, records: soldResult.body?.meta?.total_records || 0 });

    if (soldResult.ok && soldResult.body?.meta?.total_records > 0) {
      prices = extractSoldPrices(soldResult.body);
      if (hasPricing(prices)) priceSource = "sold";
    }

    // ─── TIER 2: MARKETPLACE LISTINGS ───
    if (!hasPricing(prices)) {
      const marketResult = await csFetch(
        `${BASE}/marketplace/${cardId}`,
        apiKey, "4. MARKETPLACE (active listings)"
      );
      debugLog.push({ step: "marketplace", status: marketResult.status, hasData: marketResult.ok && !marketResult.body?.error });

      if (marketResult.ok && marketResult.body && !marketResult.body.error) {
        prices = extractMarketplacePrices(marketResult.body);
        if (hasPricing(prices)) priceSource = "marketplace";
      }
    }

    // ─── TIER 3: AI QUERY FALLBACK ───
    if (!hasPricing(prices)) {
      const cardDesc = selectedMatch
        ? `${selectedMatch.year || year || ""} ${selectedMatch.releaseName || set || ""} ${selectedMatch.name || player} #${selectedMatch.number || card_number || ""}`.trim()
        : `${year || ""} ${set || ""} ${player} ${card_number || ""}`.trim();

      const aiResult = await csFetch(
        `${BASE}/ai/query`,
        apiKey, "5. AI QUERY (natural language)",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `What is the current market value of ${cardDesc} in raw, PSA 10, PSA 9, and PSA 8 conditions? Provide dollar amounts.`,
          }),
        }
      );
      debugLog.push({ step: "ai/query", status: aiResult.status, hasData: aiResult.ok && !aiResult.body?.error });

      if (aiResult.ok && aiResult.body && !aiResult.body.error) {
        prices = extractAiPrices(aiResult.body);
        if (hasPricing(prices)) priceSource = "ai";
      }
    }

    // ─── BROAD SEARCH FALLBACK ───
    if (!hasPricing(prices) && set && player) {
      console.log("\n--- Broad search fallback (player name only) ---");
      const broadParams = new URLSearchParams({ q: player });
      if (year) broadParams.set("year", String(year));

      const broadResult = await csFetch(
        `${BASE}/catalog/search?${broadParams.toString()}`,
        apiKey, "6. BROAD SEARCH FALLBACK"
      );

      const playerNorm = normalize(player);
      const broadCards = (broadResult.body?.results || []).filter((c: any) => {
        const n = normalize(c.name || "");
        return n === playerNorm || n.startsWith(playerNorm);
      }).slice(0, 5);

      for (const match of broadCards) {
        const pr = await csFetch(
          `${BASE}/pricing/${match.id}?period=90d`,
          apiKey, `   PRICING ${match.releaseName}`
        );
        if (pr.body?.meta?.total_records > 0) {
          prices = extractSoldPrices(pr.body);
          selectedMatch = match;
          if (hasPricing(prices)) { priceSource = "sold (broad)"; break; }
        }
      }
    }

    // ─── ESTIMATE RAW FROM GRADED ───
    if (!prices.raw && prices.psa9) prices.raw = +(prices.psa9 * 0.6).toFixed(2);
    else if (!prices.raw && prices.psa10) prices.raw = +(prices.psa10 * 0.35).toFixed(2);
    else if (!prices.raw && prices.psa8) prices.raw = +(prices.psa8 * 0.8).toFixed(2);

    console.log("\n" + "=".repeat(60));
    console.log("FINAL PRICES:", JSON.stringify(prices));
    console.log("SOURCE:", priceSource);
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      prices,
      price_source: priceSource,
      card_info: selectedMatch ? {
        name: selectedMatch.name,
        set: selectedMatch.setName,
        release: selectedMatch.releaseName,
        year: selectedMatch.year,
        id: cardId,
      } : { id: cardId },
      debug: debugLog,
    });
  } catch (error: any) {
    console.log("PRICE ERROR:", error.message);
    return NextResponse.json({ error: "Price lookup failed: " + error.message }, { status: 500 });
  }
}
