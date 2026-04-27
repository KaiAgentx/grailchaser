/**
 * PATCH /api/tcg/shows/[id]
 *
 * Update a show — partial. Pass only the fields to change.
 * Body: { ended_at?: ISO; name?: string; notes?: string }
 *
 * Validation:
 *   - 'show_already_ended' (400): ended_at provided AND show already ended
 *   - 'invalid_end_time'   (400): ended_at provided AND ended_at <= started_at
 *   - 404: not the owner / show doesn't exist
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";

const ROUTE = "/api/tcg/shows/[id]";
const ECOSYSTEM = "tcg";
const NAME_MAX_LEN = 100;
const NOTES_MAX_LEN = 2000;

function bodyError(message: string, code: string, requestId: string): NextResponse {
  return NextResponse.json(
    { error: "invalid_body", code, message, request_id: requestId },
    { status: 400, headers: { "X-Error-Code": "invalid_body" } },
  );
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getOrCreateRequestId(req.headers);
  const startedAt = Date.now();
  let userId: string | null = null;

  const respond = (resp: NextResponse): NextResponse => {
    resp.headers.set("X-Request-ID", requestId);
    logRequest({ requestId, route: ROUTE, method: "PATCH", userId, ecosystem: ECOSYSTEM, status: resp.status, latencyMs: Date.now() - startedAt, errorCode: resp.headers.get("x-error-code") });
    return resp;
  };

  try {
    userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return respond(errorResponse({ code: ErrorCode.UNAUTHORIZED, requestId }));

    const limit = checkRateLimit(userId, "default");
    if (!limit.allowed) return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));

    const { id: showId } = await context.params;
    if (!showId) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "show id required", requestId }));

    let body: { ended_at?: string; name?: string; notes?: string } = {};
    try { body = await req.json(); } catch { return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "Invalid JSON", requestId })); }

    if (body.name != null && (typeof body.name !== "string" || body.name.length > NAME_MAX_LEN)) {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: `name must be string, max ${NAME_MAX_LEN} chars`, requestId }));
    }
    if (body.notes != null && (typeof body.notes !== "string" || body.notes.length > NOTES_MAX_LEN)) {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: `notes must be string, max ${NOTES_MAX_LEN} chars`, requestId }));
    }
    if (body.ended_at != null && typeof body.ended_at !== "string") {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "ended_at must be an ISO timestamp string", requestId }));
    }

    const svc = serviceRoleClient();

    // Load existing row to enforce ownership + state-transition rules
    const { data: current, error: loadErr } = await svc
      .from("shows")
      .select("*")
      .eq("id", showId)
      .eq("user_id", userId)
      .maybeSingle();
    if (loadErr) {
      console.error(`[${ROUTE}] load error:`, loadErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }
    if (!current) return respond(errorResponse({ code: ErrorCode.NOT_FOUND, details: "show not found", requestId }));

    // ended_at validation
    if (body.ended_at != null) {
      if (current.ended_at) {
        return respond(bodyError("Show is already ended; cannot re-end.", "show_already_ended", requestId));
      }
      const endedAt = new Date(body.ended_at);
      if (Number.isNaN(endedAt.getTime())) {
        return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "ended_at must be a valid ISO timestamp", requestId }));
      }
      if (endedAt.getTime() <= new Date(current.started_at).getTime()) {
        return respond(bodyError("ended_at must be after started_at.", "invalid_end_time", requestId));
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.ended_at !== undefined) updates.ended_at = body.ended_at;

    if (Object.keys(updates).length === 0) {
      return respond(NextResponse.json({ show: current }));
    }

    const { data: updated, error: updateErr } = await svc
      .from("shows")
      .update(updates)
      .eq("id", showId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (updateErr) {
      console.error(`[${ROUTE}] update error:`, updateErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }

    return respond(NextResponse.json({ show: updated }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
