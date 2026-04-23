-- Session G Phase 2 — scan decision + PPT comps fields on scan_results.
--
-- Extends scan_results so each scan can record what the user decided at a
-- dealer's table (skip / walked / purchased) plus the PPT graded-comps
-- snapshot shown on the verdict screen at decision time. All new columns
-- are nullable: a scan row still starts life as pure recognition telemetry
-- and only gets a decision + comps once the user interacts with the Tier 1
-- deal-flow UI (Phase G3).
--
-- trend30d is stored as text because PPT exposes only a direction string
-- ("up" | "down" | "stable" | null) — there is no numeric 30-day trend
-- field in the /cards response (verified in G1).

BEGIN;

-- ─── 1. scan_decision_t enum ───
-- Three terminal outcomes for a scan at a show:
--   skip       — user decided not to buy, no ask was entered / not worth pricing
--   walked     — user entered an ask but ultimately walked away
--   purchased  — user bought the card at `dealer_ask` (or a negotiated price)
CREATE TYPE scan_decision_t AS ENUM ('skip', 'purchased', 'walked');

-- ─── 2. Decision + PPT comp columns ───
-- All nullable. Historic scan_results rows remain valid with NULLs.
ALTER TABLE public.scan_results
  ADD COLUMN user_decision    scan_decision_t,
  ADD COLUMN dealer_ask       numeric(10,2),
  ADD COLUMN decision_at      timestamptz,
  ADD COLUMN ppt_raw_market   numeric(10,2),
  ADD COLUMN ppt_psa10_avg    numeric(10,2),
  ADD COLUMN ppt_psa9_avg     numeric(10,2),
  ADD COLUMN ppt_psa8_avg     numeric(10,2),
  ADD COLUMN ppt_trend30d     text;

COMMIT;

-- ─── DOWN MIGRATION (reference only, not executed) ───
-- BEGIN;
-- ALTER TABLE public.scan_results
--   DROP COLUMN IF EXISTS ppt_trend30d,
--   DROP COLUMN IF EXISTS ppt_psa8_avg,
--   DROP COLUMN IF EXISTS ppt_psa9_avg,
--   DROP COLUMN IF EXISTS ppt_psa10_avg,
--   DROP COLUMN IF EXISTS ppt_raw_market,
--   DROP COLUMN IF EXISTS decision_at,
--   DROP COLUMN IF EXISTS dealer_ask,
--   DROP COLUMN IF EXISTS user_decision;
-- DROP TYPE IF EXISTS scan_decision_t;
-- COMMIT;
