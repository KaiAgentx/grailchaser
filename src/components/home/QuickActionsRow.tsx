"use client";

interface Props {
  onQuickCheck: () => void;
  onAddCard: () => void;
  onBatchImport: () => void;
}

/**
 * QuickActionsRow — three heraldic-crest tiles under the Show Mode banner.
 *
 * Each tile displays a unique shield silhouette (Style A: heraldic crest)
 * with the action's icon embedded inside, drawn entirely as a single SVG.
 * The shield is the frame — no separate icon-circle.
 */
export function QuickActionsRow({ onQuickCheck, onAddCard, onBatchImport }: Props) {
  return (
    <div className="quick-actions-row" style={{ display: "flex", gap: 12, marginBottom: 24 }}>
      <style>{`
        .quick-actions-row button { transition: transform 120ms ease, filter 220ms ease; }
        @media (hover: none) {
          .quick-actions-row button:active { transform: scale(0.97); filter: brightness(1.08); }
        }
        @media (hover: hover) {
          .quick-actions-row button:hover { filter: brightness(1.08); }
          .quick-actions-row button:active { transform: scale(0.98); }
        }
      `}</style>
      <Tile label="Quick Check" onClick={onQuickCheck} emblem={<QuickCheckCrest />} />
      <Tile label="Add Card" onClick={onAddCard} emblem={<AddCardCrest />} />
      <Tile label="Batch Import" onClick={onBatchImport} emblem={<BatchImportCrest />} />
    </div>
  );
}

function Tile({ label, emblem, onClick }: { label: string; emblem: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-gc-ui"
      style={{
        flex: 1,
        minHeight: 130,
        background: "var(--gc-bg-surface-1)",
        border: "1px solid var(--gc-border-subtle)",
        borderRadius: 14,
        color: "var(--gc-text-primary)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "16px 12px",
      }}
    >
      {emblem}
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", textAlign: "center", color: "var(--gc-brand-gold-500)" }}>{label}</span>
    </button>
  );
}

function QuickCheckCrest() {
  return (
    <svg width="56" height="64" viewBox="0 0 72 80" aria-hidden="true">
      <defs>
        <linearGradient id="crestQCgold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#d4af3c" />
          <stop offset="100%" stopColor="#7d5e10" />
        </linearGradient>
        <linearGradient id="crestQCrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5d76e" />
          <stop offset="100%" stopColor="#9c7e1c" />
        </linearGradient>
      </defs>
      <path d="M 4 4 L 68 4 L 68 28 Q 68 60 36 76 Q 4 60 4 28 Z" fill="#0e0e0e" stroke="url(#crestQCrim)" strokeWidth="2.5" />
      <circle cx="32" cy="34" r="14" fill="none" stroke="url(#crestQCgold)" strokeWidth="3" />
      <line x1="42" y1="44" x2="54" y2="56" stroke="url(#crestQCgold)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function AddCardCrest() {
  return (
    <svg width="56" height="64" viewBox="0 0 72 80" aria-hidden="true">
      <defs>
        <linearGradient id="crestACgold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#d4af3c" />
          <stop offset="100%" stopColor="#7d5e10" />
        </linearGradient>
        <linearGradient id="crestACrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5d76e" />
          <stop offset="100%" stopColor="#9c7e1c" />
        </linearGradient>
      </defs>
      <path d="M 4 4 Q 36 -2 68 4 L 68 28 Q 68 60 36 76 Q 4 60 4 28 Z" fill="#0e0e0e" stroke="url(#crestACrim)" strokeWidth="2.5" />
      <rect x="22" y="22" width="28" height="36" rx="3" fill="none" stroke="url(#crestACgold)" strokeWidth="2.5" />
      <line x1="36" y1="32" x2="36" y2="50" stroke="url(#crestACgold)" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="27" y1="41" x2="45" y2="41" stroke="url(#crestACgold)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function BatchImportCrest() {
  return (
    <svg width="56" height="64" viewBox="0 0 72 80" aria-hidden="true">
      <defs>
        <linearGradient id="crestBIgold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#d4af3c" />
          <stop offset="100%" stopColor="#7d5e10" />
        </linearGradient>
        <linearGradient id="crestBIrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5d76e" />
          <stop offset="100%" stopColor="#9c7e1c" />
        </linearGradient>
      </defs>
      <path d="M 4 4 L 68 4 L 62 28 L 68 48 L 62 64 L 36 76 L 10 64 L 4 48 L 10 28 Z" fill="#0e0e0e" stroke="url(#crestBIrim)" strokeWidth="2.5" />
      <rect x="20" y="20" width="22" height="30" rx="3" fill="none" stroke="url(#crestBIgold)" strokeWidth="1.6" opacity="0.6" />
      <rect x="26" y="26" width="22" height="30" rx="3" fill="none" stroke="url(#crestBIgold)" strokeWidth="1.8" opacity="0.8" />
      <rect x="32" y="32" width="22" height="30" rx="3" fill="#0e0e0e" stroke="url(#crestBIgold)" strokeWidth="2.5" />
    </svg>
  );
}
