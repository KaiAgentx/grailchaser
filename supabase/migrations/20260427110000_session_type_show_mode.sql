-- Add 'show_mode' to session_type_t enum so Show Mode scans can be
-- distinguished in telemetry from quick_check / collection_save / batch_import.
-- Idempotent — safe to re-run.

DO $$ BEGIN
  ALTER TYPE session_type_t ADD VALUE IF NOT EXISTS 'show_mode';
END $$;
