BEGIN;

CREATE TABLE IF NOT EXISTS scan_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_result_id UUID REFERENCES scan_results(id) ON DELETE SET NULL,
  game game_t NOT NULL,
  vision_output JSONB,
  candidates JSONB,
  top_candidate_catalog_card_id TEXT,
  verifier_scores JSONB,
  user_selected_catalog_card_id TEXT,
  user_action TEXT NOT NULL CHECK (
    user_action IN ('confirmed_top', 'picked_alternate', 'manual_search', 'rejected_all')
  ),
  image_hash TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_version TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_scan_corrections_user_recent ON scan_corrections(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_corrections_action ON scan_corrections(user_action);

ALTER TABLE scan_corrections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scan_corrections' AND policyname = 'scan_corrections_select_own') THEN
    CREATE POLICY scan_corrections_select_own ON scan_corrections FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scan_corrections' AND policyname = 'scan_corrections_insert_own') THEN
    CREATE POLICY scan_corrections_insert_own ON scan_corrections FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

COMMIT;
