"use client";
import { TIER_COLORS, TIER_LABEL, type Tier } from "@/lib/utils";

export function TierBadge({ tier, size = 'md' }: {
  tier: Tier | string | null | undefined;
  size?: 'sm' | 'md';
}) {
  const safeTier: Tier = (tier && tier in TIER_COLORS ? tier : 'Unpriced') as Tier;
  const color = TIER_COLORS[safeTier];
  const label = TIER_LABEL[safeTier];
  const fontSize = size === 'sm' ? 10 : 11;
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize,
      fontWeight: 600,
      padding,
      borderRadius: 4,
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: color
      }} />
      {label}
    </span>
  );
}
