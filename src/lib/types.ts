import type { Tier } from "./utils";
export type { Tier };
export type CardStatus = "raw" | "listed" | "sold" | "shipped" | "grading" | "graded";
export type Condition = "Mint" | "NM" | "EX" | "VG" | "Good" | "Fair" | "Poor";

export interface Card {
  id: string;
  user_id: string;
  player: string;
  sport: string;
  team: string;
  year: number;
  brand: string;
  set: string;
  parallel: string;
  card_number: string;
  is_rc: boolean;
  is_auto: boolean;
  is_numbered: boolean;
  numbered_to: number | null;
  condition: Condition;
  raw_value: number;
  cost_basis: number;
  purchase_source: string | null;
  purchase_date: string | null;
  purchase_intent: "sell" | "grade" | "pc" | null;
  tier: Tier;
  gem_probability: number;
  graded_values: { "10": number; "9": number; "8": number; "7": number };
  status: CardStatus;
  watchlist: boolean;
  is_watched: boolean;
  grade_candidate: boolean;
  listed_platform: string | null;
  listed_price: number | null;
  listed_date: string | null;
  sold: boolean;
  sold_price: number | null;
  sold_date: string | null;
  sold_platform: string | null;
  shipped_date: string | null;
  tracking_number: string | null;
  grading_company: string | null;
  grading_submit_date: string | null;
  grading_return_date: string | null;
  graded_grade: string | null;
  grading_cost: number | null;
  grading_cert: string | null;
  storage_box: string;
  storage_row: number;
  storage_position: number;
  scan_image_url: string | null;
  scan_image_back_url: string | null;
  ebay_listing_id: string | null;
  ebay_offer_id: string | null;
  ebay_sku: string | null;
  ebay_url: string | null;
  ebay_price: number | null;
  ebay_listed_date: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  shopify_url: string | null;
  shopify_price: number | null;
  shopify_listed_date: string | null;
  whatnot_listing_id: string | null;
  whatnot_url: string | null;
  mercari_listed: boolean;
  mercari_url: string | null;
  facebook_listed: boolean;
  tcgplayer_listed: boolean;
  tcgplayer_url: string | null;
  lot_id: string | null;
  notes: string;
  date_added: string;
  created_at: string;
  updated_at: string;

  // ── Phase A: multi-source pricing ──
  // TCGPlayer (from Scrydex / Pokemon TCG API)
  tcgplayer_market_usd: number | null;
  tcgplayer_low_usd: number | null;
  tcgplayer_mid_usd: number | null;
  tcgplayer_high_usd: number | null;
  tcgplayer_avg7_usd: number | null;
  tcgplayer_avg30_usd: number | null;
  tcgplayer_listings_count: number | null;
  tcgplayer_sellers_count: number | null;
  // eBay raw + graded (from PPT)
  ebay_raw_avg_usd: number | null;
  psa10_avg_usd: number | null;
  psa9_avg_usd: number | null;
  psa8_avg_usd: number | null;
  // Population (PPT Business tier — null in Phase A)
  psa10_pop: number | null;
  psa9_pop: number | null;
  psa8_pop: number | null;
  // Trend & volatility (computed once history accumulates)
  trend_30d_direction: "up" | "down" | "flat" | null;
  trend_30d_pct: number | null;
  volatility_30d: number | null;
  avg_sale_30d_usd: number | null;
  time_to_sell_days: number | null;
  // Source attribution + freshness
  price_source: PriceSource | null;
  price_data_updated_at: string | null;
  // Grade-check state
  last_grade_check_at: string | null;
  last_psa10_probability: number | null;
  last_assessed_condition: string | null;
  // Watchlist alert thresholds (per-card)
  price_alert_threshold_usd: number | null;
  price_alert_direction: "above" | "below" | null;

  // ── Phase B-data: links the card back to the scan_result that produced it.
  // NULL for legacy cards and manual imports. Set by createCardFromScanResult
  // when the show-mode decision endpoint chains card creation.
  scan_result_id: string | null;
}

export type NewCard = Omit<Card, "id" | "user_id" | "created_at" | "updated_at"> & {
  id?: string;
  user_id?: string;
};

export type AlertType = "spike" | "drop" | "threshold" | "grading_opp" | "breakout" | "delist_reminder";
export type AlertFrequency = "instant" | "daily" | "weekly";
export type AlertScope = "all" | "watchlist";

export interface AlertRule {
  id: string;
  user_id: string;
  name: string;
  type: AlertType;
  threshold: number;
  frequency: AlertFrequency;
  scope: AlertScope;
  active: boolean;
  created_at: string;
}

export interface AlertEvent {
  id: string;
  user_id: string;
  rule_id: string | null;
  card_id: string;
  type: AlertType;
  old_price: number;
  new_price: number;
  change_pct: number;
  read: boolean;
  dismissed: boolean;
  created_at: string;
  card?: Card;
}

export interface PricePoint {
  price: number;
  recorded_at: string;
}

export interface Platform {
  name: string;
  feeRate: number;
  fixedFee: number;
  paymentFee: number;
  paymentFixed: number;
  pros: string[];
  cons: string[];
}

export interface GradingCompany {
  name: string;
  fee: number;
  turnaround: string;
  premium: number;
}

