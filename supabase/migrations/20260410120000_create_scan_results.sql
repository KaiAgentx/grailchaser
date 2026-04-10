  -- Per-scan telemetry table for recognition outcomes.
  CREATE TABLE public.scan_results (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
    user_id             uuid NOT NULL,
    game                game_t NOT NULL,
    method              text NOT NULL,
    vision_output       jsonb,
    vision_validated    boolean NOT NULL DEFAULT false,
    catalog_match_id    text,
    catalog_match_name  text,
    candidate_count     integer NOT NULL DEFAULT 0,
    confidence_band     text,
    top_distance        integer,
    latency_ms          integer NOT NULL,
    was_corrected       boolean NOT NULL DEFAULT false,
    final_catalog_id    text,
    final_catalog_name  text,
    created_at          timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX scan_results_user_created_idx
    ON public.scan_results (user_id, created_at DESC);

  CREATE INDEX scan_results_session_idx
    ON public.scan_results (session_id);

  ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

  CREATE POLICY scan_results_user_scope
    ON public.scan_results
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id);
