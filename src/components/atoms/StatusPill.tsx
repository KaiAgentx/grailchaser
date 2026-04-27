"use client";
import type { CardStatus } from "@/lib/types";

/**
 * StatusPill — visual cue for a card's lifecycle state.
 *
 *   raw      → muted (default storage state)
 *   listed   → semantic.info (active marketplace listing)
 *   sold     → semantic.success (deal closed)
 *   shipped  → zone.collection (in transit / fulfilled)
 *   grading  → semantic.warning (in grading queue)
 *   graded   → brand.gold.500 (graded, back from grader)
 */

const STATUS: Record<CardStatus, { label: string; color: string }> = {
  raw:     { label: "Raw",     color: "var(--gc-text-muted)" },
  listed:  { label: "Listed",  color: "var(--gc-semantic-info)" },
  sold:    { label: "Sold",    color: "var(--gc-semantic-success)" },
  shipped: { label: "Shipped", color: "var(--gc-zone-collection-500)" },
  grading: { label: "Grading", color: "var(--gc-semantic-warning)" },
  graded:  { label: "Graded",  color: "var(--gc-brand-gold-500)" },
};

interface Props {
  status: CardStatus;
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "md" }: Props) {
  const v = STATUS[status];
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
        background: `color-mix(in srgb, ${v.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${v.color} 30%, transparent)`,
        color: v.color,
        letterSpacing: 0.3,
      }}
    >
      {v.label}
    </span>
  );
}
