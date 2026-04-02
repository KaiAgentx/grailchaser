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

    console.log("=== CALLING CARDSIGHT IDENTIFY ===");
    console.log("Image size:", imageBuffer.length, "bytes");

    const res = await fetch("https://api.cardsight.ai/v1/identify/card", {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: formData,
    });

    const data = await res.json();
    console.log("CardSight identify status:", res.status);
    console.log("CardSight identify response:", JSON.stringify(data).substring(0, 1200));

    if (data.success && data.detections && data.detections.length > 0) {
      const detection = data.detections[0];
      const card = detection.card || detection;

      // Log every field in the card object to find the ID
      console.log("=== CARD OBJECT FROM IDENTIFY ===");
      console.log("All keys:", Object.keys(card));
      console.log("Full card:", JSON.stringify(card));
      console.log("card.id:", card.id);
      console.log("card.card_id:", card.card_id);
      console.log("card.cardId:", card.cardId);
      console.log("card.catalogId:", card.catalogId);
      console.log("card.catalog_id:", card.catalog_id);
      console.log("card.referenceId:", card.referenceId);
      console.log("card.reference_id:", card.reference_id);

      const identifyCardId = card.id || card.card_id || card.cardId || card.catalogId || card.catalog_id || card.referenceId || card.reference_id;
      console.log("Resolved identify card_id:", identifyCardId);

      // Also resolve via catalog search to get the canonical catalog card ID
      const player = card.player || card.name || "";
      const year = card.year || card.releaseYear || 0;
      const setName = card.releaseName || card.setName || "";
      let catalogCardId: string | null = null;

      if (player) {
        const searchQuery = [player, setName].filter(Boolean).join(" ");
        const searchParams = new URLSearchParams({ q: searchQuery });
        if (year) searchParams.set("year", String(year));
        console.log("=== CATALOG SEARCH for card_id ===");
        console.log("Search query:", searchQuery, "year:", year);

        try {
          const searchRes = await fetch("https://api.cardsight.ai/v1/catalog/search?" + searchParams.toString(), {
            headers: { "X-API-Key": apiKey },
          });
          const searchData = await searchRes.json();
          const results = searchData.results || [];
          console.log("Catalog search results:", results.length);
          for (const r of results.slice(0, 5)) {
            console.log(`  ${r.id} | ${r.name} | ${r.setName} | ${r.releaseName} ${r.year}`);
          }

          if (results.length > 0) {
            const normalize = (s: string) => s.replace(/[.,]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
            const playerNorm = normalize(player);
            const match = results.find((c: any) => normalize(c.name || "") === playerNorm) || results[0];
            catalogCardId = match.id;
            console.log("Catalog card_id:", catalogCardId, "| name:", match.name, "| release:", match.releaseName);
          }
        } catch (e: any) {
          console.log("Catalog search failed:", e.message);
        }
      }

      // Prefer catalog ID, fall back to identify ID
      const finalCardId = catalogCardId || identifyCardId;
      console.log("=== FINAL CARD ID:", finalCardId, "(from:", catalogCardId ? "catalog" : "identify", ") ===");

      // Fetch pricing via /api/price
      let pricing: any = null;
      try {
        const priceRes = await fetch((process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/api/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player,
            year,
            set: setName,
            card_id: finalCardId,
          }),
        });
        const priceData = await priceRes.json();
        console.log("Price API result:", JSON.stringify(priceData).substring(0, 500));
        if (priceData.prices) pricing = priceData.prices;
      } catch (e: any) {
        console.log("Price lookup failed:", e.message);
      }

      return NextResponse.json({
        success: true,
        player,
        year,
        brand: card.manufacturer || card.brand || card.manufacturerName || "",
        set: setName,
        parallel: card.parallel || card.variation || card.parallelName || "Base",
        card_number: card.cardNumber || card.number || "",
        sport: card.sport || card.category || "Baseball",
        confidence: detection.confidence || 0,
        pricing,
        card_id: finalCardId,
        identify_card_id: identifyCardId,
        catalog_card_id: catalogCardId,
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
