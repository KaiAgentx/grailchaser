-- Prevent duplicate box names per user (belt & suspenders against race conditions).
CREATE UNIQUE INDEX IF NOT EXISTS boxes_unique_user_name
  ON public.boxes (user_id, name);
