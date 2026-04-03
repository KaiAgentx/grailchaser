import { NextRequest, NextResponse } from "next/server";

// ─── OAuth token cache ───
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getEbayToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) throw new Error("EBAY_APP_ID and EBAY_CERT_ID required");

  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");
  console.log(">>> Fetching eBay OAuth token...");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });

  const data = await res.json();
  console.log("    Token status:", res.status);

  if (!res.ok || !data.access_token) {
    console.log("    Token error:", JSON.stringify(data).substring(0, 300));
    throw new Error("eBay OAuth failed: " + (data.error_description || data.error || res.status));
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 60s early
  console.log("    Token acquired, expires in", data.expires_in, "seconds");
  return cachedToken!;
}

// ─── Grade classification ───
function classifySale(title: string): "psa10" | "psa9" | "psa8" | "raw" {
  const t = title.toUpperCase();
  if (/PSA\s*10|GEM.?MINT\s*10|BGS\s*10|SGC\s*10|CGC\s*10/.test(t)) return "psa10";
  if (/PSA\s*9\.?5?|BGS\s*9\.?5?|SGC\s*9\.?5?/.test(t)) return "psa9";
  if (/PSA\s*[5-8]|BGS\s*[5-8]|SGC\s*[5-8]|CGC\s*[5-8]/.test(t)) return "psa8";
  if (/\b(PSA|BGS|SGC|CGC)\b/.test(t)) return "psa8";
  return "raw";
}

export async function POST(request: NextRequest) {
  try {
    const { player, year, set, search_query } = await request.json();

    // Build search keywords
    let keywords = search_query || "";
    if (!keywords && player) {
      keywords = [year, set, player].filter(Boolean).join(" ");
    }
    if (!keywords) {
      return NextResponse.json({ error: "No search terms provided" }, { status: 400 });
    }

    console.log("\n" + "=".repeat(60));
    console.log("EBAY BROWSE API — item_summary/search");
    console.log("=".repeat(60));
    console.log("Keywords:", keywords);

    // Get OAuth token
    let token: string;
    try {
      token = await getEbayToken();
    } catch (e: any) {
      console.log("Token error:", e.message);
      return NextResponse.json({ error: e.message, price_source: "none" });
    }

    // Search eBay Browse API
    const params = new URLSearchParams({
      q: keywords,
      category_ids: "261328",
      filter: "conditionIds:{1000|1500|2000|2500|3000}",
      sort: "newlyListed",
      limit: "20",
    });

    const browseUrl = "https://api.ebay.com/buy/browse/v1/item_summary/search?" + params.toString();
    console.log("URL:", browseUrl);

    const res = await fetch(browseUrl, {
      headers: {
        "Authorization": "Bearer " + token,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    console.log("eBay status:", res.status);
    console.log("eBay response:", JSON.stringify(data).substring(0, 1000));

    if (!res.ok) {
      const errMsg = data.errors?.[0]?.message || data.error_description || "eBay API error";
      console.log("eBay error:", errMsg);
      return NextResponse.json({ error: errMsg, price_source: "none" });
    }

    const items = data.itemSummaries || [];
    const totalResults = data.total || 0;
    console.log("Total results:", totalResults, "| Items returned:", items.length);

    // Parse and classify each listing
    const sales: { grade: string; price: number; title: string; url: string }[] = [];

    for (const item of items) {
      const title = item.title || "";
      const price = parseFloat(item.price?.value || "0");
      const url = item.itemWebUrl || "";
      const grade = classifySale(title);

      if (price > 0) {
        sales.push({ grade, price, title, url });
        console.log(`  [${grade}] $${price.toFixed(2)} — ${title.substring(0, 80)}`);
      }
    }

    // Group by grade and average
    const prices: any = { raw: null, psa10: null, psa9: null, psa8: null };
    const comps: any = { raw: [], psa10: [], psa9: [], psa8: [] };

    for (const sale of sales) {
      comps[sale.grade].push({ price: sale.price, title: sale.title, url: sale.url });
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
