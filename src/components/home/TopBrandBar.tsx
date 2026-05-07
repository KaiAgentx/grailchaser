"use client";
import { GAME_DISPLAY_NAME } from "@/lib/games";
import type { Game } from "@/lib/types";

interface Props {
  activeGame: Game;
}

/**
 * TopBrandBar — persistent app brand strip at the top of HomeScreen.
 *
 * v1: HomeScreen-only. If we later want it on every screen, lift to AppShell.
 * Bell is decorative (red dot is hardcoded for v1; tap is no-op).
 */
export function TopBrandBar({ activeGame }: Props) {
  const subtitle = `${GAME_DISPLAY_NAME[activeGame]} TCG`;
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 4px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <ShieldLogo />
        <span className="font-gc-ui" style={{ fontSize: 16, fontWeight: 700, color: "var(--gc-text-primary)", letterSpacing: 0.2 }}>
          GrailChaser
        </span>
        <span style={{ color: "var(--gc-text-muted)", fontSize: 14 }}>·</span>
        <span className="font-gc-ui" style={{ fontSize: 13, color: "var(--gc-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle}
        </span>
      </div>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => { /* v1: cosmetic only */ }}
        style={{
          position: "relative",
          width: 36,
          height: 36,
          background: "transparent",
          border: "none",
          color: "var(--gc-text-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BellIcon />
        <span aria-hidden style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid var(--gc-bg-canvas)" }} />
      </button>
    </div>
  );
}

function ShieldLogo() {
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
      <path d="M11 1L2 4v6.5C2 16.3 5.8 21.5 11 23c5.2-1.5 9-6.7 9-12.5V4l-9-3z" fill="var(--gc-brand-gold-500)" stroke="var(--gc-brand-gold-600)" strokeWidth="0.5" />
      <path d="M7.5 11.5l3 3 4.5-5" stroke="#0B1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
