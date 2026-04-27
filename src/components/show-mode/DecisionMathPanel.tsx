"use client";
import { useState } from "react";

/**
 * DecisionMathPanel — collapsible breakdown of the decision math.
 *
 * Uses the canonical Show Mode labels strictly (no synonyms):
 *   Market Value / Dealer Ask / Max Buy / Verdict
 *
 * Default collapsed. Tapping the header toggles. Renders nothing useful
 * if marketValue is null (no comp data).
 */

interface Props {
  marketValueUsd: number | null;
  dealerAskUsd: number;
  maxBuyUsd: number | null;
  /** Optional tier label for the Max Buy line (e.g. "Mid"). Comes from Phase A pricing. */
  maxBuyTierLabel?: string | null;
}

const fmtUsd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export function DecisionMathPanel({ marketValueUsd, dealerAskUsd, maxBuyUsd, maxBuyTierLabel }: Props) {
  const [open, setOpen] = useState(false);

  const diffMarket = marketValueUsd != null ? dealerAskUsd - marketValueUsd : null;
  const diffMarketPct = marketValueUsd != null && marketValueUsd > 0 ? (diffMarket! / marketValueUsd) * 100 : null;
  const diffMax = maxBuyUsd != null ? dealerAskUsd - maxBuyUsd : null;
  const diffMaxPct = maxBuyUsd != null && maxBuyUsd > 0 ? (diffMax! / maxBuyUsd) * 100 : null;

  return (
    <div
      className="font-gc-ui"
      style={{
        background: "var(--gc-bg-surface-1)",
        border: "1px solid var(--gc-border-subtle)",
        borderRadius: "var(--gc-radius-md)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          color: "var(--gc-text-muted)",
          fontFamily: "inherit",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <span>Math</span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 14px" }}>
          <Row label="Market Value" value={marketValueUsd != null ? fmtUsd(marketValueUsd) : "—"} />
          <Row label="Dealer Ask" value={fmtUsd(dealerAskUsd)} />
          <Row
            label="Max Buy"
            value={maxBuyUsd != null ? fmtUsd(maxBuyUsd) : "—"}
            sub={maxBuyTierLabel ? `${maxBuyTierLabel} tier` : undefined}
          />
          {diffMarket != null && diffMarketPct != null && (
            <Row
              label="Diff vs Market"
              value={`${diffMarket >= 0 ? "+" : "−"}${fmtUsd(Math.abs(diffMarket))}`}
              sub={`(${fmtPct(diffMarketPct)})`}
              tone={diffMarket > 0 ? "danger" : diffMarket < 0 ? "success" : "muted"}
            />
          )}
          {diffMax != null && diffMaxPct != null && (
            <Row
              label="Diff vs Max"
              value={`${diffMax >= 0 ? "+" : "−"}${fmtUsd(Math.abs(diffMax))}`}
              sub={`(${fmtPct(diffMaxPct)})`}
              tone={diffMax > 0 ? "danger" : diffMax < 0 ? "success" : "muted"}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, sub, tone = "neutral" }: {
  label: string; value: string; sub?: string; tone?: "neutral" | "success" | "danger" | "muted";
}) {
  const color = tone === "success" ? "var(--gc-semantic-success)"
    : tone === "danger" ? "var(--gc-semantic-danger)"
    : tone === "muted" ? "var(--gc-text-muted)"
    : "var(--gc-text-primary)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderTop: "1px dashed var(--gc-border-subtle)" }}>
      <span style={{ fontSize: 13, color: "var(--gc-text-secondary)" }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="font-gc-mono" style={{ fontSize: 14, fontWeight: 600, color }}>{value}</span>
        {sub && <span style={{ fontSize: 11, color: "var(--gc-text-muted)" }}>{sub}</span>}
      </span>
    </div>
  );
}
