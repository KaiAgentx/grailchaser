"use client";
import type { HomeActivityItem } from "@/hooks/useHomeData";
import type { ScanDecision } from "@/lib/types";

interface Props {
  items: HomeActivityItem[];
  /** Called when an ADDED or PURCHASED row that resolved to a saved card is tapped.
   *  Walked / negotiated / checked rows have no resolved card and are display-only. */
  onCardTap: (cardId: string) => void;
}

/**
 * RecentActivityFeed — last 10 scans, decision-aware status pills.
 *
 * Five visible states:
 *   PURCHASED  (decision === "purchased")           strong green pill
 *   WALKED     (decision === "walked")              red pill
 *   NEGOTIATED (decision === "negotiated")          amber pill
 *   ADDED      (decision === null && resolvedCard)  green pill (collect-flow save)
 *   CHECKED    (decision === null && !resolvedCard) purple pill (no-op scan)
 *
 * Tappable rows: ADDED and PURCHASED (both resolve to a saved card).
 */

type ActivityState = "purchased" | "walked" | "negotiated" | "added" | "checked";

interface PillStyle {
  bg: string;
  fg: string;
  bold?: boolean;
}

const PILL: Record<ActivityState, PillStyle> = {
  purchased:  { bg: "rgba(34, 197, 94, 0.25)",  fg: "#22c55e", bold: true },
  walked:     { bg: "rgba(239, 68, 68, 0.15)",  fg: "#ef4444" },
  negotiated: { bg: "rgba(245, 158, 11, 0.15)", fg: "#f59e0b" },
  added:      { bg: "rgba(34, 197, 94, 0.15)",  fg: "#22c55e" },
  checked:    { bg: "rgba(139, 92, 246, 0.15)", fg: "#a78bfa" },
};

const PILL_LABEL: Record<ActivityState, string> = {
  purchased:  "Purchased",
  walked:     "Walked",
  negotiated: "Negotiated",
  added:      "Added",
  checked:    "Checked",
};

function deriveState(decision: ScanDecision | null, resolvedCardId: string | null): ActivityState {
  if (decision === "purchased") return "purchased";
  if (decision === "walked") return "walked";
  if (decision === "negotiated") return "negotiated";
  if (resolvedCardId != null) return "added";
  return "checked";
}

const fmtSlashDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

export function RecentActivityFeed({ items, onCardTap }: Props) {
  return (
    <div style={{ background: "var(--gc-bg-surface-1)", border: "1px solid var(--gc-border-subtle)", borderRadius: 12, overflow: "hidden" }}>
      {items.map((item, idx) => {
        const state = deriveState(item.decision, item.resolvedCardId);
        const tappable = (state === "added" || state === "purchased") && item.resolvedCardId != null;
        const isLast = idx === items.length - 1;
        const onClick = tappable && item.resolvedCardId ? () => onCardTap(item.resolvedCardId!) : undefined;

        const baseStyle: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          minHeight: 52,
          borderBottom: isLast ? "none" : "1px solid var(--gc-border-subtle)",
          background: "transparent",
          width: "100%",
          textAlign: "left",
          color: "inherit",
          fontFamily: "inherit",
          border: "none",
          cursor: tappable ? "pointer" : "default",
        };

        const pill = PILL[state];

        const content = (
          <>
            <RowIcon state={state} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="font-gc-ui" style={{ fontSize: 14, color: "var(--gc-text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.cardName}
              </div>
              <span
                className="font-gc-ui"
                style={{
                  alignSelf: "flex-start",
                  fontSize: 10,
                  fontWeight: pill.bold ? 700 : 600,
                  color: pill.fg,
                  background: pill.bg,
                  padding: "3px 8px",
                  borderRadius: 999,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                {PILL_LABEL[state]}
              </span>
            </div>
            <div className="font-gc-ui" style={{ fontSize: 12, color: "var(--gc-text-muted)", flexShrink: 0 }}>
              {fmtSlashDate(item.createdAt)}
            </div>
          </>
        );

        if (tappable) {
          return (
            <button key={item.scanResultId} onClick={onClick} style={baseStyle}>
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

function RowIcon({ state }: { state: ActivityState }) {
  const pill = PILL[state];
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: pill.bg,
        color: pill.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <StateIcon state={state} />
    </div>
  );
}

function StateIcon({ state }: { state: ActivityState }) {
  const stroke = "currentColor";
  switch (state) {
    case "purchased":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "added":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "walked":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      );
    case "negotiated":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case "checked":
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}
