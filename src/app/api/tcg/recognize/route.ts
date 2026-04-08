import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  preprocessImage,
  phash, dhash, whash,
  hamming64,
  HASH_WEIGHTS,
  bandFromDistance,
  getOrLoadCache,
  CacheLoadError,
} from "@/lib/recognition";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function detectMediaType(base64: string): "image/jpeg" | "image/png" | "image/webp" {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { game, imageBase64 } = body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }
    if (game !== "pokemon") {
      return NextResponse.json({ error: game === "mtg" || game === "one_piece" ? "Game not yet supported" : "Invalid game" }, { status: game === "mtg" || game === "one_piece" ? 501 : 400 });
    }

    const rawB64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // ── STEP 1: Claude Vision reads card text ──
    let visionResult: { name: string | null; number: string | null; set: string | null; edition: string; finish: string; confidence: "high" | "medium" | "low" } = { name: null, number: null, set: null, edition: "unlimited", finish: "holo", confidence: "low" };

    if (anthropic) {
      try {
        const mediaType = detectMediaType(rawB64);
        console.log("[vision] calling Claude, key present:", !!process.env.ANTHROPIC_API_KEY, "mediaType:", mediaType);
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: rawB64 } },
              { type: "text", text: `Examine this Pokémon card image carefully.

Extract these fields:
1. name: The Pokémon or card name at the top (e.g. "Charizard", "M Charizard-EX", "Iono")
2. number: The card number at the BOTTOM LEFT corner (e.g. "4/102", "025/185", "SWSH146")
3. set: The set name if visible (e.g. "Base Set", "Scarlet & Violet")
4. edition: Look for an oval "Edition 1" or "1st Edition" stamp near the bottom left of the card artwork. If you see it return "1st", otherwise return "unlimited"
5. finish: Look at the card surface:
   - If the artwork/illustration area has a rainbow sparkle or holographic shine: "holo"
   - If the card border/background (outside the artwork) has a sparkle pattern but the artwork itself is flat: "reverse_holo"
   - If the entire card is flat with no sparkle anywhere: "non_holo"
6. confidence: "high" if text is clearly readable, "medium" if partial, "low" if unclear

Return ONLY valid JSON, no markdown:
{"name":"...","number":"...","set":"...","edition":"1st|unlimited","finish":"holo|reverse_holo|non_holo","confidence":"high|medium|low"}

If not a Pokémon card or completely unreadable:
{"name":null,"number":null,"set":null,"edition":"unlimited","finish":"holo","confidence":"low"}` }
            ]
          }]
        });

        const raw = (msg.content[0] as any).text?.trim() || "";
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed.name !== "undefined") visionResult = parsed;
      } catch (err) {
        console.error("[vision] Claude error:", (err as any)?.message || (err as any)?.status || JSON.stringify(err));
      }
    }

    // ── STEP 2: Catalog lookup ──
    let cards: any[] = [];

    if (visionResult.name && visionResult.confidence !== "low") {
      // Primary: exact name + exact card number
      if (visionResult.number) {
        const { data } = await supabase.from("catalog_cards").select("id, name, set_name, set_code, card_number, rarity").eq("game", game).ilike("name", visionResult.name).eq("card_number", visionResult.number).limit(5);
        cards = data || [];

        // Retry with short number: "4/102" → "4"
        if (!cards.length && visionResult.number.includes("/")) {
          const shortNum = visionResult.number.split("/")[0];
          const { data: d2 } = await supabase.from("catalog_cards").select("id, name, set_name, set_code, card_number, rarity").eq("game", game).ilike("name", visionResult.name).eq("card_number", shortNum).limit(5);
          cards = d2 || [];
        }

        // Retry with zero-padded: "25" → "025"
        if (!cards.length && visionResult.number && !visionResult.number.includes("/")) {
          const padded = visionResult.number.padStart(3, "0");
          if (padded !== visionResult.number) {
            const { data: d3 } = await supabase.from("catalog_cards").select("id, name, set_name, set_code, card_number, rarity").eq("game", game).ilike("name", visionResult.name).eq("card_number", padded).limit(5);
            cards = d3 || [];
          }
        }
      }

      // Fallback: name only
      if (!cards.length) {
        const { data } = await supabase.from("catalog_cards").select("id, name, set_name, set_code, card_number, rarity").eq("game", game).ilike("name", `%${visionResult.name}%`).order("set_name", { ascending: true }).limit(10);
        cards = data || [];
      }
    }

    // ── STEP 3: Fall back to hash if vision got nothing ──
    if (!cards.length) {
      console.log("[recognize] vision got no match, falling back to hash");
      const hashResult = await recognizeByHash(rawB64, game, supabase);
      return NextResponse.json({ ...hashResult, method: "hash", visionResult });
    }

    // ── STEP 4: Build response ──
    const confidenceBand = cards.length === 1 && visionResult.confidence === "high" ? "exact" : cards.length === 1 ? "likely" : visionResult.confidence === "high" ? "choose_version" : "unclear";

    const candidates = cards.map((card: any, i: number) => ({
      rank: i + 1,
      catalogCardId: `${card.set_code}-${card.card_number}`,
      name: card.name,
      setName: card.set_name,
      setCode: card.set_code,
      cardNumber: card.card_number,
      rarity: card.rarity,
      imageSmallUrl: `https://images.pokemontcg.io/${card.set_code}/${card.card_number}.png`,
      imageLargeUrl: `https://images.pokemontcg.io/${card.set_code}/${card.card_number}_hires.png`,
      weightedDistance: i === 0 ? 0 : i * 5,
      distanceBreakdown: { phash: 0, dhash: 0, whash: 0 },
    }));

    console.log(`[recognize] vision: "${visionResult.name}" #${visionResult.number} → ${confidenceBand}, ${candidates.length} candidates`);

    return NextResponse.json({
      ok: true,
      method: "vision",
      visionResult,
      result: { confidenceBand, topDistance: 0, candidates },
    });
  } catch (err: any) {
    console.error("[recognize] unhandled error:", err);
    return NextResponse.json({ error: "Recognition failed: " + err.message }, { status: 500 });
  }
}

