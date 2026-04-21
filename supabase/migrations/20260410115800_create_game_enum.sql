-- Create game_t enum (retroactive migration — type was created out-of-band
-- in Supabase Studio. This reconciles the migration chain so fresh
-- environments can reproduce the schema. Referenced by 20260410120000
-- (scan_results) and 20260415100000 (catalog_sets).)

DO $$ BEGIN
  CREATE TYPE game_t AS ENUM ('sports', 'pokemon', 'mtg', 'one_piece');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
