"use client";

/**
 * ConfidenceBandBadge — recognition confidence indicator (from /recognize).
 *
 * Vocabulary from src/types/tcg.ts:
 *   exact          → semantic.success
 *   likely         → semantic.info
 *   choose_version → semantic.warning
 *   unclear        → semantic.danger
 */

export type ConfidenceBand = "exact" | "likely" | "choose_version" | "unclear";

const BAND: Record<ConfidenceBand, { label: string; color: string }> = {
  exact:          { label: "Exact",      color: "var(--gc-semantic-success)" },
  likely:         { label: "Likely",     color: "var(--gc-semantic-info)" },
  choose_version: { label: "Pick One",   color: "var(--gc-semantic-warning)" },
  unclear:        { label: "Unclear",    color: "var(--gc-semantic-danger)" },
};

interface Props {
  band: ConfidenceBand;
  size?: "sm" | "md";
}

export function ConfidenceBandBadge({ band, size = "md" }: Props) {
  const v = BAND[band];
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
