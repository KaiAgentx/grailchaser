import type { Game, Mode } from './types';

/**
 * TCG/Sports Game Discriminator
 *
 * The `cards` table is a single table holding both sports cards and TCG
 * cards. The `game` column (game_t enum: 'sports' | 'pokemon' | 'mtg' |
 * 'one_piece') is the canonical discriminator.
 *
 * Because `cards` has sports-first NOT NULL columns (sport, player, brand,
 * year), TCG saves currently synthesize values to satisfy the schema:
 *   - sport   → GAME_TO_SPORT[game]        (e.g., "Pokemon")
 *   - player  → card name                  (e.g., "Charizard")
 *   - brand   → GAME_TO_PUBLISHER[game]    (e.g., "Pokémon TCG")
 *   - year    → catalog_cards.release_date (actual release year)
 *
 * This synthesis is a Phase 0 expedient.
 *
 * TODO(Phase 1): Make sport and player nullable, drop the synthesis, and
 * null-guard the 5 read sites that assume non-null values:
 *   1. LotBuilder.tsx generateTitle()
 *   2. Dashboard.tsx recent-grading list
 *   3. page.tsx sport pill filter (~line 177)
 *   4. useCards.ts isDuplicate() (year/brand comparison)
 *   5. useCards.ts addCards() batch path
 */

// =====================================================================
// Game and Mode helpers
//
// `game` is stored on database rows. `mode` is derived from game in code
// only — we never save mode to the database. This file is the single
// source of truth for that conversion.
// =====================================================================

// All TCG games. Sports is intentionally excluded.
export const TCG_GAMES: readonly Game[] = ['pokemon', 'mtg', 'one_piece'] as const;

// A game that lives in the TCG ecosystem (excludes 'sports').
export type TcgGame = Exclude<Game, 'sports'>;

// Same list as plain strings — for `.includes()` checks on untyped API body values.
export const TCG_GAME_VALUES: readonly string[] = TCG_GAMES;

// Every supported game, sports first.
export const ALL_GAMES: readonly Game[] = ['sports', 'pokemon', 'mtg', 'one_piece'] as const;

// The mapping that tells us which "world" a game belongs to.
export const GAME_TO_MODE: Record<Game, Mode> = {
  sports: 'sports',
  pokemon: 'tcg',
  mtg: 'tcg',
  one_piece: 'tcg',
};

// Convert a game to its mode. Use this anywhere you need to know
// "is this a TCG card or a sports card?" without hardcoding the answer.
export function gameToMode(game: Game): Mode {
  return GAME_TO_MODE[game];
}

// Convenience check — is this a TCG game?
export function isTcgGame(game: Game): boolean {
  return GAME_TO_MODE[game] === 'tcg';
}

// Display names for the UI. Pokémon uses the proper accent character.
export const GAME_DISPLAY_NAME: Record<Game, string> = {
  sports: 'Sports Cards',
  pokemon: 'Pokémon',
  mtg: 'Magic: The Gathering',
  one_piece: 'One Piece',
};

// Default box names for first-time saves. Used by the default-box helper
// (coming in a later step). One default box per (user, game).
export const DEFAULT_BOX_NAME: Record<Game, string> = {
  sports: 'Default',
  pokemon: 'Pokémon Unsorted',
  mtg: 'MTG Unsorted',
  one_piece: 'One Piece Unsorted',
};

// Publisher per TCG game. Used as the synthetic `brand` value for TCG saves
// (Phase 0 synthesis — see file header). Phase 1 will null out brand for
// TCG cards and remove the synthesis.
export const GAME_TO_PUBLISHER: Record<TcgGame, string> = {
  pokemon:   'Pokémon TCG',
  mtg:       'Wizards of the Coast',
  one_piece: 'Bandai',
};