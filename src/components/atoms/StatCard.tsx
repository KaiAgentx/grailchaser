"use client";
import type { ReactNode } from "react";

/**
 * Generic stat tile: label + big number + optional delta/secondary.
 * Used in CollectionSummaryCard, ShowDetail, etc.
 */

interface Props {
  label: string;
  value: string | number | null;
  /** Optional sub-line below the number (delta, period, etc.). Pre-formatted. */
  delta?: ReactNode;
  /** Visual emphasis: 'gold' for hero stats (portfolio total), 'plain' for regular. */
  emphasis?: "plain" | "gold";
}

export function StatCard({ label, value, delta, emphasis = "plain" }: Props) {
  const numberColor = emphasis === "gold" ? "var(--gc-brand-gold-500)" : "var(--gc-text-primary)";
  return (
    <div
      style={{
        background: "var(--gc-bg-surface-1)",
        border: "1px solid var(--gc-border-subtle)",
        borderRadius: "var(--gc-radius-md)",
        padding: 16,
        minWidth: 120,
      }}
    >
      <div
        className="font-gc-ui"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--gc-text-muted)",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        className="font-gc-ui"
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: numberColor,
          lineHeight: 1.1,
        }}
      >
        {value ?? "—"}
      </div>
      {delta != null && (
        <div
          className="font-gc-ui"
          style={{ fontSize: 12, color: "var(--gc-text-secondary)", marginTop: 4 }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