// =====================================================================
// TCG foundation types (Phase 0A)
//
// These describe the new TCG vocabulary: which games we support, which
// "world" each game lives in (Sports vs TCG), and the various states a
// TCG card can be in. None of these touch existing Sports types.
//
// IMPORTANT: TcgCondition is intentionally named to avoid colliding with
// the existing Sports `Condition` type at the top of this file.
// =====================================================================

// Which game a card belongs to. Used as the database `game` column.
// Sports support was removed in Session X; this app is TCG-only.
export type Game = "pokemon" | "mtg" | "one_piece";

// Standard TCG condition grades. Values match the Postgres `tcg_condition_t`
// enum exactly so app-side values can flow straight into `cards.tcg_condition`
// without translation. Render via `tcgConditionLabel(c)` — never show the raw
// value in UI.
export type TcgCondition =
  | "near_mint"
  | "lightly_played"
  | "moderately_played"
  | "heavily_played"
  | "damaged";

export const TCG_CONDITION_VALUES: readonly TcgCondition[] = [
  "near_mint",
  "lightly_played",
  "moderately_played",
  "heavily_played",
  "damaged",
] as const;

const TCG_CONDITION_LABELS: Record<TcgCondition, string> = {
  near_mint: "NM",
  lightly_played: "LP",
  moderately_played: "MP",
  heavily_played: "HP",
  damaged: "DMG",
};

export function tcgConditionLabel(c: TcgCondition): string {
  return TCG_CONDITION_LABELS[c];
}

// What kind of attention a card needs after a scan or import.
// "none" = good to go. Anything else = appears in the review queue.
export type ReviewState =
  | "none"
  | "needs_identity_review"
  | "needs_variant_review"
  | "needs_condition_review"
  | "needs_price_review"
  | "needs_duplicate_review"
  | "no_market_data";

// What the user decided after seeing a card's price (Quick Check buttons).
export type DecisionState =
  | "none"
  | "buy"
  | "maybe"
  | "pass"
  | "own_already"
  | "saved"
  | "grade_candidate"
  | "lot_candidate";

// Where a price came from. eBay is never primary for raw TCG.
// Phase A pricing extension: 'tcgplayer'|'mixed'|'ppt' added to the
// existing price_source_t enum to cover multi-source pricing payloads.
export type PriceSource =
  | "pokemon_tcg_api"
  | "scryfall"
  | "one_piece_provider"
  | "ebay"
  | "manual"
  | "tcgplayer"
  | "mixed"
  | "ppt";

// Status of a batch import job (e.g. scanning 800 MTG cards at once).
export type BatchStatus =
  | "queued"
  | "processing"
  | "review_required"
  | "completed"
  | "failed";

// What kind of scanning session is happening.
export type SessionType = "quick_check" | "collection_save" | "batch_import";

// Status of a card on the user's Watchlist (the "Maybe" pile).
export type WatchlistStatus = "active" | "acquired" | "dismissed";

// =====================================================================
// Phase B-data: Show Mode types
// =====================================================================

// A card show / convention session. The user starts a show before
// browsing dealer tables and ends it when they leave. Decisions
// (walked / negotiated / purchased) are tagged with the active show
// for per-show stats aggregation.
export interface Show {
  id: string;
  user_id: string;
  name: string | null;
  started_at: string;     // ISO timestamp
  ended_at: string | null; // null while the show is active
  notes: string | null;
  created_at: string;
}

// What the user did with a recognized card at a dealer's table.
// Note: 'skip' exists in the underlying scan_decision_t enum (legacy)
// but is rejected by the API. Migrated to 'walked' in the schema.
export type ScanDecision = "walked" | "negotiated" | "purchased";

// Aggregate stats for a single show. Computed on-demand by the
// /api/tcg/shows/[id]/stats endpoint.
export interface ShowStats {
  bought_count: number;
  walked_count: number;
  negotiated_count: number;
  total_spent_usd: number;
  // Average % off comp on bought cards. Computed only over rows where
  // comp_at_decision_usd was captured at decision time.
  avg_discount_pct: number;
  decisions: ShowDecisionTimelineEntry[];
}

// One row in the show's decision timeline. Includes a card_id link
// (nullable) when the decision created a card row via the chained
// insert path. Stats endpoint LEFT JOINs cards on scan_result_id.
export interface ShowDecisionTimelineEntry {
  scan_result_id: string;
  player: string | null;
  decision: ScanDecision;
  ask_price_usd: number | null;
  final_price_usd: number | null;
  comp_at_decision_usd: number | null;
  // Computed at read time from comp + final: (comp - final) / comp × 100
  pct_off_comp: number | null;
  created_at: string;
  card_id: string | null;
}

// Row shape for the scan_results table. Used by createCardFromScanResult
// and the decision endpoints. Does not exhaustively enumerate every
// telemetry column on the table — only the fields callers consume.
export interface ScanResult {
  id: string;
  session_id: string | null;
  user_id: string;
  game: Game;
  catalog_match_id: string | null;
  catalog_match_name: string | null;
  final_catalog_id: string | null;
  final_catalog_name: string | null;
  vision_output: unknown;
  user_decision: ScanDecision | null;
  decision_at: string | null;
  // Phase A + B-data fields for show-mode decisions
  ask_price_usd: number | null;
  negotiated_price_usd: number | null;
  final_price_usd: number | null;
  show_id: string | null;
  comp_at_decision_usd: number | null;
  created_at: string;
}
