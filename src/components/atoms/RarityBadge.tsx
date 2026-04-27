"use client";

/**
 * RarityBadge — small pill keyed off the upstream rarity string.
 *
 * Pokemon TCG API exposes many rarity strings; the mapping below covers the
 * common ones seen in the catalog. Unknown values fall back to muted.
 * Tunable post-beta when more rarity values surface in real data.
 */

const RARITY_COLOR: Record<string, string> = {
  common: "var(--gc-text-muted)",
  uncommon: "var(--gc-semantic-info)",
  rare: "var(--gc-semantic-success)",
  "rare holo": "var(--gc-brand-gold-500)",
  "rare ultra": "var(--gc-zone-hub-500)",
  "rare secret": "var(--gc-zone-secondary-500)",
  "rainbow rare": "var(--gc-zone-secondary-500)",
  promo: "var(--gc-zone-show-500)",
  "hyper rare": "var(--gc-brand-gold-300)",
};

interface Props {
  rarity: string | null | undefined;
  size?: "sm" | "md";
}

function colorFor(rarity: string | null | undefined): string {
  if (!rarity) return "var(--gc-text-muted)";
  const key = rarity.trim().toLowerCase();
  return RARITY_COLOR[key] ?? "var(--gc-text-muted)";
}

export function RarityBadge({ rarity, size = "md" }: Props) {
  const color = colorFor(rarity);
  const label = rarity?.trim() || "Unknown";
  const fontSize = size === "sm" ? 10 : 11;
  const padding = size === "sm" ? "2px 8px" : "3px 10px";

  return (
    <span
      className="font-gc-ui"
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: "var(--gc-radius-pill)",
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        color,
        letterSpacing: 0.2,
      }}
    >
      {label}
    </span>
  );
}
