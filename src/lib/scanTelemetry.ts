/**
 * Telemetry helpers for scan_sessions and scan_results.
 * All writes are best-effort — failures are logged but never thrown
 * to the caller, so telemetry can never break a recognition response.
 */
import { serviceRoleClient } from "@/lib/collectionItemsApi";

type SessionType = "quick_check" | "collection_save" | "batch_import";
type Game = "pokemon" | "mtg" | "one_piece";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the session_id to use for this scan. Reuses an existing open
 * session if the header matches, otherwise creates a new one.
 * Best-effort — returns null on failure.
 */
export async function getOrCreateScanSession(
  userId: string,
  game: Game,
  sessionType: SessionType,
  sessionIdHeader: string | null
): Promise<string | null> {
  const svc = serviceRoleClient();

  if (sessionIdHeader && UUID_RE.test(sessionIdHeader)) {
    try {
      const { data: existing } = await svc
        .from("scan_sessions")
        .select("id, user_id, ended_at, action_count")
        .eq("id", sessionIdHeader)
        .maybeSingle();

      if (existing && existing.user_id === userId && !existing.ended_at) {
        await svc
          .from("scan_sessions")
          .update({ action_count: (existing.action_count || 0) + 1 })
          .eq("id", sessionIdHeader);
        return sessionIdHeader;
      }
    } catch (err) {
      console.error("[scanTelemetry] reuse session failed:", err);
    }
  }

  try {
    const { data, error } = await svc
      .from("scan_sessions")
      .insert({
        user_id: userId,
        game,
        session_type: sessionType,
        is_offline: false,
        action_count: 1,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[scanTelemetry] create session failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[scanTelemetry] create session threw:", err);
    return null;
  }
}

/**
 * Closes a scan session by setting ended_at. Best-effort — no-op on null.
 */
export async function closeScanSession(sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  try {
    const svc = serviceRoleClient();
    await svc
      .from("scan_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId);
  } catch (err) {
    console.error("[scanTelemetry] closeScanSession failed:", err);
  }
}

export interface ScanResultRow {
  sessionId: string;
  userId: string;
  game: Game;
  method: string;
  visionOutput?: unknown;
  visionValidated: boolean;
  catalogMatchId?: string | null;
  catalogMatchName?: string | null;
  candidateCount: number;
  confidenceBand?: string | null;
  topDistance?: number | null;
  latencyMs: number;
  // WIN #3 telemetry fields
  imagePreW?: number | null;
  imagePreH?: number | null;
  imagePostW?: number | null;
  imagePostH?: number | null;
  imageTokensEst?: number | null;
  modelName?: string | null;
  visionMs?: number | null;
  verifierUsed?: boolean;
  verifierReranked?: boolean;
  verifierTopDist?: number | null;
  verifierGap?: number | null;
  verifierMs?: number | null;
}

/**
 * Inserts a scan_results row. Best-effort — logs and returns null on failure.
 */
export async function writeScanResult(row: ScanResultRow): Promise<string | null> {
  try {
    const svc = serviceRoleClient();
    const { data, error } = await svc
      .from("scan_results")
      .insert({
        session_id: row.sessionId,
        user_id: row.userId,
        game: row.game,
        method: row.method,
        vision_output: row.visionOutput ?? null,
        vision_validated: row.visionValidated,
        catalog_match_id: row.catalogMatchId ?? null,
        catalog_match_name: row.catalogMatchName ?? null,
        candidate_count: row.candidateCount,
        confidence_band: row.confidenceBand ?? null,
        top_distance: row.topDistance ?? null,
        latency_ms: row.latencyMs,
        image_pre_w: row.imagePreW ?? null,
        image_pre_h: row.imagePreH ?? null,
        image_post_w: row.imagePostW ?? null,
        image_post_h: row.imagePostH ?? null,
        image_tokens_est: row.imageTokensEst ?? null,
        model_name: row.modelName ?? null,
        vision_ms: row.visionMs ?? null,
        verifier_used: row.verifierUsed ?? false,
        verifier_reranked: row.verifierReranked ?? false,
        verifier_top_dist: row.verifierTopDist ?? null,
        verifier_gap: row.verifierGap ?? null,
        verifier_ms: row.verifierMs ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[scanTelemetry] writeScanResult failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[scanTelemetry] writeScanResult threw:", err);
    return null;
  }
}
