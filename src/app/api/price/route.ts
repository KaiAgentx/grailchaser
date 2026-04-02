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

  const answer = data.answer || data.response || data.result || data.text || data.message || "";
  console.log(`  AI full answer:\n${String(answer)}`);

  // Check for structured data fields
  if (data.prices) return { ...prices, ...data.prices };
  if (data.pricing) return { ...prices, ...data.pricing };
  if (data.values) return { ...prices, ...data.values };

  if (typeof answer !== "string") return prices;

  // Only match dollar signs: "$149.95" or "$1,200"  — never bare numbers
  // Search near the label within a short window (same line / table row) to avoid cross-contamination
  const parseDollar = (label: string): number | null => {
    // Escape for regex
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match label followed by up to 40 non-newline chars then a $ amount
    const re = new RegExp(escaped + "[^\\n]{0,40}\\$(\\d[\\d,]*\\.?\\d*)", "i");
    const m = answer.match(re);
    if (!m) return null;
    const val = +m[1].replace(/,/g, "");
    // Reject years (1980-2030) and nonsense values
    if (val >= 1980 && val <= 2030) { console.log(`  Rejected year-like value $${val} for ${label}`); return null; }
    if (val <= 0) return null;
    return val;
  };

  prices.raw = parseDollar("Raw");
  prices.psa10 = parseDollar("PSA 10") || parseDollar("PSA10");
  prices.psa9 = parseDollar("PSA 9") || parseDollar("PSA9");
  prices.psa8 = parseDollar("PSA 8") || parseDollar("PSA8");

  if (prices.raw) console.log(`  Parsed raw: $${prices.raw}`);
  if (prices.psa10) console.log(`  Parsed PSA 10: $${prices.psa10}`);
  if (prices.psa9) console.log(`  Parsed PSA 9: $${prices.psa9}`);
  if (prices.psa8) console.log(`  Parsed PSA 8: $${prices.psa8}`);

  return prices;
}

function hasPricing(prices: any) {
  return prices.raw || prices.psa10 || prices.psa9 || prices.psa8;
}

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const { player, year, set, card_number, sport, card_id: inputCardId, search_query } = reqBody;
    const apiKey = process.env.CARDSIGHT_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No CARDSIGHT_API_KEY in environment" }, { status: 400 });
    }

    if (!player && !inputCardId && !search_query) {
      return NextResponse.json({ error: "Player name, card_id, or search_query required" }, { status: 400 });
    }

    const isManualSearch = !!search_query;
    console.log("\n" + "=".repeat(60));
    console.log("CARDSIGHT PRICING FLOW —", isManualSearch ? "PATH 2 (manual/corrected)" : "PATH 1 (scan)");
    console.log("=".repeat(60));
    console.log("Input:", JSON.stringify({ player, year, set, card_id: inputCardId, search_query }));

    const debugLog: any[] = [];

    // ─── RESOLVE CARD ID ───
    let cardId = "";
    let selectedMatch: any = null;
    const normalize = (s: string) => s.replace(/[.,]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

    if (isManualSearch) {
      // PATH 2: User typed/corrected card name — search catalog with cleaned text, ignore any stored card_id
      // Strip card numbers (e.g. "#220", "220", "#US175") and common noise words that break search
      const cleanedQuery = search_query
        .replace(/#\S+/g, "")
        .replace(/\b\d{1,3}\b/g, "")
        .replace(/\b(RC|Base|Card)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      console.log("PATH 2: Searching catalog with user text:", search_query, "→ cleaned:", cleanedQuery);
      const searchResult = await csFetch(
        `${BASE}/catalog/search?q=${encodeURIComponent(cleanedQuery)}`,
        apiKey, "1. CATALOG SEARCH (manual text)"
      );
      debugLog.push({ step: "catalog/search (manual)", status: searchResult.status, hasData: searchResult.ok && searchResult.body?.results?.length > 0 });

      const cards = searchResult.body?.results || [];
      console.log(`    Found ${cards.length} results:`);
      for (const c of cards.slice(0, 8)) {
        console.log(`      ${c.id} | ${c.name} | ${c.setName} | ${c.releaseName} ${c.year} | relevance=${c.relevance}`);
      }
      if (cards.length > 0) {
        selectedMatch = cards[0]; // highest relevance
        cardId = selectedMatch.id;
        console.log(`    Best match: ${selectedMatch.name} | ${selectedMatch.setName} | ${selectedMatch.releaseName} ${selectedMatch.year} | ID: ${cardId}`);
      }
    } else if (player) {
      // PATH 1: From scan — search catalog with structured player/set/year
      console.log("PATH 1: Searching catalog with scan data");
      const query = [player, set].filter(Boolean).join(" ");
      const searchParams = new URLSearchParams({ q: query });
      if (year) searchParams.set("year", String(year));

      const searchResult = await csFetch(
        `${BASE}/catalog/search?${searchParams.toString()}`,
        apiKey, "1. CATALOG SEARCH (scan)"
      );
      debugLog.push({ step: "catalog/search (scan)", status: searchResult.status, hasData: searchResult.ok && searchResult.body?.results?.length > 0 });

      const cards = searchResult.body?.results || [];
      if (cards.length > 0) {
        const playerNorm = normalize(player);
        selectedMatch = cards.find((c: any) => normalize(c.name || "") === playerNorm) || cards[0];
        cardId = selectedMatch.id;
        console.log(`    Selected: ${selectedMatch.name} | ${selectedMatch.setName} | ${selectedMatch.releaseName} ${selectedMatch.year} | ID: ${cardId}`);
      }
      // Fall back to input card_id from scan identify
      if (!cardId && inputCardId) {
        console.log("    No catalog results, using scan card_id:", inputCardId);
        cardId = inputCardId;
      }
    } else if (inputCardId) {
      cardId = inputCardId;
      console.log("    Using input card_id directly:", cardId);
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

    console.log("Using card_id for pricing:", cardId);

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
      const cardDesc = search_query
        || (selectedMatch ? `${selectedMatch.year || year || ""} ${selectedMatch.releaseName || set || ""} ${selectedMatch.name || player}`.trim() : `${year || ""} ${set || ""} ${player}`.trim());

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
    if (!hasPricing(prices) && (player || search_query)) {
      const broadQuery = player || search_query.split(/\s+/).slice(-2).join(" "); // last 2 words as player guess
      console.log("\n--- Broad search fallback (player name only):", broadQuery, "---");
      const broadParams = new URLSearchParams({ q: broadQuery });
      if (year) broadParams.set("year", String(year));

      const broadResult = await csFetch(
        `${BASE}/catalog/search?${broadParams.toString()}`,
        apiKey, "6. BROAD SEARCH FALLBACK"
      );

      const playerNorm = player ? normalize(player) : "";
      const broadCards = player
        ? (broadResult.body?.results || []).filter((c: any) => {
            const n = normalize(c.name || "");
            return n === playerNorm || n.startsWith(playerNorm);
          }).slice(0, 5)
        : (broadResult.body?.results || []).slice(0, 5);

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
