/**
 * GET /api/tcg/shows/[id]/stats
 *
 * Aggregated stats + decision timeline for a show. Computed on-demand.
 *
 * Auth: must own the show (user_id match enforced via the row load).
 *
 * Notes:
 *   - bought_count = decisions with user_decision='purchased'
 *   - walked_count = decisions with user_decision='walked'
 *   - negotiated_count = decisions with user_decision='negotiated'
 *     ('negotiated' represents counter-offers in flight; if the deal closes,
 *     the same scan_result transitions to 'purchased' on a subsequent
 *     decision POST and is counted as bought instead)
 *   - total_spent_usd = SUM(final_price_usd) over purchased rows
 *   - avg_discount_pct = AVG((comp - final) / comp × 100) over purchased rows
 *     where comp_at_decision_usd IS NOT NULL
 *   - decisions[] = full timeline with LEFT-JOINed card_id/player when the
 *     decision created a card row
 */
import { NextRequest, NextResponse } from "next/server";
import { extractUserId, serviceRoleClient } from "@/lib/collectionItemsApi";
import { ErrorCode, errorResponse } from "@/lib/errors";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";
import { checkRateLimit } from "@/lib/rateLimit";
import type { ShowDecisionTimelineEntry, ShowStats } from "@/lib/types";

const ROUTE = "/api/tcg/shows/[id]/stats";
const ECOSYSTEM = "tcg";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
    if (!limit.allowed) return respond(errorResponse({ code: ErrorCode.RATE_LIMITED, details: `Rate limit exceeded (${limit.limit}/min). Retry in ${limit.retryAfterSeconds}s.`, requestId, headers: { "Retry-After": String(limit.retryAfterSeconds) } }));

    const { id: showId } = await context.params;
    if (!showId) return respond(errorResponse({ code: ErrorCode.INVALID_BODY, details: "show id required", requestId }));

    const svc = serviceRoleClient();

    // Ownership check via the show row
    const { data: show, error: showErr } = await svc
      .from("shows")
      .select("id")
      .eq("id", showId)
      .eq("user_id", userId)
      .maybeSingle();
    if (showErr) {
      console.error(`[${ROUTE}] show load error:`, showErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }
    if (!show) return respond(errorResponse({ code: ErrorCode.NOT_FOUND, details: "show not found", requestId }));

    // Pull decisions for this show. Embed cards via the FK (cards.scan_result_id
    // → scan_results.id). Supabase resolves nested via the foreign key
    // relationship; "cards (id, player)" returns the linked card row when one
    // exists or null otherwise (LEFT-JOIN semantics).
    const { data: rows, error: queryErr } = await svc
      .from("scan_results")
      .select("id, user_decision, ask_price_usd, final_price_usd, comp_at_decision_usd, created_at, cards (id, player)")
      .eq("show_id", showId)
      .in("user_decision", ["walked", "negotiated", "purchased"])
      .order("created_at", { ascending: true });

    if (queryErr) {
      console.error(`[${ROUTE}] query error:`, queryErr.message);
      return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
    }

    let bought_count = 0;
    let walked_count = 0;
    let negotiated_count = 0;
    let total_spent_usd = 0;
    const discounts: number[] = [];
    const decisions: ShowDecisionTimelineEntry[] = [];

    for (const r of rows ?? []) {
      // Supabase returns the embedded relation as either an object (single)
      // or array (multiple). `cards` here is "the card whose scan_result_id
      // points at this scan_result" — at most one due to the unique index.
      const linkedCard = Array.isArray((r as any).cards) ? (r as any).cards[0] ?? null : (r as any).cards ?? null;

      const decision = r.user_decision as ShowDecisionTimelineEntry["decision"];
      const ask = r.ask_price_usd != null ? Number(r.ask_price_usd) : null;
      const final_price = r.final_price_usd != null ? Number(r.final_price_usd) : null;
      const comp = r.comp_at_decision_usd != null ? Number(r.comp_at_decision_usd) : null;

      let pct_off_comp: number | null = null;
      if (comp != null && comp > 0 && final_price != null) {
        pct_off_comp = ((comp - final_price) / comp) * 100;
      }

      decisions.push({
        scan_result_id: r.id,
        player: linkedCard?.player ?? null,
        decision,
        ask_price_usd: ask,
        final_price_usd: final_price,
        comp_at_decision_usd: comp,
        pct_off_comp,
        created_at: r.created_at,
        card_id: linkedCard?.id ?? null,
      });

      if (decision === "purchased") {
        bought_count++;
        if (final_price != null) total_spent_usd += final_price;
        if (comp != null && comp > 0 && final_price != null) {
          discounts.push(((comp - final_price) / comp) * 100);
        }
      } else if (decision === "walked") {
        walked_count++;
      } else if (decision === "negotiated") {
        negotiated_count++;
      }
    }

    const avg_discount_pct = discounts.length > 0
      ? discounts.reduce((s, x) => s + x, 0) / discounts.length
      : 0;

    const stats: ShowStats = {
      bought_count,
      walked_count,
      negotiated_count,
      total_spent_usd: Number(total_spent_usd.toFixed(2)),
      avg_discount_pct: Number(avg_discount_pct.toFixed(2)),
      decisions,
    };

    return respond(NextResponse.json({ stats }));
  } catch (err: any) {
    console.error(`[${ROUTE}] unhandled:`, err?.message);
    return respond(errorResponse({ code: ErrorCode.SERVER_ERROR, requestId }));
  }
}
