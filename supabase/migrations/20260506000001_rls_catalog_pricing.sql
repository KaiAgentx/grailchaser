-- RLS hardening for public catalog/pricing data.
-- Closes 3 Supabase Security Advisor errors (rls_disabled_in_public x2 + security_definer_view).
-- Pattern: anon/authenticated SELECT, only service_role can write (RLS bypass via service role).
-- Applied to prod 2026-05-06 via Chrome MCP; this migration is the repo mirror.
-- Idempotent.

BEGIN;

ALTER TABLE public.catalog_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_sets_public_read" ON public.catalog_sets;
CREATE POLICY "catalog_sets_public_read"
  ON public.catalog_sets FOR SELECT
  TO public USING (true);

ALTER TABLE public.card_price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_price_history_public_read" ON public.card_price_history;
CREATE POLICY "card_price_history_public_read"
  ON public.card_price_history FOR SELECT
  TO public USING (true);

ALTER VIEW public.card_price_latest SET (security_invoker = true);

COMMIT;
