import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;
    
    const apiKey = process.env.CARDSIGHT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No CardSight API key configured" }, { status: 400 });
    }

    // Send image to CardSight AI for identification
    const csFormData = new FormData();
    csFormData.append("image", image);

    const res = await fetch("https://api.cardsight.ai/v1/identify", {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: csFormData,
    });

    const data = await res.json();

    if (data.success && data.detections && data.detections.length > 0) {
      const card = data.detections[0].card;
      return NextResponse.json({
        success: true,
        player: card.player || card.name || "Unknown",
        year: card.year || card.releaseYear || 0,
        brand: card.manufacturer || card.brand || "",
        set: card.releaseName || card.setName || "",
        parallel: card.parallel || card.variation || "Base",
        card_number: card.cardNumber || card.number || "",
        sport: card.sport || "Baseball",
        confidence: data.detections[0].confidence || 0,
        pricing: card.pricing || null,
        raw_data: card,
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: "Could not identify card",
      raw_data: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Scan failed: " + error.message }, { status: 500 });
  }
}
