"use client";

/**
 * Trend arrow + percentage + period.
 * Direction: up (success) / down (danger) / flat (muted).
 */

export type TrendDirection = "up" | "down" | "flat";

interface Props {
  direction: TrendDirection;
  /** Percent magnitude as a number (e.g. 6.8 for "6.8%"). Optional — when omitted, just the arrow + period render. */
  pct?: number | null;
  /** Period label, e.g. "7D", "30D". */
  period?: string;
}

const ARROW: Record<TrendDirection, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const COLOR: Record<TrendDirection, string> = {
  up: "var(--gc-semantic-success)",
  down: "var(--gc-semantic-danger)",
  flat: "var(--gc-text-muted)",
};

export function TrendIndicator({ direction, pct, period }: Props) {
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "";
  const pctStr = pct != null && Number.isFinite(pct) ? `${sign}${Math.abs(pct).toFixed(1)}%` : null;
  return (
    <span
      className="font-gc-ui"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13,
        fontWeight: 600,
        color: COLOR[direction],
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{ARROW[direction]}</span>
      {pctStr && <span>{pctStr}</span>}
      {period && <span style={{ fontWeight: 500, opacity: 0.7 }}>({period})</span>}
    </span>
  );
}
