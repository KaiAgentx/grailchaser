/**
 * POST /api/tcg/scan-results/[id]/correct
 * Records a user correction when they pick a non-rank-1 variant.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";

const ROUTE = "/api/tcg/scan-results/[id]/correct";
const ECOSYSTEM = "tcg";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Next.js 16: params is Promise<{id: string}>
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

    const limit = checkRateLimit(userId, "catalog_read");
    if (!limit.allowed) return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));

    const { id: scanResultId } = await context.params;
    if (!UUID_RE.test(scanResultId)) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "scan result id must be a UUID", requestId }));

    let body: any;
    try { body = await req.json(); } catch { return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "Invalid JSON", requestId })); }

    const finalCatalogId = body.final_catalog_id;
    const finalCatalogName = body.final_catalog_name;
    if (!finalCatalogId || typeof finalCatalogId !== "string") return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "final_catalog_id required", requestId }));

    const svc = serviceRoleClient();
    const { data, error } = await svc
      .from("scan_results")
      .update({ was_corrected: true, final_catalog_id: finalCatalogId, final_catalog_name: finalCatalogName ?? null })
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
