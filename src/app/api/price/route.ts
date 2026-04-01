import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { player, year, set, parallel, card_number } = await request.json();
    const apiKey = process.env.PRICECHARTING_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ price: 0, source: "mock", message: "No pricing API key" });
    }
    const query = encodeURIComponent([year, set, player, card_number].filter(Boolean).join(" "));
    const res = await fetch("https://www.pricecharting.com/api/product?t=" + apiKey + "&q=" + query);
    const data = await res.json();
    return NextResponse.json({ price: data["loose-price"] || 0, source: "pricecharting", data });
  } catch (error) {
    return NextResponse.json({ error: "Price lookup failed" }, { status: 500 });
  }
}
