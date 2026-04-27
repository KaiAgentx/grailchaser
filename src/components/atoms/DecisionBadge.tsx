"use client";
import type { ScanDecision } from "@/lib/types";

/**
 * DecisionBadge — show-mode decision marker for timeline rows.
 *
 *   walked      → semantic.danger (passed on the deal)
 *   negotiated  → zone.show       (counter-offer in flight)
 *   purchased   → semantic.success (deal closed)
 */

const DECISION: Record<ScanDecision, { label: string; color: string }> = {
  walked:     { label: "Walked",     color: "var(--gc-semantic-danger)" },
  negotiated: { label: "Negotiated", color: "var(--gc-zone-show-500)" },
  purchased:  { label: "Purchased",  color: "var(--gc-semantic-success)" },
};

interface Props {
  decision: ScanDecision;
  size?: "sm" | "md";
}

export function DecisionBadge({ decision, size = "md" }: Props) {
  const v = DECISION[decision];
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
