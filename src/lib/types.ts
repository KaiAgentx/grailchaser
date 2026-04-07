export type Sport = "Baseball" | "Football" | "Basketball" | "Hockey" | "Soccer";
export type Tier = "Gem" | "Star" | "Core" | "Bulk";
export type CardStatus = "raw" | "listed" | "sold" | "shipped" | "grading" | "graded";
export type Condition = "Mint" | "NM" | "EX" | "VG" | "Good" | "Fair" | "Poor";

export interface Card {
  id: string;
  user_id: string;
  player: string;
  sport: Sport;
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
export type Game = "sports" | "pokemon" | "mtg" | "one_piece";

// Which "world" the user is currently browsing. Derived from Game in code,
// never stored on rows. (sports → sports, pokemon/mtg/one_piece → tcg)
export type Mode = "sports" | "tcg";

// Standard TCG condition grades. Different from sports `Condition`.
export type TcgCondition = "NM" | "LP" | "MP" | "HP" | "DMG";

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
export type PriceSource =
  | "pokemon_tcg_api"
  | "scryfall"
  | "one_piece_provider"
  | "ebay"
  | "manual";

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
