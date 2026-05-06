"use client";
import type { GradedComps } from "@/lib/ppt/client";

const fmtUsd = (v: number | null) => v != null ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

interface Props {
  comps: GradedComps;
}

/**
 * GradedCompsCard — show-mode-local 2x2 grid of eBay sold + PSA grade comps.
 *
 * Render contract (enforced by caller in ShowModeResult): only mount when
 * comps.psa10_avg !== null. That's the "grade-worthy card" signal — bulk
 * commons get no PSA 10 average from PPT, so they never render this card
 * and don't waste vertical space on the show floor.
 */
export function GradedCompsCard({ comps }: Props) {
  return (
    <div style={{ marginBottom: 16, background: "var(--gc-bg-surface-1)", border: "1px solid var(--gc-border-subtle)", borderRadius: "var(--gc-radius-md)", padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>Graded Comps</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        <Tile label="Raw Market" value={fmtUsd(comps.raw_market)} accent="var(--gc-text-primary)" />
        <Tile label="PSA 10" value={fmtUsd(comps.psa10_avg)} accent="var(--gc-brand-gold-500)" />
        <Tile label="PSA 9" value={fmtUsd(comps.psa9_avg)} accent="var(--gc-text-primary)" />
        <Tile label="PSA 8" value={fmtUsd(comps.psa8_avg)} accent="var(--gc-text-primary)" />
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: "var(--gc-bg-surface-2)", borderRadius: "var(--gc-radius-sm)", padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{label}</div>
      <div className="font-gc-mono" style={{ fontSize: 18, fontWeight: 700, color: accent, marginTop: 3 }}>{value}</div>
    </div>
  );
}
