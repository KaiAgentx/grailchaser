/**
 * POST /api/tcg/scan-results/[id]/decision
 *
 * Show Mode decision endpoint. Records walked|negotiated|purchased,
 * stamps decision metadata, and (when purchased) chains card creation
 * via createCardFromScanResult.
 *
 * REPLACES the Session G endpoint that took skip|purchased|walked +
 * dealer_ask + ppt_*. Quick Check decisions in the existing ResultScreen
 * silently fail until that UI migrates to this contract in Phase B-ui-1
 * (or Show Mode replaces Quick Check entirely).
 *
 * Legacy compat: dealer_ask is mirror-written from ask_price_usd until a
 * future cleanup commit confirms no readers depend on it (see processDecision).
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { processDecision } from "@/lib/scanResults/processDecision";

const ROUTE = "/api/tcg/scan-results/[id]/decision";
const ECOSYSTEM = "tcg";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
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

    const svc = serviceRoleClient();
    const result = await processDecision({ userId, scanResultId, body, supabase: svc });

    if (!result.ok) {
      // Map helper error codes onto the existing ErrorCode enum where possible;
      // surface custom show_* codes via INVALID_BODY/NOT_FOUND with details.
      if (result.errorCode === "not_found" || result.errorCode === "show_not_found") {
        return respond(errorResponse({ code: ErrorCode.NOT_FOUND, details: result.errorMessage, requestId }));
      }
      if (result.errorCode === "invalid_body" || result.errorCode === "show_ended") {
        return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: result.errorMessage, requestId }));
      }
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, details: result.errorMessage, requestId }));
    }

    return respond(NextResponse.json({ scan_result: result.scanResult, card: result.card }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
