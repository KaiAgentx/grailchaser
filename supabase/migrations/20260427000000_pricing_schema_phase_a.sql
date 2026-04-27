-- Phase A: Multi-source pricing schema
-- Will be applied to prod via Supabase MCP after review.

-- ===== Add multi-source pricing columns to cards =====

-- TCGPlayer (from Scrydex)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_market_usd numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_low_usd     numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_mid_usd     numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_high_usd    numeric(10,2);
-- avg7/avg30 left NULL in Phase A. Populated when Scrydex direct integration lands.
-- The current Pokemon TCG API upstream surfaces only CardMarket (EUR) avgs, not TCGPlayer USD.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_avg7_usd    numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_avg30_usd   numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_listings_count integer;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcgplayer_sellers_count  integer;

-- eBay raw + graded (from PPT)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS ebay_raw_avg_usd numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa10_avg_usd    numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa9_avg_usd     numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa8_avg_usd     numeric(10,2);

-- Population (only from PPT Business tier — leave nullable for now)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa10_pop integer;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa9_pop  integer;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS psa8_pop  integer;

-- Trend & volatility
ALTER TABLE cards ADD COLUMN IF NOT EXISTS trend_30d_direction text
  CHECK (trend_30d_direction IS NULL OR trend_30d_direction IN ('up','down','flat'));
ALTER TABLE cards ADD COLUMN IF NOT EXISTS trend_30d_pct numeric(6,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS volatility_30d numeric(6,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS avg_sale_30d_usd numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS time_to_sell_days integer;

-- Source attribution + freshness
ALTER TABLE cards ADD COLUMN IF NOT EXISTS price_source text;
  -- which source drove raw_value: 'tcgplayer'|'ebay'|'mixed'
ALTER TABLE cards ADD COLUMN IF NOT EXISTS price_data_updated_at timestamptz;

-- Grade-check state (for Card Detail "last assessed")
ALTER TABLE cards ADD COLUMN IF NOT EXISTS last_grade_check_at timestamptz;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS last_psa10_probability numeric(5,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS last_assessed_condition text;

-- Watchlist alert thresholds (per-card)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS price_alert_threshold_usd numeric(10,2);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS price_alert_direction text
  CHECK (price_alert_direction IS NULL OR price_alert_direction IN ('above','below'));

-- ===== Price history table =====
-- Shared across all users — keyed by catalog ID, not user's card row,
-- so multiple users with the same Pikachu ex pull the same history.
CREATE TABLE IF NOT EXISTS card_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_card_id text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  price_type text NOT NULL
    CHECK (price_type IN ('tcg_market','tcg_low','tcg_mid','tcg_high',
                          'ebay_raw','psa10','psa9','psa8')),
  value_usd numeric(10,2),
  source text NOT NULL
    CHECK (source IN ('tcgplayer','ebay','ppt','scrydex','cardmarket'))
);

CREATE INDEX IF NOT EXISTS idx_price_history_card_type_date
  ON card_price_history (catalog_card_id, price_type, captured_at DESC);

-- ===== Helper: latest price per type for a catalog card =====
-- (View used by frontend for sparkline + recent-price queries)
CREATE OR REPLACE VIEW card_price_latest AS
SELECT DISTINCT ON (catalog_card_id, price_type)
  catalog_card_id,
  price_type,
  value_usd,
  captured_at,
  source
FROM card_price_history
ORDER BY catalog_card_id, price_type, captured_at DESC;

-- ===== Shows table (for Show Mode) =====
CREATE TABLE IF NOT EXISTS shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shows_user_active
  ON shows (user_id, started_at DESC) WHERE ended_at IS NULL;

ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shows_owner_select" ON shows FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "shows_owner_insert" ON shows FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "shows_owner_update" ON shows FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "shows_owner_delete" ON shows FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ===== Extend scan_results for show-mode decision tracking =====
ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS ask_price_usd numeric(10,2);
ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS show_id uuid REFERENCES shows(id) ON DELETE SET NULL;
ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS comp_at_decision_usd numeric(10,2);
-- existing user_decision column already covers walked/purchased/etc.
-- new: negotiated_price for tracking back-and-forth
ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS negotiated_price_usd numeric(10,2);
