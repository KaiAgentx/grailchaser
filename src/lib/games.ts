import type { Game, Mode } from './types';

// =====================================================================
// Game and Mode helpers
//
// `game` is stored on database rows. `mode` is derived from game in code
// only — we never save mode to the database. This file is the single
// source of truth for that conversion.
// =====================================================================

// All TCG games. Sports is intentionally excluded.
export const TCG_GAMES: readonly Game[] = ['pokemon', 'mtg', 'one_piece'] as const;

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
  pokemon: 'Default Pokémon',
  mtg: 'Default MTG',
  one_piece: 'Default One Piece',
};