/**
 * POST /api/tcg/collection-items
 * Idempotent, JWT-authenticated, rate-limited endpoint to add a TCG card.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, isValidUuid, canonicalHash, checkIdempotency, writeIdempotency, serviceRoleClient, TCG_GAME_VALUES } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";

const ROUTE = "/api/tcg/collection-items";
const ECOSYSTEM = "tcg";

const GAME_TO_SPORT: Record<string, string> = {
  pokemon: "Pokemon",
  mtg: "Magic",
  one_piece: "One Piece",
};

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

    const sportValue = GAME_TO_SPORT[body.game];
    if (!sportValue) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: `Unsupported game: ${body.game}`, requestId }));

    const cardData: Record<string, any> = {
      game: body.game, player: body.player, sport: sportValue,
      year: new Date().getFullYear(), brand: body.brand || "Pokémon TCG",
      set: body.set || body.set_name || "", card_number: body.card_number || "",
      team: "", parallel: "Base", is_rc: false, is_auto: false, is_numbered: false,
      watchlist: false, grade_candidate: false, gem_probability: 0.15,
      graded_values: { "10": 0, "9": 0, "8": 0, "7": 0 }, status: "raw",
      tier: (body.raw_value || 0) >= 100 ? "Gem" : (body.raw_value || 0) >= 25 ? "Star" : (body.raw_value || 0) >= 5 ? "Core" : "Bulk",
      condition: "NM", date_added: new Date().toISOString().slice(0, 10),
      notes: `TCG: ${body.game}`,
    };
    if (body.rarity != null) cardData.rarity = body.rarity;
    if (body.raw_value != null) cardData.raw_value = body.raw_value;
    if (body.cost_basis != null) cardData.cost_basis = body.cost_basis;
    if (body.scan_image_url) cardData.scan_image_url = body.scan_image_url;
    if (body.set_code) cardData.set_code = body.set_code;
    if (body.set_name) cardData.set_name = body.set_name;
    if (body.finish) cardData.finish = body.finish;
    if (body.language) cardData.language = body.language;
    if (body.metadata) cardData.metadata = body.metadata;
    if (body.catalogCardId) cardData.catalog_card_id = body.catalogCardId;
    if (body.canonical_card_id) cardData.canonical_card_id = body.canonical_card_id;
    if (body.printing_id) cardData.printing_id = body.printing_id;

    // Validate catalog_card_id exists in catalog
    if (body.catalogCardId) {
      const [setCode, ...numParts] = body.catalogCardId.split("-");
      const cardNumber = numParts.join("-");
      if (!setCode || !cardNumber) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "Invalid catalog_card_id format", requestId }));
      const svcCheck = serviceRoleClient();
      const { data: catalogRow } = await svcCheck.from("catalog_cards").select("id").eq("set_code", setCode).eq("card_number", cardNumber).limit(1).maybeSingle();
      if (!catalogRow) {
        console.warn(`[TcgAPI] catalog_card_id not found: ${body.catalogCardId} (userId: ${userId})`);
        return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "Card not found in catalog", requestId }));
      }
    }

    const svc = serviceRoleClient();
    console.log("[TcgAPI] Inserting — userId:", userId, "game:", cardData.game, "catalogCardId:", cardData.catalog_card_id);
    const { data: rpcData, error: rpcError } = await svc.rpc("insert_collection_item", {
      p_user_id: userId,
      p_storage_box: body.storage_box || "PENDING",
      p_card_data: cardData,
    });
    if (rpcError) {
      console.error("[TcgAPI] RPC FAILED:", { requestId, userId, game: cardData.game, catalogCardId: cardData.catalog_card_id, error: rpcError });
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, details: "Could not save card to collection. Please try again.", requestId }));
    }
    console.log("[TcgAPI] RPC SUCCESS — rowId:", rpcData?.id, "game:", rpcData?.game);

    const responseBody = { card: rpcData };
    await writeIdempotency(userId, idemKey, ROUTE, reqHash, 201, responseBody);
    return respond(NextResponse.json(responseBody, { status: 201 }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
