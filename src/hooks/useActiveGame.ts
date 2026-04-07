"use client";
import { useState, useEffect, useCallback } from "react";
import type { Game, Mode } from "@/lib/types";
import { gameToMode, isTcgGame } from "@/lib/games";

const GAME_KEY = "grailchaser:activeGame";
const STREAK_KEY = "grailchaser:modeStreak";

interface ModeStreak {
  mode: Mode;
  count: number;
}

export function useActiveGame() {
  const [activeGame, setActiveGameState] = useState<Game | null>(null);
  const [modeStreak, setModeStreakState] = useState<ModeStreak>({ mode: "sports", count: 0 });
  const [lastTcgGameState, setLastTcgGameState] = useState<Game>("pokemon");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    const stored = localStorage.getItem(GAME_KEY);
    if (stored && ["sports", "pokemon", "mtg", "one_piece"].includes(stored)) {
      setActiveGameState(stored as Game);
    } else {
      setActiveGameState("sports");
    }

    const streakStr = localStorage.getItem(STREAK_KEY);
    if (streakStr) {
      try {
        const parsed = JSON.parse(streakStr);
        if (parsed.mode && typeof parsed.count === "number") {
          setModeStreakState(parsed);
        }
      } catch {}
    }

    const lastTcg = localStorage.getItem("grailchaser:lastTcgGame");
    if (lastTcg && ["pokemon", "mtg", "one_piece"].includes(lastTcg)) {
      setLastTcgGameState(lastTcg as Game);
    }

    setHydrated(true);
  }, []);

  const setActiveGame = useCallback((game: Game) => {
    setActiveGameState(game);
    localStorage.setItem(GAME_KEY, game);
    // Also persist last-used TCG game separately so returning to TCG remembers it
    if (isTcgGame(game)) {
      localStorage.setItem("grailchaser:lastTcgGame", game);
      setLastTcgGameState(game);
    }
  }, []);

  const recordModeSelection = useCallback((mode: Mode) => {
    setModeStreakState(prev => {
      const next = prev.mode === mode ? { mode, count: prev.count + 1 } : { mode, count: 1 };
      localStorage.setItem(STREAK_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const mode: Mode = activeGame ? gameToMode(activeGame) : "sports";

  return {
    activeGame: activeGame || "sports",
    setActiveGame,
    mode,
    modeStreak,
    recordModeSelection,
    hydrated,
    lastTcgGame: lastTcgGameState,
  };
}
