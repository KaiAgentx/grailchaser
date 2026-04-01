import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();
    const apiKey = process.env.XIMILAR_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        player: "Unknown Card", sport: "Baseball", year: 2023, brand: "Topps",
        set: "Series 1", parallel: "Base", card_number: "#1", confidence: 0,
        message: "No scanner API key configured — using manual entry mode",
      });
    }
    const res = await fetch("https://api.ximilar.com/recognition/v2/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Token " + apiKey },
      body: JSON.stringify({ records: [{ _url: imageUrl }] }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
