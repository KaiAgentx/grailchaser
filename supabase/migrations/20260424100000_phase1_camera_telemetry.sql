-- Phase 1 camera: capture method telemetry on scan_results.
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS capture_method TEXT,
  ADD COLUMN IF NOT EXISTS zoom_supported BOOLEAN,
  ADD COLUMN IF NOT EXISTS torch_supported BOOLEAN,
  ADD COLUMN IF NOT EXISTS probe_result TEXT;
