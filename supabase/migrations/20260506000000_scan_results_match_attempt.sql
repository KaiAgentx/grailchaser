-- Track which catalog-lookup attempt (0-7) populated cards in the recognize
-- endpoint. Lets us measure how often each fallback fires and correlate
-- attempt-7 fuzzy hits with later corrections (the "wrong holo" failure mode).
-- Idempotent — safe to re-run.

ALTER TABLE public.scan_results
  ADD COLUMN IF NOT EXISTS match_attempt smallint;

COMMENT ON COLUMN public.scan_results.match_attempt IS 'Which lookup attempt populated cards: 0=name+printed_total, 1=set+name+number, 2=set+name, 3=name+number_exact, 4=name+number_prefix, 5=name+number_padded, 6=name+number_tolerant_±2, 7=name_only_fuzzy. NULL when matched via hash-only path.';
