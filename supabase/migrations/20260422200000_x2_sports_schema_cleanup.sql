-- Session X2 — sports schema cleanup.
-- Drops sports-only columns from cards, drops the lots table and four
-- empty out-of-band sports-era tables, drops the cards.game default,
-- and removes the 'sports' value from the game_t enum.
--
-- Prerequisite: Session X1 amputation already deployed and verified in
-- production. Pre-check confirmed:
--   - 0 rows with game='sports' across all tables
--   - 0 rows in batch_imports, check_history, price_cache, watchlist_items
--   - 12 columns reference game_t (discovered via information_schema)
--
-- Order of operations:
--   1. Drop the lots table (CASCADE releases the cards.lot_id FK).
--   2. Drop four empty out-of-band sports-era tables (CASCADE for safety).
--   3. Drop the cards.game DEFAULT 'sports' so step 5 can re-type the
--      column without trying to cast 'sports'::game_t into the new enum
--      that lacks 'sports'. App always supplies game on insert; no need
--      to re-add a default.
--   4. Drop sports-only columns from cards (each with IF EXISTS CASCADE).
--      cards.sold is intentionally KEPT — page.tsx filters
--      cards.filter(c => !c.sold) at runtime.
--   5. Rebuild the game_t enum without 'sports' via dynamic discovery
--      so every remaining referencing column is altered, not just the
--      ones we know about today.
--
-- Rollback: Session X1 was tagged `pre-sports-removal`; rolling that back
-- in the application does NOT restore dropped columns or dropped tables.
-- A fresh schema rollback would require restoring the database from a
-- backup taken before this migration applied.

BEGIN;

-- ─── 1. Drop lots table ───
-- Pre-check confirmed zero TCG usage. CASCADE removes the cards.lot_id
-- FK constraint (the column itself is dropped in step 4).
DROP TABLE IF EXISTS public.lots CASCADE;

-- ─── 2. Drop empty out-of-band sports-era tables ───
-- All four confirmed 0 rows in pre-check; all are sports-era artifacts
-- the app no longer references after Session X1.
DROP TABLE IF EXISTS public.batch_imports CASCADE;
DROP TABLE IF EXISTS public.check_history CASCADE;
DROP TABLE IF EXISTS public.price_cache CASCADE;
DROP TABLE IF EXISTS public.watchlist_items CASCADE;

-- ─── 3. Drop cards.game DEFAULT ───
-- Default value is 'sports'::game_t, which would block the enum recreation
-- in step 5 because the cast 'sports'::game_t_new is invalid (the new enum
-- has no 'sports' value). App always specifies game on insert — no default
-- is re-added.
ALTER TABLE public.cards ALTER COLUMN game DROP DEFAULT;

-- ─── 4. Drop sports-only columns from cards ───
-- 37 columns total: sports identity, grading lifecycle, lot reference,
-- and all listing/sale platform fields. cards.sold is KEPT (UI filter
-- dependency in page.tsx). Per Session X scope decision, TCG selling
-- infrastructure (when built) will be redesigned around PokemonPriceTracker
-- + eBay Browse API with a clean schema, so the legacy listing columns
-- are dropped wholesale.
ALTER TABLE public.cards
  DROP COLUMN IF EXISTS sport CASCADE,
  DROP COLUMN IF EXISTS team CASCADE,
  DROP COLUMN IF EXISTS is_rc CASCADE,
  DROP COLUMN IF EXISTS gem_probability CASCADE,
  DROP COLUMN IF EXISTS graded_values CASCADE,
  DROP COLUMN IF EXISTS grade_candidate CASCADE,
  DROP COLUMN IF EXISTS grading_company CASCADE,
  DROP COLUMN IF EXISTS grading_submit_date CASCADE,
  DROP COLUMN IF EXISTS grading_return_date CASCADE,
  DROP COLUMN IF EXISTS graded_grade CASCADE,
  DROP COLUMN IF EXISTS grading_cost CASCADE,
  DROP COLUMN IF EXISTS grading_cert CASCADE,
  DROP COLUMN IF EXISTS lot_id CASCADE,
  DROP COLUMN IF EXISTS ebay_listing_id CASCADE,
  DROP COLUMN IF EXISTS ebay_offer_id CASCADE,
  DROP COLUMN IF EXISTS ebay_sku CASCADE,
  DROP COLUMN IF EXISTS ebay_url CASCADE,
  DROP COLUMN IF EXISTS ebay_price CASCADE,
  DROP COLUMN IF EXISTS ebay_listed_date CASCADE,
  DROP COLUMN IF EXISTS shopify_product_id CASCADE,
  DROP COLUMN IF EXISTS shopify_variant_id CASCADE,
  DROP COLUMN IF EXISTS shopify_url CASCADE,
  DROP COLUMN IF EXISTS shopify_price CASCADE,
  DROP COLUMN IF EXISTS shopify_listed_date CASCADE,
  DROP COLUMN IF EXISTS whatnot_listing_id CASCADE,
  DROP COLUMN IF EXISTS whatnot_url CASCADE,
  DROP COLUMN IF EXISTS mercari_listed CASCADE,
  DROP COLUMN IF EXISTS mercari_url CASCADE,
  DROP COLUMN IF EXISTS facebook_listed CASCADE,
  DROP COLUMN IF EXISTS listed_platform CASCADE,
  DROP COLUMN IF EXISTS listed_price CASCADE,
  DROP COLUMN IF EXISTS listed_date CASCADE,
  DROP COLUMN IF EXISTS sold_price CASCADE,
  DROP COLUMN IF EXISTS sold_date CASCADE,
  DROP COLUMN IF EXISTS sold_platform CASCADE,
  DROP COLUMN IF EXISTS shipped_date CASCADE,
  DROP COLUMN IF EXISTS tracking_number CASCADE;

-- ─── 5. Rebuild game_t enum without 'sports' ───
-- Postgres does not support removing a value from an enum in place; the
-- standard idiom is create-new / alter-columns / drop-old / rename-new.
-- Per X1 addendum: discover columns dynamically via information_schema
-- so this works even if more tables reference game_t than we explicitly
-- listed. After steps 1-2, the remaining game_t columns are:
--   cards.game, catalog_cards.game, catalog_metadata.game,
--   catalog_sets.game, scan_corrections.game, scan_results.game,
--   scan_sessions.game (7 columns).

-- 5a. Create the new enum without 'sports'.
CREATE TYPE game_t_new AS ENUM ('pokemon', 'mtg', 'one_piece');

-- 5b. ALTER every column currently typed as game_t to use game_t_new.
--     Cast through ::text::game_t_new which only succeeds when the column
--     contains values that exist in the new enum. Since pre-check verified
--     zero rows have game='sports' anywhere, every cast will succeed.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE udt_name = 'game_t'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
  LOOP
    RAISE NOTICE 'Altering %.%.% from game_t to game_t_new',
      r.table_schema, r.table_name, r.column_name;
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE game_t_new USING %I::text::game_t_new',
      r.table_schema, r.table_name, r.column_name, r.column_name
    );
  END LOOP;
END
$$;

-- 5c. Drop the old enum (now unreferenced).
DROP TYPE game_t;

-- 5d. Rename the new enum into the canonical name.
ALTER TYPE game_t_new RENAME TO game_t;

COMMIT;
