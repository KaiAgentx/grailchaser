-- Phase 1: TCG/Sports separation — schema foundation.
-- Adds mode column to boxes and creates TCG-specific enum types.
-- No cards table changes, no FK additions, no UI/API changes.

-- A) Add mode column to boxes for TCG/sports separation.
--    Existing boxes default to 'sports'. TCG boxes will be created
--    with mode='tcg' by the app layer.
ALTER TABLE public.boxes
  ADD COLUMN mode text NOT NULL DEFAULT 'sports'
  CHECK (mode IN ('sports', 'tcg'));

-- B) TCG condition grades (distinct from the sports Condition type).
CREATE TYPE tcg_condition AS ENUM (
  'mint',
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged'
);

-- C) TCG parallel/variant types for print classification.
CREATE TYPE tcg_parallel AS ENUM (
  'normal',
  'holo',
  'reverse_holo',
  'first_edition',
  'shadowless',
  'promo',
  'full_art',
  'secret_rare',
  'rainbow_rare',
  'gold_rare'
);

-- ─── DOWN MIGRATION (reference only, not executed) ───
-- ALTER TABLE public.boxes DROP COLUMN mode;
-- DROP TYPE tcg_parallel;
-- DROP TYPE tcg_condition;
