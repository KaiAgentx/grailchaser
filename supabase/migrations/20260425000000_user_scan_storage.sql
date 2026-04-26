-- Mirror of applied changes for git history
-- Already applied to prod 4/25/26
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS user_scan_front_url TEXT,
  ADD COLUMN IF NOT EXISTS user_scan_back_url TEXT,
  ADD COLUMN IF NOT EXISTS user_scan_replaced_at TIMESTAMPTZ;

-- (bucket + policies + trigger applied via Supabase MCP, not in this file
-- because storage objects can't be created via plain SQL migration in
-- our setup. Documented here only.)
