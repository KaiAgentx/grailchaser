"use client";

interface Props {
  onQuickCheck: () => void;
  onAddCard: () => void;
  onBatchImport: () => void;
}

/**
 * QuickActionsRow — three icon-tile buttons under the home header.
 *
 * Quick Check (camera scan, no save) / Add Card (camera scan, save to box) /
 * Batch Import (CSV/multi-card upload). All wired to existing screen routes
 * via the parent's navigation callbacks.
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
      <Tile label="Quick Check" onClick={onQuickCheck} icon={<SearchIcon />} />
      <Tile label="Add Card" onClick={onAddCard} icon={<PlusIcon />} />
      <Tile label="Batch Import" onClick={onBatchImport} icon={<StackIcon />} />
    </div>
  );
}

function Tile({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="font-gc-ui"
      style={{
        flex: 1,
        minHeight: 110,
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
        padding: "18px 12px",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--gc-brand-gold-500) 10%, transparent)",
          border: "1.5px solid color-mix(in srgb, var(--gc-brand-gold-500) 45%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--gc-brand-gold-500)",
        }}
      >
        {icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", textAlign: "center", color: "var(--gc-brand-gold-500)" }}>{label}</span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="13" height="13" rx="2" />
      <path d="M8 8h13v13a2 2 0 0 1-2 2H8" />
    </svg>
  );
}
