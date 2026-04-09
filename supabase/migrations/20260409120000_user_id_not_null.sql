  -- Tighten user_id NOT NULL across all user-owned tables.
  -- Verified safe by direct SQL audit on production:
  --   SELECT COUNT(*) FROM cards WHERE user_id IS NULL;  -- 0
  --   SELECT COUNT(*) FROM boxes WHERE user_id IS NULL;  -- 0
  --   SELECT COUNT(*) FROM lots  WHERE user_id IS NULL;  -- 0
  -- All three columns can safely be tightened.

  ALTER TABLE public.cards ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE public.boxes ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE public.lots  ALTER COLUMN user_id SET NOT NULL;
