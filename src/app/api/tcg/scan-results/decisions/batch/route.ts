/**
 * POST /api/tcg/scan-results/decisions/batch
 *
 * Offline-queue replay endpoint. Processes up to 100 decisions serially.
 * Each entry is independent — one failure doesn't abort the batch.
 *
 * Body: { decisions: Array<DecisionEntry> }
 *   DecisionEntry:
 *     scan_result_id: string         (required, since URL has no id)
 *     client_recorded_at: string     (ISO timestamp from device, used as decision_at)
 *     decision: 'walked' | 'negotiated' | 'purchased'
 *     ask_price_usd: number
 *     negotiated_price_usd?: number
 *     final_price_usd?: number       (required if decision='purchased')
 *     show_id?: string
 *     comp_at_decision_usd?: number
 *
 * Response:
 *   { succeeded: [scan_result_id, ...],
 *     failed:    [{ scan_result_id, error_code, error_message }, ...] }
 *
 * Rate limit: 'batch_decisions' bucket = 2/min ≈ 1 batch per 30s per user.
 *
 * Idempotency: re-running a successful entry is safe — the scan_results
 * UPDATE is idempotent (same fields written), and createCardFromScanResult
 * recovers from the DB unique violation on (user_id, scan_result_id) by
 * returning the existing card. Offline retries don't double-create.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { processDecision, type ProcessDecisionErrorCode } from "@/lib/scanResults/processDecision";

const ROUTE = "/api/tcg/scan-results/decisions/batch";
const ECOSYSTEM = "tcg";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH = 100;

interface BatchFailure {
  scan_result_id: string;
  error_code: ProcessDecisionErrorCode | "invalid_entry";
  error_message: string;
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

    const limit = checkRateLimit(userId, "batch_decisions");
    if (!limit.allowed) return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));

    let body: { decisions?: unknown };
    try { body = await req.json(); } catch { return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "Invalid JSON", requestId })); }

    if (!Array.isArray(body.decisions)) {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "decisions must be an array", requestId }));
    }
    if (body.decisions.length === 0) {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "decisions array is empty", requestId }));
    }
    if (body.decisions.length > MAX_BATCH) {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: `decisions array exceeds max of ${MAX_BATCH}`, requestId }));
    }

    const svc = serviceRoleClient();
    const succeeded: string[] = [];
    const failed: BatchFailure[] = [];

    // Serial processing — no Promise.all. Decisions in the same batch may
    // share resources (boxes, shows) and the per-card 60s cooldowns rely on
    // sequential ordering for predictable behavior.
    for (const raw of body.decisions) {
      // Per-entry shape validation: must have scan_result_id (UUID) at minimum,
      // since the URL doesn't carry it. Other field validation happens inside
      // processDecision and surfaces as 'invalid_body' errorCode.
      if (typeof raw !== "object" || raw == null) {
        failed.push({ scan_result_id: "", error_code: "invalid_entry", error_message: "entry must be an object" });
        continue;
      }
      const entry = raw as Record<string, unknown>;
      const scanResultId = typeof entry.scan_result_id === "string" ? entry.scan_result_id : "";
      if (!UUID_RE.test(scanResultId)) {
        failed.push({ scan_result_id: scanResultId, error_code: "invalid_entry", error_message: "scan_result_id missing or not a UUID" });
        continue;
      }
      const clientRecordedAt = typeof entry.client_recorded_at === "string" ? entry.client_recorded_at : undefined;

      const result = await processDecision({
        userId,
        scanResultId,
        body: entry as any,
        decisionAt: clientRecordedAt,
        supabase: svc,
      });

      if (result.ok) {
        succeeded.push(scanResultId);
      } else {
        failed.push({
          scan_result_id: scanResultId,
          error_code: result.errorCode,
          error_message: result.errorMessage,
        });
      }
    }

    return respond(NextResponse.json({ succeeded, failed }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
