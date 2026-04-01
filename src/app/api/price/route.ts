import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { player, year, set, card_number, sport } = await request.json();
    const zylaKey = process.env.ZYLA_API_KEY;
    
    if (!zylaKey) {
      return NextResponse.json({ error: "No pricing API configured" }, { status: 400 });
    }

    const query = [year, set, player, card_number].filter(Boolean).join(" ");
    console.log("=== ZYLA PRICE SEARCH ===");
    console.log("Query:", query);

    const searchRes = await fetch("https://zylalabs.com/api/2511/sports+card+and+trading+card+api/2495/card+search?search=" + encodeURIComponent(query), {
      headers: { "Authorization": "Bearer " + zylaKey },
    });
    const searchData = await searchRes.json();
    console.log("Search status:", searchRes.status);

    if (!searchData || (Array.isArray(searchData) && searchData.length === 0)) {
      return NextResponse.json({ error: "Card not found", query });
    }

    // Zyla returns price records directly from search
    const records = Array.isArray(searchData) ? searchData : [searchData];
    
    // Group by grade and get average price
    const gradeGroups: Record<string, number[]> = {};
    for (const r of records) {
      const grade = r.Grade || r.grade || "Ungraded";
      const price = parseFloat(r.price || "0") / 100; // Zyla prices are in pennies
      if (price > 0) {
        if (!gradeGroups[grade]) gradeGroups[grade] = [];
        gradeGroups[grade].push(price);
      }
    }

    const avg = (arr: number[]) => arr.length > 0 ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : null;

    const prices = {
      raw: avg(gradeGroups["Ungraded"] || gradeGroups["Raw"] || []),
      psa10: avg(gradeGroups["PSA 10"] || gradeGroups["GEM MINT 10"] || []),
      psa9: avg(gradeGroups["PSA 9"] || gradeGroups["MINT 9"] || []),
      psa8: avg(gradeGroups["PSA 8"] || gradeGroups["NM-MT 8"] || []),
    };

    console.log("Parsed prices:", JSON.stringify(prices));

    return NextResponse.json({ success: true, prices, records_found: records.length });
  } catch (error: any) {
    console.log("PRICE ERROR:", error.message);
    return NextResponse.json({ error: "Price lookup failed: " + error.message }, { status: 500 });
  }
}
