-- Backfill: set mode='tcg' on boxes that contain TCG cards.
-- Applied manually via Supabase SQL Editor.
-- Safe to re-run (idempotent — sets mode on boxes that already have TCG cards).
UPDATE public.boxes SET mode = 'tcg'
WHERE name IN (
  SELECT DISTINCT storage_box FROM public.cards
  WHERE game IN ('pokemon', 'mtg', 'one_piece')
  AND storage_box IS NOT NULL AND storage_box <> 'PENDING'
);
