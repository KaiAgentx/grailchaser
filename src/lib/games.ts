import type { Game } from './types';

/**
 * Game discriminator helpers — TCG-only.
 *
 * The `cards` table is a single table holding TCG cards (sports support was
 * removed in Session X). The `game` column (game_t enum: 'pokemon' | 'mtg'
 * | 'one_piece') discriminates between TCG games for set/catalog scoping.
 *
 * Several `cards` columns are still NOT NULL with sports-shaped semantics
 * (sport, player, brand, year). TCG saves synthesize values to satisfy the
 * schema until Phase 1 makes them nullable:
 *   - sport   → GAME_TO_SPORT[game]        (e.g., "Pokemon")
 *   - player  → card name                  (e.g., "Charizard")
 *   - brand   → GAME_TO_PUBLISHER[game]    (e.g., "Pokémon TCG")
 *   - year    → catalog_cards.release_date (actual release year)
 */

// All TCG games. (Was: TCG-only subset; sports removed in Session X.)
export const TCG_GAMES: readonly Game[] = ['pokemon', 'mtg', 'one_piece'] as const;

// Same list as plain strings — for `.includes()` checks on untyped API body values.
export const TCG_GAME_VALUES: readonly string[] = TCG_GAMES;

// Backward-compatibility alias. Game IS TcgGame post-amputation.
export type TcgGame = Game;

// Display names for the UI.
export const GAME_DISPLAY_NAME: Record<Game, string> = {
  pokemon: 'Pokémon',
  mtg: 'Magic: The Gathering',
  one_piece: 'One Piece',
};

// Default box names for first-time saves. One default box per game.
export const DEFAULT_BOX_NAME: Record<Game, string> = {
  pokemon: 'Pokémon Unsorted',
  mtg: 'MTG Unsorted',
  one_piece: 'One Piece Unsorted',
};

// Publisher per TCG game. Used as the synthetic `brand` value for saves.
export const GAME_TO_PUBLISHER: Record<Game, string> = {
  pokemon:   'Pokémon TCG',
  mtg:       'Wizards of the Coast',
  one_piece: 'Bandai',
};
