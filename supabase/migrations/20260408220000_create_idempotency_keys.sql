CREATE TABLE public.idempotency_keys (
  user_id      uuid NOT NULL,
  key          text NOT NULL,
  route        text NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (user_id, key, route)
);

CREATE INDEX idempotency_keys_expires_at_idx
  ON public.idempotency_keys (expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own idempotency keys"
  ON public.idempotency_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
