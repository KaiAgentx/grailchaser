-- WIN #3: Scan telemetry — golden signals for recognition quality.
-- Adds image dimensions, vision timing, model tracking, and verifier metrics.
ALTER TABLE public.scan_results
  ADD COLUMN image_pre_w       integer,
  ADD COLUMN image_pre_h       integer,
  ADD COLUMN image_post_w      integer,
  ADD COLUMN image_post_h      integer,
  ADD COLUMN image_tokens_est  integer,
  ADD COLUMN model_name        text,
  ADD COLUMN vision_ms         integer,
  ADD COLUMN verifier_used     boolean NOT NULL DEFAULT false,
  ADD COLUMN verifier_reranked boolean NOT NULL DEFAULT false,
  ADD COLUMN verifier_top_dist real,
  ADD COLUMN verifier_gap      real,
  ADD COLUMN verifier_ms       integer;
