"use client";
import { Shell } from "../shell/Shell";

/**
 * Collection hub stub.
 *
 * Per locked decisions, Collection contains:
 *   - My Cards    (working)
 *   - Boxes       (working — existing storage browser)
 *   - Watchlist   (working — relocated from legacy "More" overlay)
 *   - Pick List   (Coming soon — B-ui-2)
 *   - Storage Map (Coming soon — B-ui-2)
 *
 * Renders a 5-tile hub. 3 working tiles route via onNavigate; 2 disabled
 * placeholders show "Coming soon" until B-ui-2 builds the real screens.
 */

interface Props {
  onNavigate: (screen: string) => void;
}

interface Tile {
  id: string;
  label: string;
  desc: string;
  icon: string;
  target?: string;
}

const tiles: Tile[] = [
  { id: "myCards", label: "My Cards", desc: "Your full collection", icon: "▤", target: "myCards" },
  { id: "boxes", label: "Boxes", desc: "Storage organization", icon: "▦", target: "storage" },
  { id: "watchlist", label: "Watchlist", desc: "Cards you’re tracking", icon: "★", target: "watchlist" },
  { id: "pickList", label: "Pick List", desc: "Coming soon", icon: "✓" },
  { id: "storageMap", label: "Storage Map", desc: "Coming soon", icon: "▥" },
];

export function CollectionHomeScreen({ onNavigate }: Props) {
  return (
    <Shell title="Collection">
      <div style={{ paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {tiles.map((t) => {
          const enabled = !!t.target;
          return (
            <button
              key={t.id}
              onClick={() => enabled && t.target && onNavigate(t.target)}
              disabled={!enabled}
              className="font-gc-ui"
              style={{
                background: "var(--gc-bg-surface-1)",
                border: "1px solid var(--gc-border-subtle)",
                borderRadius: "var(--gc-radius-lg)",
                padding: "20px 16px",
                textAlign: "left",
                cursor: enabled ? "pointer" : "not-allowed",
                opacity: enabled ? 1 : 0.4,
                color: "inherit",
                minHeight: 120,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8, color: "var(--gc-brand-gold-500)" }}>
                {t.icon}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gc-text-primary)", marginBottom: 4 }}>
                {t.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--gc-text-muted)" }}>
                {t.desc}
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}
