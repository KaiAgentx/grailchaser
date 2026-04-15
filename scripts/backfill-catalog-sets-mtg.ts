// STUB: MTG catalog_sets backfill via Scryfall API.
// Implement when MTG support ships.
//
// Source: https://api.scryfall.com/sets
// Returns array of MTG sets, each with these relevant fields:
//   - code:          3-letter set code (e.g., "aer")
//   - mtgo_code:     MTGO-specific code (alias candidate)
//   - arena_code:    Arena-specific code (alias candidate)
//   - name:          "Aether Revolt"
//   - block:         "Kaladesh" — maps to series field
//   - block_code:    "kld"
//   - printed_size:  184 — maps to our printed_total (NULLABLE for some sets)
//   - card_count:    194 — maps to our total
//   - released_at:   "2017-01-20"
//   - icon_svg_uri:  set symbol URL
//   - set_type:      "expansion" | "core" | "masters" | etc.
//   - digital:       boolean (skip if true unless we want digital cards)
//   - nonfoil_only / foil_only: print quirks
//
// Mapping per set:
//   game: 'mtg'
//   set_id: set.code
//   code: set.code (uppercase for printing match)
//   code_aliases: dedupe([set.code, set.mtgo_code, set.arena_code].filter(Boolean))
//   numbering_format: depends on set release date — use 'four_digit' if released_at >= '2023-04-21' (March of the Machine), else 'fraction'
//   rarity_location: 'bottom_left'
//   notes: include 'set_type' for filtering decisions
//
// Rate limit: Scryfall asks for ~10 req/s max — stagger requests if needed

console.log("MTG backfill not yet implemented");
process.exit(1);
