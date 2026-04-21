-- Create scan_sessions table (retroactive migration — table was created
-- out-of-band in Supabase Studio. This reconciles the migration chain so
-- fresh environments can reproduce the schema.)

DO $$ BEGIN
  CREATE TYPE session_type_t AS ENUM (
    'quick_check',
    'collection_save',
    'batch_import'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game game_t NOT NULL,
  session_type session_type_t NOT NULL,
  is_offline boolean NOT NULL DEFAULT false,
  action_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY scan_sessions_user_scope ON public.scan_sessions
    FOR ALL
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
