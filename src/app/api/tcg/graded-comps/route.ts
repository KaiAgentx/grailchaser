import { NextRequest, NextResponse } from "next/server";
import { extractUserId } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCardGradedComps, type GradedCompsOutcome } from "@/lib/ppt/client";

const ROUTE = "/api/tcg/graded-comps";
const ECOSYSTEM = "tcg";

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { outcome: GradedCompsOutcome; ts: number }>();

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);
  const startedAt = Date.now();
  let userId: string | null = null;

  const respond = (resp: NextResponse): NextResponse => {
    resp.headers.set("X-Request-ID", requestId);
    logRequest({ requestId, route: ROUTE, method: "GET", userId, ecosystem: ECOSYSTEM, status: resp.status, latencyMs: Date.now() - startedAt, errorCode: resp.headers.get("x-error-code") });
    return resp;
  };

  try {
    userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return respond(errorResponse({ code: ErrorCode.UNAUTHORIZED, requestId }));

    const limit = checkRateLimit(userId, "default");
    if (!limit.allowed) {
      return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));
    }

    const name = req.nextUrl.searchParams.get("name");
    const setName = req.nextUrl.searchParams.get("setName");
    const cardNumber = req.nextUrl.searchParams.get("cardNumber");
    if (!name || !setName || !cardNumber) {
      return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "name, setName, cardNumber required", requestId }));
    }

    const key = `${name}|${setName}|${cardNumber}`;
    const cached = cache.get(key);
    let outcome: GradedCompsOutcome;
    let fromCache = false;

    if (cached && Date.now() - cached.ts < CACHE_TTL_MS && cached.outcome.status !== "timeout" && cached.outcome.status !== "error") {
      // Only cache stable outcomes (ok / not_found / rate_limited). Timeout and error
      // may be transient — let the next call retry instead of pinning a bad result.
      outcome = cached.outcome;
      fromCache = true;
    } else {
      outcome = await getCardGradedComps({ name, setName, cardNumber });
      cache.set(key, { outcome, ts: Date.now() });
    }

    return respond(NextResponse.json({ ok: true, cached: fromCache, outcome }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
