  -- Expand cards_sport_check to allow TCG game values for the sport column.
  -- This is the sports-first schema overlay used by TCG saves while the
  -- old single-game cards table is in transition. A proper schema cleanup
  -- (separating sports-only fields from a generic cards table) is a future PR.
  --
  -- The original constraint only allowed the 5 traditional sports. This
  -- expansion adds Pokemon, Magic, and One Piece so the TCG save endpoint
  -- can satisfy the NOT NULL sport column with a TCG-appropriate value.
  --
  -- IF EXISTS on the DROP makes this migration safe to replay against any
  -- environment where the constraint may already have been modified.

  ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_sport_check;

  ALTER TABLE public.cards ADD CONSTRAINT cards_sport_check
    CHECK (sport = ANY (ARRAY[
      'Baseball'::text,
      'Football'::text,
      'Basketball'::text,
      'Hockey'::text,
      'Soccer'::text,
      'Pokemon'::text,
      'Magic'::text,
      'One Piece'::text
    ]));
