import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const base64Image = body.image;
    
    const apiKey = process.env.CARDSIGHT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No CARDSIGHT_API_KEY in environment" }, { status: 400 });
    }

    // Convert base64 back to binary for multipart upload
    const imageBuffer = Buffer.from(base64Image, "base64");
    const blob = new Blob([imageBuffer], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("image", blob, "card.jpg");

    console.log("=== CALLING CARDSIGHT ===");
    console.log("Image size:", imageBuffer.length, "bytes");

    const res = await fetch("https://api.cardsight.ai/v1/identify/card", {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: formData,
    });

    const data = await res.json();
    console.log("CardSight status:", res.status);
    console.log("CardSight response:", JSON.stringify(data).substring(0, 500));

    if (data.success && data.detections && data.detections.length > 0) {
      const detection = data.detections[0];
      const card = detection.card || detection;
      return NextResponse.json({
        success: true,
        player: card.player || card.name || "Unknown",
        year: card.year || card.releaseYear || 0,
        brand: card.manufacturer || card.brand || "",
        set: card.releaseName || card.setName || "",
        parallel: card.parallel || card.variation || "Base",
        card_number: card.cardNumber || card.number || "",
        sport: card.sport || "Baseball",
        confidence: detection.confidence || 0,
        pricing: card.pricing || null,
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
