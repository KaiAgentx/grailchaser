BEGIN;

-- Delete any cards owned by Chris (should be only the Maractus test card)
DELETE FROM cards WHERE user_id = 'bfb09c9f-474b-4c5e-8daf-06d21b2638c8';

-- Delete any related scan_results (just to keep telemetry clean)
DELETE FROM scan_results WHERE user_id = 'bfb09c9f-474b-4c5e-8daf-06d21b2638c8';

-- Delete Chris's boxes so we start fresh (they'll be recreated by the default-box logic on next save)
DELETE FROM boxes WHERE user_id = 'bfb09c9f-474b-4c5e-8daf-06d21b2638c8';

COMMIT;
