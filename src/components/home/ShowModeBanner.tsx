"use client";

interface Props {
  activeShow: { name: string | null } | null;
  onClick: () => void;
}

/**
 * ShowModeBanner — dramatic full-width CTA above Quick Actions.
 *
 * Hardcoded red/orange gradient (one-off, not a gc-* token). Two states:
 *   - idle: "START SHOW MODE" + "Track buys, walks, negotiations"
 *   - resume: "RESUME ACTIVE SHOW" + show name (or "Untitled show")
 *
 * Both states share the same visual treatment per locked spec — copy is
 * the only difference.
 */
export function ShowModeBanner({ activeShow, onClick }: Props) {
  const title = activeShow ? "RESUME ACTIVE SHOW" : "START SHOW MODE";
  const subtitle = activeShow ? (activeShow.name || "Untitled show") : "Track buys, walks, negotiations";

  return (
    <button
      onClick={onClick}
      className="font-gc-ui show-mode-banner"
      style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        minHeight: 88,
        marginBottom: 16,
        padding: "16px 20px",
        background: "linear-gradient(135deg, #3a0a0a 0%, #8b1a0a 45%, #ff5722 100%)",
        border: "1px solid rgba(255, 100, 50, 0.4)",
        borderRadius: 16,
        boxShadow: "0 0 24px rgba(255, 80, 30, 0.3)",
        color: "#ffffff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 16,
        textAlign: "left",
        overflow: "hidden",
      }}
    >
      <span style={{ flexShrink: 0, color: "var(--gc-brand-gold-500)", display: "inline-flex" }}>
        <LightningIcon />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle}
        </div>
      </div>
      <span aria-hidden style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "1.5px solid var(--gc-brand-gold-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </span>
    </button>
  );
}

function LightningIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}
