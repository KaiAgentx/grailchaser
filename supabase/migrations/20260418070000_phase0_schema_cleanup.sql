-- Phase 0 schema cleanup: drop dead column + drop sport CHECK constraint.

-- Drop dead boxes.game column.
-- boxes.game was added as a discriminator but application uses boxes.mode
-- exclusively. Confirmed by codebase grep: zero references to boxes.game
-- in src/. Removing to prevent silent drift between game and mode columns.
ALTER TABLE public.boxes DROP COLUMN IF EXISTS game;

-- Drop cards_sport_check constraint.
-- sport column is sports-only semantics; TCG games are discriminated via
-- the game column, which is now the source of truth. This CHECK was adding
-- maintenance burden (every new TCG game required an ALTER) without
-- providing integrity value (wrong for TCG rows where sport is synthetic).
-- Phase 1 will make sport nullable; this constraint would conflict.
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_sport_check;
