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
 *
 * Layout: brand cluster (logo + wordmark + subtitle) is horizontally centered;
 * bell sits absolutely on the right so the cluster centers without offset.
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
        justifyContent: "center",
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
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
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
    <svg width="24" height="27" viewBox="0 0 32 36" aria-hidden="true">
      <defs>
        <linearGradient id="brandLogoGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#d4af3c" />
          <stop offset="100%" stopColor="#7d5e10" />
        </linearGradient>
      </defs>
      <path d="M 1 2 L 31 2 L 31 11 Q 31 28 16 34 Q 1 28 1 11 Z" fill="url(#brandLogoGold)" stroke="#9c7e1c" strokeWidth="0.5" />
      <text x="16" y="24" textAnchor="middle" fill="#1a1a1a" fontFamily="'Cormorant Garamond', Georgia, serif" fontSize="20" fontWeight="700" fontStyle="italic">G</text>
      <line x1="10" y1="9" x2="22" y2="9" stroke="#1a1a1a" strokeWidth="0.7" opacity="0.9" />
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
