/**
 * POST /api/tcg/bulk-recognize
 * Accepts multipart/form-data with N image files, runs the existing
 * recognize pipeline per image via internal fetch. Returns an array
 * of recognition results correlated to each file.
 *
 * Creates ONE scan_sessions row (session_type="batch_import") shared
 * by all per-image scan_results rows.
 *
 * Rate limit: uses "default" bucket (60/min). The real throughput
 * gate is the per-image recognize endpoint (30/min).
 * Hard cap: 100 images per batch.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { getOrCreateScanSession } from "@/lib/scanTelemetry";

const ROUTE = "/api/tcg/bulk-recognize";
const ECOSYSTEM = "tcg";
const MAX_FILES = 100;

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
    // Auth
    userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return respond(errorResponse({ code: ErrorCode.UNAUTHORIZED, requestId }));

    const authHeader = req.headers.get("authorization") || "";

    // Rate limit
    const limit = checkRateLimit(userId, "bulk");
    if (!limit.allowed) {
      return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));
    }

    // Parse multipart
    const formData = await req.formData();
    const game = formData.get("game") as string;
    if (!game) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "game field required", requestId }));

    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files[]" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "no files provided", requestId }));
    if (files.length > MAX_FILES) {
      return respond(NextResponse.json({ error: "too_many_files", max: MAX_FILES }, { status: 413 }));
    }

    // Create ONE batch session
    const batchSessionId = await getOrCreateScanSession(userId, game as any, "batch_import", null);

    // Build internal recognize URL from incoming request
    const origin = new URL(req.url).origin;
    const recognizeUrl = `${origin}/api/tcg/recognize`;

    // Process each file sequentially
    const results: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name || `image_${i}`;
      const fileSize = file.size;

      try {
        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // Call existing recognize endpoint
        const res = await fetch(recognizeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
            "X-Scan-Session-ID": batchSessionId || "",
          },
          body: JSON.stringify({
            game,
            imageBase64: base64,
            scanIntent: "collect",
          }),
        });

        const data = await res.json().catch(() => ({}));

        results.push({
          file_name: fileName,
          file_size: fileSize,
          outcome: res.ok && data.ok ? "recognized" : data.error === "recognition_timeout" ? "timeout" : "error",
          scan_result_id: data.scan_result_id ?? null,
          result: data.result ?? null,
          visionResult: data.visionResult ?? null,
          method: data.method ?? null,
          error: res.ok ? null : (data.error || data.details || `HTTP ${res.status}`),
        });
      } catch (err) {
        results.push({
          file_name: fileName,
          file_size: fileSize,
          outcome: "error",
          scan_result_id: null,
          result: null,
          visionResult: null,
          method: null,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      // 200ms pacing between images
      if (i < files.length - 1) {
        await new Promise(res => setTimeout(res, 200));
      }
    }

    return respond(NextResponse.json({
      batch_session_id: batchSessionId,
      total: files.length,
      recognized: results.filter(r => r.outcome === "recognized").length,
      errors: results.filter(r => r.outcome === "error").length,
      timeouts: results.filter(r => r.outcome === "timeout").length,
      results,
    }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
