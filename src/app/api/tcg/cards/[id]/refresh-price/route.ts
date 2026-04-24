/**
 * POST /api/tcg/cards/[id]/refresh-price
 * On-demand price refresh via PPT. Updates raw_value + tier + last_price_check_at.
 * Non-destructive: not_found / timeout / error never zero out an existing price.
 * 60s per-card cooldown via last_price_check_at.
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCardGradedComps } from "@/lib/ppt/client";
import { calcTier } from "@/lib/utils";

const ROUTE = "/api/tcg/cards/[id]/refresh-price";
const ECOSYSTEM = "tcg";
const COOLDOWN_MS = 60_000; // 60 seconds per card

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
    // Auth
    userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return respond(errorResponse({ code: ErrorCode.UNAUTHORIZED, requestId }));

    // User-scoped rate limit
    const limit = checkRateLimit(userId, "default");
    if (!limit.allowed) {
      return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));
    }

    // Card ID from params
    const { id: cardId } = await context.params;
    if (!cardId) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "card id required", requestId }));

    // Load card row
    const svc = serviceRoleClient();
    const { data: card, error: loadErr } = await svc
      .from("cards")
      .select("id, user_id, player, set, card_number, raw_value, tier, last_price_check_at")
      .eq("id", cardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (loadErr) {
      console.error(`[${ROUTE}] load error:`, loadErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }
    if (!card) return respond(errorResponse({ code: ErrorCode.NOT_FOUND, details: "card not found", requestId }));

    // Per-card 60s cooldown
    if (card.last_price_check_at) {
      const elapsed = Date.now() - new Date(card.last_price_check_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return respond(NextResponse.json(
          { outcome: "rate_limited", retry_after_seconds: retryAfter, card },
          { status: 429, headers: { "Retry-After": String(retryAfter) } }
        ));
      }
    }

    // Call PPT
    const outcome = await getCardGradedComps({
      name: card.player,
      setName: card.set,
      cardNumber: card.card_number,
    });

    // Handle non-ok outcomes — no DB write, no cooldown set
    if (outcome.status === "not_found") {
      return respond(NextResponse.json({ outcome: "not_found", card }));
    }
    if (outcome.status === "timeout") {
      return respond(NextResponse.json({ outcome: "error", card, message: "Price lookup timed out" }));
    }
    if (outcome.status === "rate_limited") {
      return respond(NextResponse.json(
        { outcome: "rate_limited", retry_after_seconds: outcome.retryAfterSeconds ?? 60, card },
        { status: 429, headers: { "Retry-After": String(outcome.retryAfterSeconds ?? 60) } }
      ));
    }
    if (outcome.status === "error") {
      return respond(NextResponse.json({ outcome: "error", card, message: outcome.message || "Price lookup failed" }));
    }

    // status === "ok" — but raw_market can still be null
    const newRawValue = outcome.comps.raw_market;
    if (newRawValue === null || newRawValue === undefined) {
      return respond(NextResponse.json({ outcome: "not_found", card }));
    }

    // Compute new tier
    const oldRawValue = card.raw_value;
    const oldTier = card.tier;
    const newTier = calcTier(newRawValue);

    // Update card
    const { data: updated, error: updateErr } = await svc
      .from("cards")
      .update({
        raw_value: newRawValue,
        tier: newTier,
        last_price_check_at: new Date().toISOString(),
      })
      .eq("id", cardId)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateErr) {
      console.error(`[${ROUTE}] update error:`, updateErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }

    return respond(NextResponse.json({
      outcome: "refreshed",
      card: updated,
      before: { raw_value: oldRawValue, tier: oldTier },
      after: { raw_value: newRawValue, tier: newTier },
    }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
