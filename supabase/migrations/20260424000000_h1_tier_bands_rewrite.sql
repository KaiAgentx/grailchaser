-- H1: Rewrite tier bands from Gem/Star/Core/Bulk to High/Mid/Low/Bulk/Unpriced.
-- Single transaction. Order matters: drop constraint → backfill → add constraint.

BEGIN;

-- 1. Drop old check constraint
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_tier_check;

-- 2. Update default
ALTER TABLE cards ALTER COLUMN tier SET DEFAULT 'Bulk';

-- 3. Backfill existing rows
UPDATE cards
SET tier = CASE
  WHEN raw_value IS NULL THEN 'Unpriced'
  WHEN raw_value < 1 THEN 'Bulk'
  WHEN raw_value < 5 THEN 'Low'
  WHEN raw_value < 50 THEN 'Mid'
  ELSE 'High'
END;

-- 4. Add new check constraint
ALTER TABLE cards ADD CONSTRAINT cards_tier_check
  CHECK (tier IN ('Unpriced','Bulk','Low','Mid','High'));

-- 5. New columns for H3/H5
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS last_price_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_watched boolean NOT NULL DEFAULT false;

-- 6. Verification
DO $$
BEGIN
  -- (a) Constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'cards' AND constraint_name = 'cards_tier_check'
  ) THEN
    RAISE EXCEPTION 'cards_tier_check constraint not found after migration';
  END IF;

  -- (b) No rows violate new constraint
  IF EXISTS (
    SELECT 1 FROM cards WHERE tier NOT IN ('Unpriced','Bulk','Low','Mid','High')
  ) THEN
    RAISE EXCEPTION 'Found rows with tier values outside new constraint';
  END IF;

  -- (c) New columns present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cards' AND column_name = 'last_price_check_at'
  ) THEN
    RAISE EXCEPTION 'last_price_check_at column not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cards' AND column_name = 'is_watched'
  ) THEN
    RAISE EXCEPTION 'is_watched column not found';
  END IF;

  RAISE NOTICE 'H1 migration verification passed';
END $$;

COMMIT;
