/**
 * POST /api/tcg/scan-results/[id]/decision
 * Records the user's Session G in-person decision for a scan:
 * user_decision, dealer_ask, decision_at, and a PPT comps snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";

const ROUTE = "/api/tcg/scan-results/[id]/decision";
const ECOSYSTEM = "tcg";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_DECISIONS = new Set(["skip", "purchased", "walked"]);

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { id: scanResultId } = await context.params;
    if (!UUID_RE.test(scanResultId)) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "scan result id must be a UUID", requestId }));

    let body: any;
    try { body = await req.json(); } catch { return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "Invalid JSON", requestId })); }

    const decision = body.user_decision;
    if (typeof decision !== "string" || !VALID_DECISIONS.has(decision)) {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "user_decision must be one of: skip, purchased, walked", requestId }));
    }

    const update: Record<string, unknown> = {
      user_decision: decision,
      decision_at: new Date().toISOString(),
    };
    const dealerAsk = numOrNull(body.dealer_ask);
    if (dealerAsk != null) update.dealer_ask = dealerAsk;
    const rawMarket = numOrNull(body.ppt_raw_market);
    if (rawMarket != null) update.ppt_raw_market = rawMarket;
    const psa10 = numOrNull(body.ppt_psa10_avg);
    if (psa10 != null) update.ppt_psa10_avg = psa10;
    const psa9 = numOrNull(body.ppt_psa9_avg);
    if (psa9 != null) update.ppt_psa9_avg = psa9;
    const psa8 = numOrNull(body.ppt_psa8_avg);
    if (psa8 != null) update.ppt_psa8_avg = psa8;
    if (typeof body.ppt_trend30d === "string" && body.ppt_trend30d.length > 0) {
      update.ppt_trend30d = body.ppt_trend30d;
    }

    const svc = serviceRoleClient();
    const { data, error } = await svc
      .from("scan_results")
      .update(update)
      .eq("id", scanResultId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) { console.error(`[${ROUTE}] update error:`, error.message); return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, details: error.message, requestId })); }
    if (!data) return respond(errorResponse({ code: ErrorCode.NOT_FOUND, details: "scan result not found", requestId }));

    return respond(NextResponse.json({ ok: true, id: data.id }, { status: 200 }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
