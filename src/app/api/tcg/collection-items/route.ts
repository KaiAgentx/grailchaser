/**
 * POST /api/tcg/collection-items
 * Idempotent, JWT-authenticated, rate-limited endpoint to add a TCG card.
 *
 * Refactored in Phase B-data Commit 2: card-creation logic moved to
 * src/lib/collection/{buildCardData,insertCollectionItem}.ts. Behavior
 * unchanged — same auth, same idempotency, same response shape.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, isValidUuid, canonicalHash, checkIdempotency, writeIdempotency, serviceRoleClient, TCG_GAME_VALUES } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { buildCardData, resolveReleaseYear } from "@/lib/collection/buildCardData";
import { insertCollectionItem } from "@/lib/collection/insertCollectionItem";
import type { Game } from "@/lib/types";

const ROUTE = "/api/tcg/collection-items";
const ECOSYSTEM = "tcg";

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

    const limit = checkRateLimit(userId, "save");
    if (!limit.allowed) return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));

    const idemKey = req.headers.get("idempotency-key");
    if (!idemKey || !isValidUuid(idemKey)) return respond(errorResponse({ code: ErrorCode.MISSING_IDEMPOTENCY, requestId }));

    let body: any;
    try { body = await req.json(); } catch { return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "Invalid JSON", requestId })); }

    const missing: string[] = [];
    if (!body.catalogCardId) missing.push("catalogCardId");
    if (!body.game) missing.push("game");
    if (!body.player) missing.push("player");
    if (missing.length > 0) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: `Missing: ${missing.join(", ")}`, requestId }));
    if (!TCG_GAME_VALUES.includes(body.game)) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: `game must be one of: ${TCG_GAME_VALUES.join(", ")}`, requestId }));

    const reqHash = canonicalHash(body);
    const idem = await checkIdempotency(userId, idemKey, ROUTE, reqHash);
    if (idem.found && !idem.expired) {
      if (idem.match) return respond(NextResponse.json({ ...idem.responseBody, replay: true }, { status: 200 }));
      return respond(errorResponse({ code: ErrorCode.IDEMPOTENCY_MISMATCH, requestId }));
    }

    const svc = serviceRoleClient();

    // Resolve release year from catalog (also validates catalogCardId).
    const yearResult = await resolveReleaseYear(body.catalogCardId, svc);
    if ("error" in yearResult) {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: yearResult.error, requestId }));
    }

    const cardData = buildCardData({
      catalogCardId: body.catalogCardId,
      game: body.game as Game,
      player: body.player,
      releaseYear: yearResult.releaseYear,
      brand: body.brand,
      set: body.set,
      set_name: body.set_name,
      set_code: body.set_code,
      card_number: body.card_number,
      rarity: body.rarity,
      raw_value: body.raw_value,
      cost_basis: body.cost_basis,
      scan_image_url: body.scan_image_url,
      finish: body.finish,
      language: body.language,
      metadata: body.metadata,
      canonical_card_id: body.canonical_card_id,
      printing_id: body.printing_id,
      tcg_condition: body.tcg_condition,
      purchase_source: body.purchase_source,
      purchase_date: body.purchase_date,
    });

    console.log("[TcgAPI] Inserting — userId:", userId, "game:", body.game, "catalogCardId:", body.catalogCardId);
    const insertResult = await insertCollectionItem({
      userId,
      storageBoxName: body.storage_box || "PENDING",
      cardData,
      supabase: svc,
    });

    if ("error" in insertResult) {
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, details: insertResult.error, requestId }));
    }
    console.log("[TcgAPI] RPC SUCCESS — rowId:", insertResult.card?.id, "game:", (insertResult.card as { game?: string } | undefined)?.game);

    const responseBody = { card: insertResult.card };
    await writeIdempotency(userId, idemKey, ROUTE, reqHash, 201, responseBody);
    return respond(NextResponse.json(responseBody, { status: 201 }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, JSON.stringify({
      requestId,
      userId,
      err_name: err?.name ?? null,
      err_message: err?.message ?? null,
      err_stack: err?.stack ?? null,
    }));
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
