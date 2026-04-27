"use client";
import type { Game } from "@/lib/types";
import { GAME_DISPLAY_NAME } from "@/lib/games";

/**
 * GameBadge — colored pill identifying which TCG a card belongs to.
 *
 * Color mapping (Phase B placeholders for MTG/OP — final mapping
 * locks in when those games' screens ship post-beta):
 *   pokemon   → brand.gold.500
 *   mtg       → zone.hub.500     (purple)
 *   one_piece → zone.secondary.500 (pink)
 */

const GAME_COLOR: Record<Game, string> = {
  pokemon: "var(--gc-brand-gold-500)",
  mtg: "var(--gc-zone-hub-500)",
  one_piece: "var(--gc-zone-secondary-500)",
};

interface Props {
  game: Game;
  size?: "sm" | "md";
}

export function GameBadge({ game, size = "md" }: Props) {
  const color = GAME_COLOR[game];
  const label = GAME_DISPLAY_NAME[game];
  const fontSize = size === "sm" ? 10 : 11;
  const padding = size === "sm" ? "2px 8px" : "3px 10px";

  return (
    <span
      className="font-gc-ui"
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: "var(--gc-radius-pill)",
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        color,
        letterSpacing: 0.3,
      }}
    >
      {label}
    </span>
  );
}