// ── HASH FALLBACK ──

async function recognizeByHash(imageBase64: string, game: string, supabase: any): Promise<any> {
  const buffer = Buffer.from(imageBase64, "base64");
  if (buffer.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "Image too large" };

  const t0 = performance.now();
  let data: Uint8Array, width: number, height: number;
  try {
    const r = await preprocessImage(buffer);
    data = r.data; width = r.width; height = r.height;
  } catch { return { ok: false, error: "Invalid image format" }; }
  const preprocessMs = Math.round(performance.now() - t0);

  const t1 = performance.now();
  const queryPhash = phash(data, width, height);
  const queryDhash = dhash(data, width, height);
  const queryWhash = whash(data, width, height);
  const hashMs = Math.round(performance.now() - t1);

  const t2 = performance.now();
  let cache;
  try { cache = await getOrLoadCache(game, supabase); } catch (err) {
    if (err instanceof CacheLoadError) return { ok: false, error: err.message };
    throw err;
  }
  const cacheMs = Math.round(performance.now() - t2);

  const t3 = performance.now();
  const scored = cache.entries.map(entry => {
    const phashDist = hamming64(queryPhash, entry.phash);
    const dhashDist = hamming64(queryDhash, entry.dhash);
    const whashDist = hamming64(queryWhash, entry.whash);
    return { entry, distance: phashDist * HASH_WEIGHTS.phash + dhashDist * HASH_WEIGHTS.dhash + whashDist * HASH_WEIGHTS.whash, phashDist, dhashDist, whashDist };
  });
  scored.sort((a, b) => a.distance - b.distance);
  const top = scored.slice(0, 5);
  const matchMs = Math.round(performance.now() - t3);

  const band = top.length > 0 ? bandFromDistance(top[0].distance) : "unclear";
  return {
    ok: true,
    latencyMs: Math.round(performance.now() - t0),
    timing: { preprocessMs, hashMs, cacheMs, matchMs },
    result: {
      confidenceBand: band,
      topDistance: top[0]?.distance ?? 64,
      candidates: top.map((r, i) => ({
        rank: i + 1, catalogCardId: `${r.entry.setCode}-${r.entry.cardNumber}`, name: r.entry.name,
        setName: r.entry.setName, setCode: r.entry.setCode, cardNumber: r.entry.cardNumber,
        rarity: r.entry.rarity, imageSmallUrl: r.entry.imageSmallUrl, imageLargeUrl: r.entry.imageLargeUrl,
        weightedDistance: r.distance, distanceBreakdown: { phash: r.phashDist, dhash: r.dhashDist, whash: r.whashDist },
      })),
    },
  };
}
