"use client";
import { useState, useEffect, useCallback } from "react";
import type { Game } from "@/lib/types";

// Key bumped to v2 in Session X to discard sports-era localStorage state
// (previous keys: grailchaser:activeGame, grailchaser:modeStreak,
// grailchaser:lastTcgGame). Old keys are not migrated — they linger as
// dead data in the browser but no code reads them anymore.
const GAME_KEY = "grailchaser:activeGame:v2";

/**
 * Tracks which TCG game (pokemon/mtg/one_piece) is active. Defaults to
 * 'pokemon' after hydration. Sports support was removed in Session X.
 */
export function useActiveGame() {
  const [activeGame, setActiveGameState] = useState<Game>("pokemon");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(GAME_KEY);
    if (stored && (["pokemon", "mtg", "one_piece"] as const).includes(stored as Game)) {
      setActiveGameState(stored as Game);
    }
    setHydrated(true);
  }, []);

  const setActiveGame = useCallback((game: Game) => {
    setActiveGameState(game);
    localStorage.setItem(GAME_KEY, game);
  }, []);

  return { activeGame, setActiveGame, hydrated };
}
