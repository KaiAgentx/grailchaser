-- Applied manually via Supabase SQL Editor on 2026-04-11.
-- Pokémon TCG API returns string IDs like "ecard2-H18", not UUIDs.
-- This file exists for repo history and future DB resets.
ALTER TABLE public.cards
  ALTER COLUMN catalog_card_id TYPE text USING catalog_card_id::text;
