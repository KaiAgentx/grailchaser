"use client";

interface Props {
  cardCount: number;
  totalValue: number;
  gradedCount: number;
  boxesCount: number;
  /** Portfolio-weighted ROI as a percent. null when no eligible cards (cost_basis > 0). */
  roi: number | null;
  avgCardValue: number;
}

const fmtMoney = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * CollectionSummaryCard — structured 6-stat replacement for the artisanal
 * Cormorant gold-gradient hero. Top row: counts + total. Bottom row: derived
 * health metrics. Total Value preserves the Cormorant Garamond serif as the
 * single artisanal-treatment carrier.
 */
export function CollectionSummaryCard({ cardCount, totalValue, gradedCount, boxesCount, roi, avgCardValue }: Props) {
  return (
    <div
      style={{
        background: "var(--gc-bg-surface-1)",
        border: "1px solid var(--gc-border-subtle)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 32,
      }}
    >
      <div className="font-gc-ui" style={{ fontSize: 11, fontWeight: 600, color: "var(--gc-brand-gold-500)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
        Collection Summary
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Stat
          value={<span className="font-gc-ui" style={{ fontSize: 32, fontWeight: 700, color: "var(--gc-text-primary)", lineHeight: 1 }}>{cardCount}</span>}
          label="Cards Owned"
        />
        <Stat
          value={<span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 700, color: "var(--gc-brand-gold-500)", lineHeight: 1 }}>{fmtMoney(totalValue)}</span>}
          label="Total Value"
        />
        <Stat
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="font-gc-ui" style={{ fontSize: 32, fontWeight: 700, color: "var(--gc-text-primary)", lineHeight: 1 }}>{gradedCount}</span>
              <ShieldMini />
            </span>
          }
          label="Graded Cards"
        />
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "18px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Stat
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <BoxIcon />
              <span className="font-gc-ui" style={{ fontSize: 22, fontWeight: 700, color: "var(--gc-text-primary)", lineHeight: 1 }}>{boxesCount}</span>
            </span>
          }
          label="Boxes Owned"
        />
        <Stat
          value={<RoiPill roi={roi} />}
          label="Avg ROI"
        />
        <Stat
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ChartIcon />
              <span className="font-gc-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--gc-text-primary)", lineHeight: 1 }}>{fmtMoney(avgCardValue)}</span>
            </span>
          }
          label="Avg Card Value"
        />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div>{value}</div>
      <div className="font-gc-ui" style={{ fontSize: 11, color: "var(--gc-text-muted)", letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

function RoiPill({ roi }: { roi: number | null }) {
  if (roi == null) {
    return <span className="font-gc-ui" style={{ fontSize: 22, fontWeight: 700, color: "var(--gc-text-muted)", lineHeight: 1 }}>—</span>;
  }
  // Sign indicator (no historical trend): positive → green up, negative → red down,
  // |roi| < 0.1% treated as flat for readability.
  const flat = Math.abs(roi) < 0.1;
  const color = flat ? "var(--gc-text-muted)" : roi > 0 ? "#22c55e" : "#ef4444";
  const arrow = flat ? "→" : roi > 0 ? "▲" : "▼";
  const sign = roi > 0 ? "+" : "";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color }}>
      <span style={{ fontSize: 12 }}>{arrow}</span>
      <span className="font-gc-ui" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{sign}{roi.toFixed(1)}%</span>
    </span>
  );
}

function ShieldMini() {
  return (
    <svg width="16" height="18" viewBox="0 0 22 24" fill="none">
      <path d="M11 1L2 4v6.5C2 16.3 5.8 21.5 11 23c5.2-1.5 9-6.7 9-12.5V4l-9-3z" fill="var(--gc-brand-gold-500)" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gc-brand-gold-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v13H3V8" />
      <path d="M1 3h22v5H1z" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gc-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}
