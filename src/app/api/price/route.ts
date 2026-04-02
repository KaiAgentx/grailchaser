import { NextRequest, NextResponse } from "next/server";

function classifySale(title: string): "psa10" | "psa9" | "psa8" | "raw" {
  const t = title.toUpperCase();
  // Check for graded cards
  if (/PSA\s*10|GEM.?MINT\s*10|BGS\s*10|SGC\s*10|CGC\s*10/.test(t)) return "psa10";
  if (/PSA\s*9\.?5?|BGS\s*9\.?5?|SGC\s*9\.?5?|MINT\s*9/.test(t)) return "psa9";
  if (/PSA\s*[5-8]|BGS\s*[5-8]|SGC\s*[5-8]|CGC\s*[5-8]/.test(t)) return "psa8";
  // If it mentions PSA/BGS/SGC/CGC but no specific grade, treat as graded
  if (/\b(PSA|BGS|SGC|CGC)\b/.test(t)) return "psa8";
  return "raw";
}

export async function POST(request: NextRequest) {
  try {
    const { player, year, set, search_query, card_id } = await request.json();
    const appId = process.env.EBAY_APP_ID;

    if (!appId) {
      return NextResponse.json({ error: "No EBAY_APP_ID configured" }, { status: 400 });
    }

    // Build search keywords
    let keywords = search_query || "";
    if (!keywords && player) {
      keywords = [year, set, player].filter(Boolean).join(" ");
    }
    if (!keywords) {
      return NextResponse.json({ error: "No search terms provided" }, { status: 400 });
    }

    console.log("\n" + "=".repeat(60));
    console.log("EBAY FINDING API — findCompletedItems");
    console.log("=".repeat(60));
    console.log("Keywords:", keywords);

    const ebayUrl = "https://svcs.ebay.com/services/search/FindingService/v1"
      + "?OPERATION-NAME=findCompletedItems"
      + "&SERVICE-VERSION=1.0.0"
      + "&SECURITY-APPNAME=" + encodeURIComponent(appId)
      + "&RESPONSE-DATA-FORMAT=JSON"
      + "&REST-PAYLOAD"
      + "&keywords=" + encodeURIComponent(keywords)
      + "&categoryId=261328"
      + "&itemFilter(0).name=SoldItemsOnly"
      + "&itemFilter(0).value=true"
      + "&sortOrder=EndTimeSoonest"
      + "&paginationInput.entriesPerPage=20";

    console.log("URL:", ebayUrl);

    const res = await fetch(ebayUrl);
    const data = await res.json();
    console.log("eBay status:", res.status);
    console.log("eBay response keys:", Object.keys(data));
    console.log("eBay response:", JSON.stringify(data).substring(0, 1000));

    // Handle top-level error (rate limit, auth failure)
    if (data.errorMessage) {
      const errMsg = data.errorMessage?.[0]?.error?.[0]?.message?.[0] || "eBay API error";
      console.log("eBay error:", errMsg);
      return NextResponse.json({ error: errMsg, price_source: "none" });
    }

    const searchResult = data?.findCompletedItemsResponse?.[0];
    const ack = searchResult?.ack?.[0];
    const errorMsg = searchResult?.errorMessage?.[0]?.error?.[0]?.message?.[0];

    if (ack !== "Success") {
      console.log("eBay search error:", errorMsg || ack);
      return NextResponse.json({ error: "eBay search failed: " + (errorMsg || ack || "unknown"), price_source: "none" });
    }

    const items = searchResult?.searchResult?.[0]?.item || [];
    const totalResults = parseInt(searchResult?.paginationOutput?.[0]?.totalEntries?.[0] || "0");
    console.log("Total results:", totalResults, "| Items returned:", items.length);

    // Parse and classify each sale
    const sales: { grade: string; price: number; title: string; date: string; url: string }[] = [];

    for (const item of items) {
      const title = item.title?.[0] || "";
      const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || "0");
      const date = item.listingInfo?.[0]?.endTime?.[0] || "";
      const url = item.viewItemURL?.[0] || "";
      const grade = classifySale(title);

      if (price > 0) {
        sales.push({ grade, price, title, date, url });
        console.log(`  [${grade}] $${price.toFixed(2)} — ${title.substring(0, 80)}`);
      }
    }

    // Group by grade and average
    const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };
    const comps: any = { raw: [], psa10: [], psa9: [], psa8: [] };

    for (const sale of sales) {
      comps[sale.grade].push({ price: sale.price, title: sale.title, date: sale.date, url: sale.url });
    }

    for (const [grade, gradeSales] of Object.entries(comps) as [string, any[]][]) {
      if (gradeSales.length > 0) {
        const avg = gradeSales.reduce((s: number, c: any) => s + c.price, 0) / gradeSales.length;
        prices[grade] = +avg.toFixed(2);
        console.log(`  ${grade}: $${prices[grade]} avg from ${gradeSales.length} sales`);
      }
    }

    // Estimate raw from graded if missing
    if (!prices.raw && prices.psa9) prices.raw = +(prices.psa9 * 0.6).toFixed(2);
    else if (!prices.raw && prices.psa10) prices.raw = +(prices.psa10 * 0.35).toFixed(2);
    else if (!prices.raw && prices.psa8) prices.raw = +(prices.psa8 * 0.8).toFixed(2);

    console.log("\nFINAL PRICES:", JSON.stringify(prices));
    console.log("=".repeat(60));

    return NextResponse.json({
      success: true,
      prices,
      price_source: sales.length > 0 ? "ebay" : "none",
      total_sales: sales.length,
      comps,
      keywords,
    });
  } catch (error: any) {
    console.log("PRICE ERROR:", error.message);
    return NextResponse.json({ error: "Price lookup failed: " + error.message }, { status: 500 });
  }
}
