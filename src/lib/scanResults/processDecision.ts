/**
 * processDecision — shared logic for the show-mode decision endpoints.
 *
 * Used by:
 *   POST /api/tcg/scan-results/[id]/decision     (single)
 *   POST /api/tcg/scan-results/decisions/batch   (offline replay)
 *
 * Validates the body, loads the scan_result row (auth via user_id),
 * optionally validates show_id ownership/state, UPDATEs scan_results
 * with the decision fields, and (when decision='purchased') chains to
 * createCardFromScanResult.
 *
 * Returns a discriminated union so the caller can format HTTP responses
 * differently for single (errorResponse) vs batch (per-entry failure).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, ScanResult } from "@/lib/types";
import { createCardFromScanResult } from "@/lib/collection/createCardFromScanResult";
import { defaultStorageBoxName } from "@/lib/collection/insertCollectionItem";

const VALID_DECISIONS = new Set(["walked", "negotiated", "purchased"]);

export interface DecisionBody {
  decision: unknown;
  ask_price_usd: unknown;
  negotiated_price_usd?: unknown;
  final_price_usd?: unknown;
  show_id?: unknown;
  comp_at_decision_usd?: unknown;
}

export interface ProcessDecisionArgs {
  userId: string;
  scanResultId: string;
  body: DecisionBody;
  /** Override decision_at — used by the batch route to honor client_recorded_at. */
  decisionAt?: string;
  supabase: SupabaseClient;
}

export type ProcessDecisionResult =
  | { ok: true; scanResult: ScanResult; card: Card | null }
  | { ok: false; errorCode: ProcessDecisionErrorCode; errorMessage: string; httpStatus: number };

export type ProcessDecisionErrorCode =
  | "invalid_body"
  | "not_found"
  | "show_not_found"
  | "show_ended"
  | "server_error";

function fail(code: ProcessDecisionErrorCode, message: string, status: number): ProcessDecisionResult {
  return { ok: false, errorCode: code, errorMessage: message, httpStatus: status };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function processDecision(args: ProcessDecisionArgs): Promise<ProcessDecisionResult> {
  const { userId, scanResultId, body, decisionAt, supabase } = args;

  // ─── Body validation ───
  if (typeof body.decision !== "string" || !VALID_DECISIONS.has(body.decision)) {
    return fail("invalid_body", "decision must be one of: walked, negotiated, purchased", 400);
  }
  const decision = body.decision as "walked" | "negotiated" | "purchased";

  if (!isFiniteNumber(body.ask_price_usd) || body.ask_price_usd < 0) {
    return fail("invalid_body", "ask_price_usd is required and must be >= 0", 400);
  }
  const ask_price_usd = body.ask_price_usd;

  let negotiated_price_usd: number | null = null;
  if (body.negotiated_price_usd != null) {
    if (!isFiniteNumber(body.negotiated_price_usd) || body.negotiated_price_usd < 0) {
      return fail("invalid_body", "negotiated_price_usd must be a number >= 0", 400);
    }
    negotiated_price_usd = body.negotiated_price_usd;
  }

  let final_price_usd: number | null = null;
  if (body.final_price_usd != null) {
    if (!isFiniteNumber(body.final_price_usd) || body.final_price_usd < 0) {
      return fail("invalid_body", "final_price_usd must be a number >= 0", 400);
    }
    final_price_usd = body.final_price_usd;
  }

  if (decision === "purchased" && final_price_usd == null) {
    return fail("invalid_body", "final_price_usd is required when decision='purchased'", 400);
  }
  if (decision === "walked" && final_price_usd != null) {
    return fail("invalid_body", "final_price_usd must be omitted when decision='walked'", 400);
  }

  let show_id: string | null = null;
  if (body.show_id != null) {
    if (typeof body.show_id !== "string") {
      return fail("invalid_body", "show_id must be a string", 400);
    }
    show_id = body.show_id;
  }

  let comp_at_decision_usd: number | null = null;
  if (body.comp_at_decision_usd != null) {
    if (!isFiniteNumber(body.comp_at_decision_usd) || body.comp_at_decision_usd < 0) {
      return fail("invalid_body", "comp_at_decision_usd must be a number >= 0", 400);
    }
    comp_at_decision_usd = body.comp_at_decision_usd;
  }

  // ─── Load scan_result (auth via user_id) ───
  const { data: scanRow, error: loadErr } = await supabase
    .from("scan_results")
    .select("*")
    .eq("id", scanResultId)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadErr) {
    console.error("[processDecision] load error:", loadErr.message);
    return fail("server_error", "Could not load scan result.", 500);
  }
  if (!scanRow) return fail("not_found", "scan result not found", 404);

  // ─── Show validation ───
  if (show_id) {
    const { data: show, error: showErr } = await supabase
      .from("shows")
      .select("id, ended_at")
      .eq("id", show_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (showErr) {
      console.error("[processDecision] show load error:", showErr.message);
      return fail("server_error", "Could not validate show.", 500);
    }
    if (!show) return fail("show_not_found", "show not found or not owned by user", 404);
    if (show.ended_at) return fail("show_ended", "show is already ended; cannot tag new decisions to it", 400);
  }

  // ─── Update scan_results ───
  const decision_at = decisionAt ?? new Date().toISOString();
  const updates = {
    user_decision: decision,
    ask_price_usd,
    negotiated_price_usd,
    final_price_usd,
    show_id,
    comp_at_decision_usd,
    decision_at,
    // Legacy compat: mirror ask_price_usd into dealer_ask. Session G consumers
    // may still read this column. TODO: drop dealer_ask after Phase B-ui audits readers.
    dealer_ask: ask_price_usd,
  };
  const { data: updated, error: updateErr } = await supabase
    .from("scan_results")
    .update(updates)
    .eq("id", scanResultId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (updateErr) {
    console.error("[processDecision] update error:", updateErr.message);
    return fail("server_error", "Could not record decision.", 500);
  }

  const updatedScanResult = updated as ScanResult;

  // ─── Chain card creation when purchased ───
  //
  // Transaction caveat: scan_results UPDATE and the card insert are sequential,
  // not atomic. If the insert fails after the UPDATE, the scan_result is
  // marked 'purchased' with no card row. The stats endpoint LEFT JOINs cards
  // so the orphan still appears in the timeline as bought with card_id=null.
  // UI can flag for retry. Acceptable for Phase B; revisit if observed in dogfood.
  let card: Card | null = null;
  if (decision === "purchased" && final_price_usd != null) {
    const storageBoxName = defaultStorageBoxName({
      game: updatedScanResult.game,
      isShowPurchase: show_id != null,
    });
    const insertResult = await createCardFromScanResult({
      userId,
      scanResult: updatedScanResult,
      costBasisUsd: final_price_usd,
      storageBoxName,
      supabase,
    });
    if ("error" in insertResult) {
      console.error("[processDecision] card creation failed:", insertResult.error);
      return fail("server_error", insertResult.error, 500);
    }
    card = insertResult.card;
  }

  return { ok: true, scanResult: updatedScanResult, card };
}
