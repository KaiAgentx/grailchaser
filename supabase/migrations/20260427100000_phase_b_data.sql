-- Phase B-data: schema for show mode decision flow.
-- Will be applied to prod via Supabase MCP after review.

-- ===== Extend scan_decision_t enum =====
-- Add 'negotiated' for the new walked|negotiated|purchased vocabulary.
-- Note: 'skip' stays in the enum (Postgres can't drop enum values cleanly).
-- Existing 'skip' rows are migrated to 'walked' below; the API rejects
-- 'skip' going forward via 400 invalid_body.
DO $$
BEGIN
  ALTER TYPE scan_decision_t ADD VALUE IF NOT EXISTS 'negotiated';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate legacy 'skip' decisions to 'walked' (skip never had clear UX).
UPDATE scan_results
SET user_decision = 'walked'
WHERE user_decision = 'skip';

-- ===== final_price_usd on scan_results =====
-- Phase A extended scan_results with ask_price_usd / negotiated_price_usd /
-- show_id / comp_at_decision_usd, but final_price_usd (the close-of-deal
-- price stored when decision='purchased') was not added. The decision
-- endpoint and stats query both reference it. Adding here so Commit 3 of
-- Phase B-data can write to it.
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS final_price_usd numeric(10,2);

-- ===== cards.scan_result_id =====
-- Links a card row back to the scan_result that produced it.
-- Nullable: legacy cards (created before show mode) and manual imports
-- have no scan_result. ON DELETE SET NULL preserves the card row when
-- the scan_result is purged.
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS scan_result_id uuid
  REFERENCES scan_results(id) ON DELETE SET NULL;

-- Lookup index for the stats endpoint's LEFT JOIN cards ON c.scan_result_id = sr.id
CREATE INDEX IF NOT EXISTS idx_cards_scan_result_id
  ON cards(scan_result_id)
  WHERE scan_result_id IS NOT NULL;

-- DB-level idempotency: a single scan_result can produce at most one card
-- per user. createCardFromScanResult catches unique violation (Postgres
-- 23505) and returns the existing row, deduping double-tap "Buy" races.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cards_user_scan_result
  ON cards(user_id, scan_result_id)
  WHERE scan_result_id IS NOT NULL;
