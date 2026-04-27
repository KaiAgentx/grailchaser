/**
 * POST /api/tcg/shows
 *
 * Start a new show for the authenticated user. If the user already has an
 * active show (ended_at IS NULL), returns 400 invalid_body with sub-code
 * 'show_already_active' so the UI can prompt to end the current one first.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";

const ROUTE = "/api/tcg/shows";
const ECOSYSTEM = "tcg";
const NAME_MAX_LEN = 100;

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

    const limit = checkRateLimit(userId, "default");
    if (!limit.allowed) return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));

    let body: { name?: string } = {};
    try { body = await req.json(); } catch { /* body optional */ }

    if (body.name != null) {
      if (typeof body.name !== "string") {
        return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "name must be a string", requestId }));
      }
      if (body.name.length > NAME_MAX_LEN) {
        return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: `name max ${NAME_MAX_LEN} chars`, requestId }));
      }
    }

    const svc = serviceRoleClient();

    // Reject if there's already an active show for this user
    const { data: existing, error: existingErr } = await svc
      .from("shows")
      .select("id")
      .eq("user_id", userId)
      .is("ended_at", null)
      .limit(1)
      .maybeSingle();
    if (existingErr) {
      console.error(`[${ROUTE}] active-check error:`, existingErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }
    if (existing) {
      return respond(NextResponse.json(
        {
          error: "invalid_body",
          code: "show_already_active",
          message: "You have an active show. End it before starting a new one.",
          request_id: requestId,
        },
        { status: 400, headers: { "X-Error-Code": "invalid_body" } },
      ));
    }

    const { data: show, error: insertErr } = await svc
      .from("shows")
      .insert({ user_id: userId, name: body.name ?? null })
      .select("*")
      .single();
    if (insertErr) {
      console.error(`[${ROUTE}] insert error:`, insertErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }

    return respond(NextResponse.json({ show }, { status: 201 }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
