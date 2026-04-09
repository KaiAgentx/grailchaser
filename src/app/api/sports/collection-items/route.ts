/**
 * POST /api/sports/collection-items
 * Idempotent, JWT-authenticated, rate-limited endpoint to add a sports card.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, isValidUuid, canonicalHash, checkIdempotency, writeIdempotency, serviceRoleClient, TCG_GAME_VALUES } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { calcTier, shouldFlagForGrading } from "@/lib/utils";

const ROUTE = "/api/sports/collection-items";
const ECOSYSTEM = "sports";

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
    if (!body.player) missing.push("player");
    if (!body.sport) missing.push("sport");
    if (missing.length > 0) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: `Missing: ${missing.join(", ")}`, requestId }));
    if (body.game && TCG_GAME_VALUES.includes(body.game)) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "TCG games must use /api/tcg/collection-items", requestId }));

    const reqHash = canonicalHash(body);
    const idem = await checkIdempotency(userId, idemKey, ROUTE, reqHash);
    if (idem.found && !idem.expired) {
      if (idem.match) return respond(NextResponse.json({ ...idem.responseBody, replay: true }, { status: 200 }));
      return respond(errorResponse({ code: ErrorCode.IDEMPOTENCY_MISMATCH, requestId }));
    }

    const rawVal = body.raw_value || 0;
    const gemProb = body.gem_probability || Math.random() * 0.6 + 0.1;
    const cardData: Record<string, any> = {
      game: body.game || "sports", player: body.player, sport: body.sport, team: body.team || "",
      year: body.year || new Date().getFullYear(), brand: body.brand || "Topps", set: body.set || "Base",
      parallel: body.parallel || "Base", card_number: body.card_number || "#1",
      is_rc: body.is_rc || false, is_auto: body.is_auto || false, is_numbered: body.is_numbered || false,
      numbered_to: body.numbered_to || null, condition: body.condition || "NM",
      raw_value: rawVal, cost_basis: body.cost_basis || 0,
      tier: calcTier(rawVal), gem_probability: +gemProb.toFixed(2),
      graded_values: body.graded_values || { "10": +(rawVal * (2.5 + Math.random() * 3)).toFixed(2), "9": +(rawVal * (1.5 + Math.random())).toFixed(2), "8": +(rawVal * (1.1 + Math.random() * 0.3)).toFixed(2), "7": +(rawVal * (0.9 + Math.random() * 0.2)).toFixed(2) },
      status: "raw", watchlist: body.watchlist || false, grade_candidate: shouldFlagForGrading(rawVal, gemProb),
      notes: body.notes || "", date_added: new Date().toISOString().slice(0, 10),
      purchase_source: body.purchase_source || null, purchase_intent: body.purchase_intent || null,
    };
    if (body.scan_image_url) cardData.scan_image_url = body.scan_image_url;
    if (body.metadata) cardData.metadata = body.metadata;

    const svc = serviceRoleClient();
    const { data, error } = await svc.rpc("insert_collection_item", { p_user_id: userId, p_storage_box: body.storage_box || "PENDING", p_card_data: cardData });
    if (error) { console.error(`[${ROUTE}] RPC error:`, error.message); return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, details: error.message, requestId })); }

    const responseBody = { card: data };
    await writeIdempotency(userId, idemKey, ROUTE, reqHash, 201, responseBody);
    return respond(NextResponse.json(responseBody, { status: 201 }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
