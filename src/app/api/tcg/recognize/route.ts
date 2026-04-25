import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  preprocessImage, phash, dhash, whash, hamming64, HASH_WEIGHTS,
  bandFromDistance, getOrLoadCache, CacheLoadError,
} from "@/lib/recognition";
import { extractUserId } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { getOrCreateScanSession, writeScanResult } from "@/lib/scanTelemetry";
import { getVisionPrompt } from "@/lib/vision/prompts";
import type { SupportedGame } from "@/lib/vision/prompts";

const ROUTE = "/api/tcg/recognize";
const ECOSYSTEM = "tcg";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MODEL_NAME = "claude-sonnet-4-6";

const RARITY_MAP: Record<string, string[]> = {
  circle: ["Common"],
  diamond: ["Uncommon"],
  star: ["Rare", "Rare Holo"],
  two_stars: ["Double Rare", "Rare Holo"],
  gold_star: ["Illustration Rare", "Ultra Rare"],
  gold_two_stars: ["Special Illustration Rare"],
  gold_three_stars: ["Hyper Rare"],
};

function detectMediaType(base64: string): "image/jpeg" | "image/png" | "image/webp" {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);
  const startedAt = Date.now();
  let userId: string | null = null;

  const respond = (resp: NextResponse): NextResponse => {
    resp.headers.set("X-Request-ID", requestId);
    logRequest({ requestId, route: ROUTE, method: "POST", userId, ecosystem: ECOSYSTEM, status: resp.status, latencyMs: Date.now() - startedAt, errorCode: resp.headers.get("x-error-code") });
    return resp;
  };

  try {
    userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return respond(errorResponse({ code: ErrorCode.UNAUTHORIZED, requestId }));

    const limit = checkRateLimit(userId, "recognize");
    if (!limit.allowed) return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));

    let body: any;
    try { body = await req.json(); } catch { return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "Invalid JSON", requestId })); }

    const { game, imageBase64, scanIntent, imagePreW, imagePreH, imagePostW, imagePostH } = body;
    if (!imageBase64 || typeof imageBase64 !== "string") return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "imageBase64 required", requestId }));
    const imageTokensEst = (imagePostW && imagePostH) ? Math.round((imagePostW * imagePostH) / 750) : null;

    // Map client scanIntent to session_type for telemetry
    let sessionType: "quick_check" | "collection_save" | "batch_import" = "quick_check";
    if (scanIntent === "collect") sessionType = "collection_save";
    else if (scanIntent !== "check" && scanIntent != null) console.warn(`[${ROUTE}] unexpected scanIntent: ${scanIntent}, defaulting to quick_check`);
    if (game !== "pokemon") {
      return respond(errorResponse({ code: game === "mtg" || game === "one_piece" ? ErrorCode.NOT_FOUND : ErrorCode.INVALID_BODY, details: game === "mtg" || game === "one_piece" ? "Game not yet supported" : "Invalid game", requestId }));
    }

    const rawB64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, "");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // ── Telemetry: session ──
    const sessionIdHeader = req.headers.get("x-scan-session-id");
    const sessionId = await getOrCreateScanSession(userId, game, sessionType, sessionIdHeader);
    let visionValidated = false;
    let visionMs: number | null = null;
    let verifierUsed = false;
    let verifierReranked = false;
    let verifierTopDist: number | null = null;
    let verifierGap: number | null = null;
    let verifierMs: number | null = null;

    // ── STEP 1: Claude Vision ──
    let visionResult: { name: string | null; number: string | null; set: string | null; edition: string; finish: string; confidence: "high" | "medium" | "low"; number_confidence?: "high" | "medium" | "low"; set_total?: number | null; rarity_symbol?: string | null } = { name: null, number: null, set: null, edition: "unlimited", finish: "holo", confidence: "low" };

    if (anthropic) {
      const visionController = new AbortController();
      const visionStart = performance.now();
      const visionTimeout = setTimeout(() => visionController.abort(), 30000);
      try {
        const mediaType = detectMediaType(rawB64);
        const msg = await anthropic.messages.create({
          model: MODEL_NAME, max_tokens: 256,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: rawB64 } },
            { type: "text", text: getVisionPrompt(game as SupportedGame) },
          ] }]
        }, { signal: visionController.signal });
        const raw = (msg.content[0] as any).text?.trim() || "";
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed.name !== "undefined") visionResult = parsed;
      } catch (err) {
        if ((err as any)?.name === "AbortError" || visionController.signal.aborted) {
          console.error("[vision] Claude timed out after 30s");
          return respond(NextResponse.json({ ok: false, error: "recognition_timeout", message: "Vision recognition took too long. Please try again." }, { status: 504 }));
        }
        console.error("[vision] Claude error:", (err as any)?.message || (err as any)?.status || JSON.stringify(err));
      } finally {
        clearTimeout(visionTimeout);
        visionMs = Math.round(performance.now() - visionStart);
      }
    }

    // ── STEP 2: Catalog lookup ──
    const CATALOG_SELECT = "id, name, set_name, set_code, card_number, rarity";
    let cards: any[] = [];
    if (visionResult.name && visionResult.confidence !== "low") {
      // Lift rarity filter — applied to ALL attempts as a preference, never a hard gate
      const rarityValues = visionResult.rarity_symbol ? RARITY_MAP[visionResult.rarity_symbol] : null;
      const hasRarity = rarityValues != null && rarityValues.length > 0;

      // Helper: try query with rarity filter first, fall back to without if no results.
      // Prevents a misread rarity from blocking a good name+number match.
      async function queryWithRarityFallback(baseQuery: any, limit: number): Promise<any[]> {
        if (hasRarity) {
          const { data: filtered } = await baseQuery.in("rarity", rarityValues).limit(limit);
          if (filtered && filtered.length > 0) return filtered;
          // Rebuild query without rarity — Supabase queries are immutable after .in()
          // so we re-run the original without the filter
        }
        const { data } = await baseQuery.limit(limit);
        return data || [];
      }

      // Attempt 0: name + printed_total via catalog_sets join (highest specificity for Pokémon)
      if (visionResult.set_total && visionResult.name) {
        const { data: matchingSets } = await supabase
          .from("catalog_sets")
          .select("id")
          .eq("game", game)
          .eq("printed_total", visionResult.set_total);

        if (matchingSets && matchingSets.length > 0) {
          const setUuids = matchingSets.map(s => s.id);
          let query = supabase.from("catalog_cards").select(CATALOG_SELECT)
            .eq("game", game)
            .ilike("name", visionResult.name)
            .in("set_uuid", setUuids);

          if (visionResult.number) {
            const numBase = visionResult.number.split("/")[0];
            query = query.or(`card_number.eq.${numBase},card_number.eq.${numBase.padStart(3, "0")}`);
          }

          if (hasRarity) {
            const { data: filtered } = await query.in("rarity", rarityValues!).limit(5);
            if (filtered && filtered.length > 0) {
              cards = filtered;
            } else {
              // Re-query without rarity
              let q2 = supabase.from("catalog_cards").select(CATALOG_SELECT)
                .eq("game", game).ilike("name", visionResult.name).in("set_uuid", setUuids);
              if (visionResult.number) {
                const numBase = visionResult.number.split("/")[0];
                q2 = q2.or(`card_number.eq.${numBase},card_number.eq.${numBase.padStart(3, "0")}`);
              }
              const { data } = await q2.limit(5);
              cards = data || [];
            }
          } else {
            const { data } = await query.limit(5);
            cards = data || [];
          }
          if (cards.length > 0) visionValidated = true;
        }
      }

      // Attempt 1: set_name + name + number (uses vision-extracted set name)
      const normalizedSet = visionResult.set && visionResult.set !== "unknown"
        ? visionResult.set.toLowerCase().replace(/pokémon|pokemon|tcg|[^\w\s]/gi, "").trim()
        : null;
      if (!cards.length && normalizedSet && visionResult.number) {
        if (hasRarity) {
          const { data: filtered } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", visionResult.number).ilike("set_name", `%${normalizedSet}%`).in("rarity", rarityValues!).limit(5);
          if (filtered && filtered.length > 0) { cards = filtered; }
          else {
            const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", visionResult.number).ilike("set_name", `%${normalizedSet}%`).limit(5);
            cards = data || [];
          }
        } else {
          const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", visionResult.number).ilike("set_name", `%${normalizedSet}%`).limit(5);
          cards = data || [];
        }
        if (cards.length > 0) visionValidated = true;
      }

      // Attempt 2: name + number (exact)
      if (!cards.length && visionResult.number) {
        if (hasRarity) {
          const { data: filtered } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", visionResult.number).in("rarity", rarityValues!).limit(5);
          if (filtered && filtered.length > 0) { cards = filtered; }
          else {
            const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", visionResult.number).limit(5);
            cards = data || [];
          }
        } else {
          const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", visionResult.number).limit(5);
          cards = data || [];
        }
        if (cards.length > 0) visionValidated = true;
      }

      // Attempt 3: name + number prefix (e.g., "4/102" → "4")
      if (!cards.length && visionResult.number?.includes("/")) {
        const prefix = visionResult.number.split("/")[0];
        if (hasRarity) {
          const { data: filtered } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", prefix).in("rarity", rarityValues!).limit(5);
          if (filtered && filtered.length > 0) { cards = filtered; }
          else {
            const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", prefix).limit(5);
            cards = data || [];
          }
        } else {
          const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", prefix).limit(5);
          cards = data || [];
        }
      }

      // Attempt 4: name + zero-padded number (e.g., "4" → "004")
      if (!cards.length && visionResult.number && !visionResult.number.includes("/")) {
        const padded = visionResult.number.padStart(3, "0");
        if (padded !== visionResult.number) {
          if (hasRarity) {
            const { data: filtered } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", padded).in("rarity", rarityValues!).limit(5);
            if (filtered && filtered.length > 0) { cards = filtered; }
            else {
              const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", padded).limit(5);
              cards = data || [];
            }
          } else {
            const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).eq("card_number", padded).limit(5);
            cards = data || [];
          }
        }
      }

      // Attempt 5: number-tolerant (±2) when number_confidence is low
      // Catches single-digit misreads (1→7, 3→8). Does NOT catch large errors (8→20).
      if (!cards.length && visionResult.number && visionResult.number_confidence === "low") {
        const numBase = parseInt(visionResult.number.split("/")[0], 10);
        if (!isNaN(numBase)) {
          const nearby = [numBase - 2, numBase - 1, numBase + 1, numBase + 2]
            .filter(n => n > 0)
            .map(n => String(n));
          const nearbyPadded = nearby.map(n => n.padStart(3, "0"));
          const allVariants = [...new Set([...nearby, ...nearbyPadded])];
          if (hasRarity) {
            const { data: filtered } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).in("card_number", allVariants).in("rarity", rarityValues!).limit(10);
            if (filtered && filtered.length > 0) { cards = filtered; }
            else {
              const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).in("card_number", allVariants).limit(10);
              cards = data || [];
            }
          } else {
            const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", visionResult.name).in("card_number", allVariants).limit(10);
            cards = data || [];
          }
        }
      }

      // Attempt 6: fuzzy name-only fallback (newest sets first)
      if (!cards.length) {
        if (hasRarity) {
          const { data: filtered } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", `%${visionResult.name}%`).in("rarity", rarityValues!).order("set_code", { ascending: false }).limit(10);
          if (filtered && filtered.length > 0) { cards = filtered; }
          else {
            const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", `%${visionResult.name}%`).order("set_code", { ascending: false }).limit(10);
            cards = data || [];
          }
        } else {
          const { data } = await supabase.from("catalog_cards").select(CATALOG_SELECT).eq("game", game).ilike("name", `%${visionResult.name}%`).order("set_code", { ascending: false }).limit(10);
          cards = data || [];
        }
      }
    }

    // ── STEP 3: Hash fallback ──
    if (!cards.length) {
      const hashResult = await recognizeByHash(rawB64, game, supabase);

      // Telemetry: hash fallback
      let scanResultId: string | null = null;
      if (sessionId) {
        scanResultId = await writeScanResult({
          sessionId, userId: userId!, game: game as any, method: "hash",
          visionOutput: visionResult, visionValidated: false,
          catalogMatchId: hashResult.result?.candidates?.[0]?.catalogCardId ?? null,
          catalogMatchName: hashResult.result?.candidates?.[0]?.name ?? null,
          candidateCount: hashResult.result?.candidates?.length ?? 0,
          confidenceBand: hashResult.result?.confidenceBand ?? null,
          topDistance: hashResult.result?.topDistance != null ? Math.round(hashResult.result.topDistance) : null,
          latencyMs: Date.now() - startedAt,
        });
      }

      return respond(NextResponse.json({ ...hashResult, method: "hash", visionResult, scan_session_id: sessionId, scan_result_id: scanResultId }));
    }

    // ── STEP 4: Build response ──
    const confidenceBand = cards.length === 1 && visionResult.confidence === "high" ? "exact" : cards.length === 1 ? "likely" : visionResult.confidence === "high" ? "choose_version" : "unclear";
    const candidates = cards.map((card: any, i: number) => ({
      rank: i + 1, catalogCardId: `${card.set_code}-${card.card_number}`, name: card.name, setName: card.set_name, setCode: card.set_code, cardNumber: card.card_number, rarity: card.rarity,
      imageSmallUrl: `https://images.pokemontcg.io/${card.set_code}/${card.card_number}.png`,
      imageLargeUrl: `https://images.pokemontcg.io/${card.set_code}/${card.card_number}_hires.png`,
      weightedDistance: i === 0 ? 0 : i * 5, distanceBreakdown: { phash: 0, dhash: 0, whash: 0 },
    }));

    // ── STEP 4a: Hash verification reranker ──
    // Compute perceptual hash of user photo vs each candidate's stored catalog hash.
    // Rerank by hash distance so "right name+number, wrong set" candidates get demoted.
    if (candidates.length >= 2) {
      try {
        const t4 = performance.now();
        verifierUsed = true;
        const cache = await getOrLoadCache(game, supabase);
        const userBuf = Buffer.from(rawB64, "base64");
        const preprocessed = await preprocessImage(userBuf);
        const userPhash = phash(preprocessed.data, preprocessed.width, preprocessed.height);
        const userDhash = dhash(preprocessed.data, preprocessed.width, preprocessed.height);
        const userWhash = whash(preprocessed.data, preprocessed.width, preprocessed.height);

        let scoredCount = 0;
        for (const c of candidates) {
          const entry = cache.entries.find(e => e.setCode === c.setCode && e.cardNumber === c.cardNumber);
          if (!entry) continue;
          const pd = hamming64(userPhash, entry.phash);
          const dd = hamming64(userDhash, entry.dhash);
          const wd = hamming64(userWhash, entry.whash);
          c.weightedDistance = pd * HASH_WEIGHTS.phash + dd * HASH_WEIGHTS.dhash + wd * HASH_WEIGHTS.whash;
          c.distanceBreakdown = { phash: pd, dhash: dd, whash: wd };
          scoredCount++;
        }

        // BANDED VERIFIER THRESHOLDS (replaces binary safety floor)
        // Distance bands (out of 64 for raw, normalized to 0-1):
        //   <= 8  (norm <= 0.125): strong match — trust verifier completely
        //   <= 16 (norm <= 0.25):  plausible match — trust verifier
        //   <= 26 (norm <= 0.40):  weak match — only rerank if vision was uncertain
        //   >  26 (norm >  0.40):  likely mismatch — preserve vision ranking
        const visionWeak = !visionResult.set || visionResult.set === "unknown" || visionResult.number_confidence === "low";
        const topDist = candidates[0]?.weightedDistance ?? 999;

        let shouldRerank = false;
        if (topDist <= 16) {
          // Strong or plausible match — always trust verifier
          shouldRerank = true;
        } else if (topDist <= 26 && visionWeak) {
          // Weak match — only trust verifier when vision was uncertain
          shouldRerank = true;
        }
        // else: likely mismatch — preserve vision ranking

        if (shouldRerank && scoredCount >= 2) {
          candidates.sort((a, b) => (a.weightedDistance ?? 999) - (b.weightedDistance ?? 999));
          candidates.forEach((c, i) => { c.rank = i + 1; });
          verifierReranked = true;
        }

        verifierTopDist = candidates[0]?.weightedDistance != null ? candidates[0].weightedDistance / 64 : null;
        verifierGap = (scoredCount >= 2 && candidates[0]?.weightedDistance != null && candidates[1]?.weightedDistance != null)
          ? (candidates[1].weightedDistance - candidates[0].weightedDistance) / 64
          : null;
        verifierMs = Math.round(performance.now() - t4);

        console.log("[verify] hash verification", {
          candidateCount: candidates.length,
          scoredCount,
          topDist: topDist.toFixed(2),
          visionWeak,
          shouldRerank,
          reranked: verifierReranked,
          distances: candidates.map(c => c.weightedDistance?.toFixed(2) ?? "n/a"),
          latencyMs: verifierMs,
        });
      } catch (verifyErr) {
        console.warn("[verify] hash verification failed, using vision ranking:", verifyErr instanceof Error ? verifyErr.message : verifyErr);
      }
    }

    // Telemetry: vision success (uses post-rerank candidate order)
    const topDistance = candidates[0]?.weightedDistance ?? 0;
    let scanResultId: string | null = null;
    if (sessionId) {
      scanResultId = await writeScanResult({
        sessionId, userId: userId!, game: game as any, method: "vision",
        visionOutput: visionResult, visionValidated,
        catalogMatchId: candidates[0]?.catalogCardId ?? null,
        catalogMatchName: candidates[0]?.name ?? null,
        candidateCount: candidates.length,
        confidenceBand, topDistance: topDistance != null ? Math.round(topDistance) : 0,
        latencyMs: Date.now() - startedAt,
        imagePreW: typeof imagePreW === "number" ? imagePreW : null,
        imagePreH: typeof imagePreH === "number" ? imagePreH : null,
        imagePostW: typeof imagePostW === "number" ? imagePostW : null,
        imagePostH: typeof imagePostH === "number" ? imagePostH : null,
        imageTokensEst,
        modelName: MODEL_NAME,
        visionMs,
        verifierUsed, verifierReranked, verifierTopDist, verifierGap, verifierMs,
      });
    }

    return respond(NextResponse.json({ ok: true, method: "vision", visionResult, result: { confidenceBand, topDistance, candidates }, scan_session_id: sessionId, scan_result_id: scanResultId }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}

// ── HASH FALLBACK (recognition algorithm untouched) ──
async function recognizeByHash(imageBase64: string, game: string, supabase: any): Promise<any> {
  const buffer = Buffer.from(imageBase64, "base64");
  if (buffer.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "Image too large" };
  const t0 = performance.now();
  let data: Uint8Array, width: number, height: number;
  try { const r = await preprocessImage(buffer); data = r.data; width = r.width; height = r.height; } catch { return { ok: false, error: "Invalid image format" }; }
  const preprocessMs = Math.round(performance.now() - t0);
  const t1 = performance.now();
  const queryPhash = phash(data, width, height); const queryDhash = dhash(data, width, height); const queryWhash = whash(data, width, height);
  const hashMs = Math.round(performance.now() - t1);
  const t2 = performance.now();
  let cache;
  try { cache = await getOrLoadCache(game, supabase); } catch (err) { if (err instanceof CacheLoadError) return { ok: false, error: err.message }; throw err; }
  const cacheMs = Math.round(performance.now() - t2);
  const t3 = performance.now();
  const scored = cache.entries.map(entry => {
    const phashDist = hamming64(queryPhash, entry.phash); const dhashDist = hamming64(queryDhash, entry.dhash); const whashDist = hamming64(queryWhash, entry.whash);
    return { entry, distance: phashDist * HASH_WEIGHTS.phash + dhashDist * HASH_WEIGHTS.dhash + whashDist * HASH_WEIGHTS.whash, phashDist, dhashDist, whashDist };
  });
  scored.sort((a, b) => a.distance - b.distance);
  const top = scored.slice(0, 5);
  const matchMs = Math.round(performance.now() - t3);
  const band = top.length > 0 ? bandFromDistance(top[0].distance) : "unclear";
  return { ok: true, latencyMs: Math.round(performance.now() - t0), timing: { preprocessMs, hashMs, cacheMs, matchMs },
    result: { confidenceBand: band, topDistance: top[0]?.distance ?? 64,
      candidates: top.map((r, i) => ({ rank: i + 1, catalogCardId: `${r.entry.setCode}-${r.entry.cardNumber}`, name: r.entry.name, setName: r.entry.setName, setCode: r.entry.setCode, cardNumber: r.entry.cardNumber, rarity: r.entry.rarity, imageSmallUrl: r.entry.imageSmallUrl, imageLargeUrl: r.entry.imageLargeUrl, weightedDistance: r.distance, distanceBreakdown: { phash: r.phashDist, dhash: r.dhashDist, whash: r.whashDist } })),
    },
  };
}
