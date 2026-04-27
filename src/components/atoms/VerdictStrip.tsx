"use client";

/**
 * VerdictStrip — Show Mode live decision indicator.
 *
 * Three states use canonical labels (no synonyms allowed per locked decisions):
 *   below_max  → "Below Max"  (semantic.success)
 *   at_max     → "At Max"     (semantic.warning)
 *   above_max  → "Above Max"  (semantic.danger)
 *
 * Renders full-width pill with the verdict label + secondary line
 * (e.g. "18% off Market Value").
 */

export type VerdictState = "below_max" | "at_max" | "above_max";

interface Props {
  state: VerdictState;
  /** Optional secondary line — typically "X% off Market Value" or "$Y above Max Buy". */
  detail?: string;
}

const VARIANTS: Record<VerdictState, { label: string; color: string }> = {
  below_max: { label: "Below Max", color: "var(--gc-semantic-success)" },
  at_max:    { label: "At Max",    color: "var(--gc-semantic-warning)" },
  above_max: { label: "Above Max", color: "var(--gc-semantic-danger)"  },
};

export function VerdictStrip({ state, detail }: Props) {
  const v = VARIANTS[state];
  return (
    <div
      className="font-gc-ui"
      style={{
        width: "100%",
        padding: "16px 20px",
        borderRadius: "var(--gc-radius-pill)",
        background: `color-mix(in srgb, ${v.color} 12%, transparent)`,
        border: `1.5px solid color-mix(in srgb, ${v.color} 35%, transparent)`,
        color: v.color,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{v.label}</div>
      {detail && <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>{detail}</div>}
    </div>
  );
}
