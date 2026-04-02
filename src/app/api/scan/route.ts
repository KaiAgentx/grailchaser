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

    console.log("=== CALLING CARDSIGHT IDENTIFY ===");
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
      console.log("Full card data:", JSON.stringify(card).substring(0, 600));

      const cardId = card.id || card.card_id || card.cardId;

      // Fetch pricing from CardSight pricing endpoint if we got a card ID
      let pricing: any = null;
      if (cardId) {
        try {
          console.log("Fetching pricing for card ID:", cardId);
          const priceRes = await fetch("https://api.cardsight.ai/v1/pricing/" + cardId + "?period=90d", {
            headers: { "X-API-Key": apiKey },
          });
          const priceData = await priceRes.json();
          console.log("Pricing response:", JSON.stringify(priceData).substring(0, 500));

          pricing = { raw: null, psa10: null, psa9: null, psa8: null };

          // Raw prices
          if (priceData.raw && priceData.raw.count > 0) {
            const rawPrices = priceData.raw.records.map((r: any) => r.price);
            pricing.raw = +(rawPrices.reduce((s: number, p: number) => s + p, 0) / rawPrices.length).toFixed(2);
            console.log(`[Raw] Avg: $${pricing.raw} from ${rawPrices.length} sales`);
          }

          // PSA graded prices
          const psa = (priceData.graded || []).find((co: any) => co.company_name === "PSA");
          if (psa) {
            for (const grade of psa.grades || []) {
              const gv = String(grade.grade_value);
              const key = gv === "10" ? "psa10" : gv === "9" ? "psa9" : gv === "8" ? "psa8" : null;
              if (key && grade.count > 0) {
                const gradePrices = grade.records.map((r: any) => r.price);
                pricing[key] = +(gradePrices.reduce((s: number, p: number) => s + p, 0) / gradePrices.length).toFixed(2);
                console.log(`[PSA ${gv}] Avg: $${pricing[key]} from ${gradePrices.length} sales`);
              }
            }
          }

          // Estimate raw from graded if missing
          if (!pricing.raw && pricing.psa9) pricing.raw = +(pricing.psa9 * 0.6).toFixed(2);
          else if (!pricing.raw && pricing.psa10) pricing.raw = +(pricing.psa10 * 0.35).toFixed(2);

          console.log("Final scan pricing:", JSON.stringify(pricing));
        } catch (e: any) {
          console.log("Pricing fetch failed:", e.message);
        }
      }

      return NextResponse.json({
        success: true,
        player: card.player || card.name || "Unknown",
        year: card.year || card.releaseYear || 0,
        brand: card.manufacturer || card.brand || card.manufacturerName || "",
        set: card.releaseName || card.setName || "",
        parallel: card.parallel || card.variation || card.parallelName || "Base",
        card_number: card.cardNumber || card.number || "",
        sport: card.sport || card.category || "Baseball",
        confidence: detection.confidence || 0,
        pricing,
        card_id: cardId,
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
