import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const base64Image = body.image;

    const apiKey = process.env.CARDSIGHT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No CARDSIGHT_API_KEY in environment" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(base64Image, "base64");
    const blob = new Blob([imageBuffer], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", blob, "card.jpg");

    console.log("=== CARDSIGHT IDENTIFY (card ID only) ===");
    console.log("Image size:", imageBuffer.length, "bytes");

    const res = await fetch("https://api.cardsight.ai/v1/identify/card", {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: formData,
    });

    const data = await res.json();
    console.log("CardSight status:", res.status);
    console.log("CardSight response:", JSON.stringify(data).substring(0, 800));

    if (data.success && data.detections && data.detections.length > 0) {
      const detection = data.detections[0];
      const card = detection.card || detection;

      console.log("Card keys:", Object.keys(card));
      console.log("Card data:", JSON.stringify(card).substring(0, 600));

      const player = card.player || card.name || "Unknown";
      const year = card.year || card.releaseYear || 0;
      const brand = card.manufacturer || card.brand || card.manufacturerName || "";
      const setName = card.releaseName || card.setName || "";
      const parallel = card.parallel || card.variation || card.parallelName || "Base";
      const cardNumber = card.cardNumber || card.number || "";
      const sport = card.sport || card.category || "Baseball";

      // Build eBay search query from identified card
      const ebayQuery = [year, brand, setName !== brand ? setName : "", parallel !== "Base" ? parallel : "", player, cardNumber].filter(Boolean).join(" ");
      console.log("eBay search query:", ebayQuery);

      // Fetch pricing via eBay (through /api/price)
      let pricing: any = null;
      try {
        const priceRes = await fetch((process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/api/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player, year, set: setName }),
        });
        const priceData = await priceRes.json();
        console.log("eBay pricing result:", JSON.stringify(priceData).substring(0, 500));
        if (priceData.prices) pricing = priceData.prices;
      } catch (e: any) {
        console.log("Price lookup failed:", e.message);
      }

      return NextResponse.json({
        success: true,
        player,
        year,
        brand,
        set: setName,
        parallel,
        card_number: cardNumber,
        sport,
        confidence: detection.confidence || 0,
        pricing,
        raw_data: card,
      });
    }

    return NextResponse.json({
      success: false,
      error: "Could not identify card",
      debug: data,
    });
  } catch (error: any) {
    console.log("ERROR:", error.message);
    return NextResponse.json({ error: "Scan failed: " + error.message }, { status: 500 });
  }
}
