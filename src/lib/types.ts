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
