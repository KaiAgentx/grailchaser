// STUB: One Piece catalog_sets backfill via OPTCGapi or apitcg.com.
// Implement when One Piece support ships.
//
// Source candidates (in order of preference):
//   1. https://optcgapi.com — free, English-focused, OP-01 through OP-15+
//      Caveat: hosted on personal VPS, do NOT make excessive calls
//      Cache results aggressively, refresh weekly max
//   2. https://apitcg.com — broader TCG coverage
//   3. JustTCG (paid) for production reliability
//
// Mapping per set:
//   game: 'one_piece'
//   set_id: set.id (e.g., "OP04")
//   code: set.id
//   code_aliases: include both dashed and undashed forms — ["OP04", "OP-04"]
//   numbering_format: 'set_prefixed'  (One Piece uses "OP04-119" combined IDs)
//   rarity_location: 'bottom_right'  (different from Pokémon/MTG!)
//   printed_total: NULLABLE — One Piece doesn't print N/TOTAL on cards
//   notes: include set type ("booster" | "starter_deck" | "extra_booster" | "premium")
//
// Special cases:
//   - Starter decks have ST## prefix
//   - Extra boosters have EB## prefix
//   - Premium boosters have PRB-## prefix
//   - Alt art cards share collector_number with regular — distinguished by star ✶ above rarity

console.log("One Piece backfill not yet implemented");
process.exit(1);
