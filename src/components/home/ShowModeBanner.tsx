"use client";

interface Props {
  activeShow: { name: string | null } | null;
  onClick: () => void;
}

/**
 * ShowModeBanner — dramatic full-width CTA above Quick Actions.
 *
 * Style A (metallic gloss): vertical red/orange gradient with a horizontal
 * white sheen midway and a thin top highlight stripe to suggest brushed
 * metal. Centered icon-and-text stack; whole banner is the tappable surface.
 *
 * Two states differ only in copy:
 *   - idle:  "START SHOW MODE" + "Track buys, walks, negotiations"
 *   - resume: "RESUME ACTIVE SHOW" + show name (or "Untitled show")
 */
export function ShowModeBanner({ activeShow, onClick }: Props) {
  const title = activeShow ? "RESUME ACTIVE SHOW" : "START SHOW MODE";
  const subtitle = activeShow ? (activeShow.name || "Untitled show") : "Track buys, walks, negotiations";

  return (
    <button
      onClick={onClick}
      className="font-gc-ui"
      style={{
        position: "relative",
        width: "100%",
        minHeight: 108,
        marginBottom: 16,
        padding: 0,
        border: "0.5px solid rgba(255, 180, 150, 0.5)",
        borderRadius: 14,
        background: "linear-gradient(180deg, #5a0000 0%, #a01010 22%, #e23a1a 48%, #ff5224 52%, #a01010 78%, #3a0000 100%)",
        boxShadow: "0 0 32px rgba(255, 80, 30, 0.35)",
        cursor: "pointer",
        overflow: "hidden",
        color: "#ffffff",
      }}
    >
      {/* Top highlight stripe — brushed-metal cue */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "rgba(255, 200, 180, 0.45)",
          pointerEvents: "none",
        }}
      />
      {/* Horizontal sheen overlay */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0) 55%)",
          pointerEvents: "none",
        }}
      />

      {/* Centered content stack */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "18px 16px",
        }}
      >
        <LightningIcon />
        <div
          style={{
            color: "#fff",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: 3,
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "rgba(255, 230, 220, 0.85)",
            fontSize: 12,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {subtitle}
        </div>
      </div>
    </button>
  );
}

function LightningIcon() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
      <defs>
        <linearGradient id="boltGoldA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#9c7e1c" />
        </linearGradient>
      </defs>
      <path d="M 14 0 L 22 0 L 8 14 L 18 14 L 4 28 L 10 16 L 0 16 Z" fill="url(#boltGoldA)" stroke="#7d5e10" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}
