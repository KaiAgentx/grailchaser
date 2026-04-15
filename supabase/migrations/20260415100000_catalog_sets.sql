-- Drop the wrong set_total column from catalog_cards (incorrectly backfilled as row count)
DROP INDEX IF EXISTS idx_catalog_cards_set_total;
ALTER TABLE public.catalog_cards DROP COLUMN IF EXISTS set_total;

-- Create numbering_format enum (game-agnostic, describes how cards are numbered in this set)
CREATE TYPE numbering_format_t AS ENUM (
  'fraction',         -- "008/086" — Pokémon, legacy MTG
  'four_digit',       -- "0115" — modern MTG (post-March 2023)
  'set_prefixed',     -- "OP04-119" — One Piece
  'simple'            -- "115" — older MTG, special cases
);

-- Create rarity_location enum (where the rarity indicator sits on the card)
CREATE TYPE rarity_location_t AS ENUM ('bottom_left', 'bottom_right');

-- Universal catalog_sets table for Pokémon, MTG, One Piece, future games
CREATE TABLE public.catalog_sets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game                game_t NOT NULL,
  set_id              text NOT NULL,                         -- source-of-truth API ID
  code                text,                                  -- printed abbreviation on cards
  code_aliases        text[] DEFAULT '{}',                   -- ["BLK", "BLK EN", "OP-15", "OP15"]
  name                text NOT NULL,
  series              text,                                  -- "Scarlet & Violet", "Kaladesh", null
  printed_total       integer,                               -- nullable: not all games print this
  total               integer,                               -- nullable: catalog count incl. variants
  numbering_format    numbering_format_t,
  rarity_location     rarity_location_t,
  released_at         date,
  source              text NOT NULL,                         -- "pokemontcg" | "scryfall" | "optcgapi"
  source_uri          text,
  icon_url            text,
  notes               text,                                  -- human-readable quirks
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game, set_id)
);

CREATE INDEX idx_catalog_sets_game ON public.catalog_sets(game);
CREATE INDEX idx_catalog_sets_printed_total ON public.catalog_sets(game, printed_total);
CREATE INDEX idx_catalog_sets_code ON public.catalog_sets(game, code);
CREATE INDEX idx_catalog_sets_code_aliases ON public.catalog_sets USING GIN (code_aliases);

-- Add FK column on catalog_cards (nullable during transition)
ALTER TABLE public.catalog_cards
  ADD COLUMN set_uuid uuid REFERENCES public.catalog_sets(id);
CREATE INDEX idx_catalog_cards_set_uuid ON public.catalog_cards(set_uuid);

-- Add updated_at trigger for catalog_sets
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS catalog_sets_touch_updated_at ON public.catalog_sets;
CREATE TRIGGER catalog_sets_touch_updated_at
  BEFORE UPDATE ON public.catalog_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
