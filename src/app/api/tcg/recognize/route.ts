import { NextRequest, NextResponse } from "next/server";
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
import type { ConfidenceBand } from "@/lib/recognition";

// ─── Supabase client (anon key — catalog tables have no RLS) ───

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ─── Response type ───

export interface RecognizeResponse {
  ok: boolean;
  latencyMs: number;
  timing: { preprocessMs: number; hashMs: number; cacheMs: number; matchMs: number };
  cache: { game: string; catalogVersion: string; totalEntries: number; loadedAt: number };
  query: { phash: string; dhash: string; whash: string };
  result: {
    confidenceBand: ConfidenceBand;
    topDistance: number;
    candidates: Array<{
      rank: number;
      catalogCardId: string;
      name: string;
      setName: string;
      setCode: string;
      cardNumber: string | null;
      rarity: string | null;
      imageSmallUrl: string | null;
      imageLargeUrl: string | null;
      weightedDistance: number;
      distanceBreakdown: { phash: number; dhash: number; whash: number };
    }>;
  };
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    // a. Parse JSON
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // b. Validate game
    const { game, imageBase64 } = body;
    if (game === "mtg" || game === "one_piece") {
      return NextResponse.json({ error: "Game not yet supported" }, { status: 501 });
    }
    if (game !== "pokemon") {
      return NextResponse.json({ error: "Invalid game" }, { status: 400 });
    }

    // c. Validate imageBase64
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }

    // d. Strip data URL prefix if present
    const rawB64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");

    // e. Decode base64
    let buffer: Buffer;
    try {
      buffer = Buffer.from(rawB64, "base64");
    } catch {
      return NextResponse.json({ error: "Invalid base64" }, { status: 400 });
    }

    // f. Size check
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 413 });
    }

    const t0 = performance.now();

    // g-h. Preprocess
    let data: Uint8Array, width: number, height: number;
    try {
      const result = await preprocessImage(buffer);
      data = result.data;
      width = result.width;
      height = result.height;
    } catch {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }
    const preprocessMs = Math.round(performance.now() - t0);

    // i. Compute hashes
    const t1 = performance.now();
    let queryPhash: bigint, queryDhash: bigint, queryWhash: bigint;
    try {
      queryPhash = phash(data, width, height);
      queryDhash = dhash(data, width, height);
      queryWhash = whash(data, width, height);
    } catch (err) {
      console.error("[recognize] Hash computation error:", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    const hashMs = Math.round(performance.now() - t1);

    // j. Get cache
    const t2 = performance.now();
    let cache;
    try {
      cache = await getOrLoadCache(game, supabase);
    } catch (err) {
      if (err instanceof CacheLoadError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      throw err;
    }
    const cacheMs = Math.round(performance.now() - t2);

    // k. Score all entries
    const t3 = performance.now();
    const scored = cache.entries.map((entry) => {
      const phashDist = hamming64(queryPhash, entry.phash);
      const dhashDist = hamming64(queryDhash, entry.dhash);
      const whashDist = hamming64(queryWhash, entry.whash);
      const distance =
        phashDist * HASH_WEIGHTS.phash +
        dhashDist * HASH_WEIGHTS.dhash +
        whashDist * HASH_WEIGHTS.whash;
      return { entry, distance, phashDist, dhashDist, whashDist };
    });

    // l. Sort and slice top 5
    scored.sort((a, b) => a.distance - b.distance);
    const top = scored.slice(0, 5);
    const matchMs = Math.round(performance.now() - t3);

    const totalMs = Math.round(performance.now() - t0);

    // n. Log summary
    const band = top.length > 0 ? bandFromDistance(top[0].distance) : "unclear";
    console.log(
      `[recognize] game=${game} band=${band} topDist=${top[0]?.distance?.toFixed(1) ?? "N/A"} candidates=${top.length} latencyMs=${totalMs}`
    );

    // m. Build response
    const response: RecognizeResponse = {
      ok: true,
      latencyMs: totalMs,
      timing: { preprocessMs, hashMs, cacheMs, matchMs },
      cache: {
        game,
        catalogVersion: cache.catalogVersion,
        totalEntries: cache.entries.length,
        loadedAt: cache.loadedAt,
      },
      query: {
        phash: queryPhash.toString(16).padStart(16, "0"),
        dhash: queryDhash.toString(16).padStart(16, "0"),
        whash: queryWhash.toString(16).padStart(16, "0"),
      },
      result: {
        confidenceBand: band,
        topDistance: top[0]?.distance ?? 64,
        candidates: top.map((r, i) => ({
          rank: i + 1,
          catalogCardId: r.entry.catalogCardId,
          name: r.entry.name,
          setName: r.entry.setName,
          setCode: r.entry.setCode,
          cardNumber: r.entry.cardNumber,
          rarity: r.entry.rarity,
          imageSmallUrl: r.entry.imageSmallUrl,
          imageLargeUrl: r.entry.imageLargeUrl,
          weightedDistance: r.distance,
          distanceBreakdown: {
            phash: r.phashDist,
            dhash: r.dhashDist,
            whash: r.whashDist,
          },
        })),
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[recognize] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
