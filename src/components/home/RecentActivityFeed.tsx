"use client";
import { DecisionBadge } from "@/components/atoms/DecisionBadge";
import type { HomeActivityItem } from "@/hooks/useHomeData";

interface Props {
  items: HomeActivityItem[];
  /** Called when a row with a resolvedCardId is tapped. Walked / negotiated /
   *  checked rows have no resolved card and are display-only. */
  onCardTap: (cardId: string) => void;
}

const fmtUsd = (v: number | null) => v != null ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : null;

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * RecentActivityFeed — last 10 scans with decision-aware labels.
 *
 * Purchased rows are tappable (navigate to card detail).
 * Walked / Negotiated / Checked are display-only.
 */
export function RecentActivityFeed({ items, onCardTap }: Props) {
  return (
    <div style={{ background: "var(--gc-bg-surface-1)", border: "1px solid var(--gc-border-subtle)", borderRadius: "var(--gc-radius-md)", overflow: "hidden" }}>
      {items.map((item, idx) => {
        const tappable = item.decision === "purchased" && item.resolvedCardId != null;
        const isLast = idx === items.length - 1;
        const onClick = tappable && item.resolvedCardId ? () => onCardTap(item.resolvedCardId!) : undefined;
        const baseStyle: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          gap: 12,
          borderBottom: isLast ? "none" : "1px solid var(--gc-border-subtle)",
          background: "transparent",
          width: "100%",
          textAlign: "left",
          color: "inherit",
          fontFamily: "inherit",
        };
        const content = (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div className="font-gc-ui" style={{ fontSize: 14, color: "var(--gc-text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.cardName}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {item.decision != null ? (
                  <>
                    <DecisionBadge decision={item.decision} size="sm" />
                    {item.finalPriceUsd != null && (item.decision === "purchased" || item.decision === "negotiated") && (
                      <span className="font-gc-mono" style={{ fontSize: 12, color: "var(--gc-text-secondary)", fontWeight: 600 }}>
                        {fmtUsd(item.finalPriceUsd)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-gc-ui" style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
                    Checked
                  </span>
                )}
              </div>
            </div>
            <div className="font-gc-ui" style={{ fontSize: 11, color: "var(--gc-text-muted)", flexShrink: 0 }}>
              {fmtRelative(item.createdAt)}
            </div>
          </>
        );
        if (tappable) {
          return (
            <button key={item.scanResultId} onClick={onClick} style={{ ...baseStyle, border: "none", cursor: "pointer" }}>
              {content}
            </button>
          );
        }
        return (
          <div key={item.scanResultId} style={baseStyle}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
