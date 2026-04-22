BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tcg_condition_t') THEN
    CREATE TYPE tcg_condition_t AS ENUM (
      'near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged'
    );
  END IF;
END
$$;

ALTER TABLE cards ADD COLUMN IF NOT EXISTS tcg_condition tcg_condition_t;

COMMIT;
