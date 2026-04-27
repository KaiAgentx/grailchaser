"use client";
import { TIER_LABEL, type Tier } from "@/lib/utils";

/**
 * TierBadge — sourced from --gc-tier-* design tokens.
 *
 * Tiers map to brand-aware colors. The label set still comes from utils
 * (Bulk / Low / Mid / High / Unpriced) since labels aren't visual.
 */

const TIER_TOKEN: Record<Tier, string> = {
  Bulk: "var(--gc-tier-bulk)",
  Low: "var(--gc-tier-low)",
  Mid: "var(--gc-tier-mid)",
  High: "var(--gc-tier-high)",
  Unpriced: "var(--gc-tier-unpriced)",
};

interface Props {
  tier: Tier | string | null | undefined;
  size?: "sm" | "md";
}

export function TierBadge({ tier, size = "md" }: Props) {
  const safeTier: Tier = (tier && tier in TIER_TOKEN ? tier : "Unpriced") as Tier;
  const color = TIER_TOKEN[safeTier];
  const label = TIER_LABEL[safeTier];
  const fontSize = size === "sm" ? 10 : 11;
  const padding = size === "sm" ? "2px 6px" : "3px 8px";

  return (
    <span
      className="font-gc-ui"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: 4,
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 27%, transparent)`,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}
