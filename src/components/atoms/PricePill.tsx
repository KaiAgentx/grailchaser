"use client";

/**
 * Compact pill: source label + USD value.
 * Examples: "$1,248 Market", "$1,350 Ask", "$1,250 Max".
 * Mono font for the number, ui font for the label.
 */

interface Props {
  label: string;
  value: number | null;
  /** Optional ISO timestamp for the source's last update (rendered subtle below). */
  lastUpdated?: string | null;
}

function fmtUsd(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function PricePill({ label, value, lastUpdated }: Props) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        background: "var(--gc-bg-surface-2)",
        border: "1px solid var(--gc-border-subtle)",
        borderRadius: "var(--gc-radius-md)",
        padding: "8px 12px",
        minWidth: 96,
      }}
    >
      <span
        className="font-gc-mono"
        style={{ fontSize: 16, fontWeight: 700, color: "var(--gc-text-primary)", lineHeight: 1.1 }}
      >
        {value != null ? fmtUsd(value) : "—"}
      </span>
      <span
        className="font-gc-ui"
        style={{ fontSize: 11, fontWeight: 500, color: "var(--gc-text-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {label}
      </span>
      {lastUpdated && (
        <span
          className="font-gc-ui"
          style={{ fontSize: 10, color: "var(--gc-text-disabled)", marginTop: 2 }}
        >
          {lastUpdated}
        </span>
      )}
    </div>
  );
}
