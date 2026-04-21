-- Fix insert_collection_item RPC: explicitly set created_at in the jsonb
-- so jsonb_populate_record does not emit NULL and override the column
-- DEFAULT during INSERT. Safe re-create via CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.insert_collection_item(
  p_user_id    uuid,
  p_storage_box text,
  p_card_data  jsonb
)
RETURNS public.cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_position integer;
  v_row public.cards;
  v_lock_key bigint;
  v_box text;
  v_full_data jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required' USING ERRCODE = '22023';
  END IF;

  v_box := COALESCE(NULLIF(p_storage_box, ''), 'PENDING');

  v_lock_key := hashtextextended(p_user_id::text || '|' || v_box, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(storage_position), 0) + 1
    INTO v_next_position
    FROM public.cards
   WHERE user_id = p_user_id
     AND storage_box = v_box;

  v_full_data := jsonb_build_object(
    'id',             gen_random_uuid(),
    'language',       'en',
    'quantity',       1,
    'review_state',   'none',
    'decision_state', 'none',
    'price_currency', 'USD',
    'metadata',       '{}'::jsonb,
    'game',           'sports',
    'created_at',     now()
  ) || p_card_data || jsonb_build_object(
    'user_id',          p_user_id,
    'storage_box',      v_box,
    'storage_position', v_next_position
  );

  INSERT INTO public.cards
  SELECT * FROM jsonb_populate_record(NULL::public.cards, v_full_data)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_collection_item(uuid, text, jsonb) TO authenticated;
