"use client";

/**
 * Tiny inline SVG line chart. No deps, no axes, no labels.
 * Default 80×24px; pass width/height to override.
 *
 * Accepts an array of points; computes min/max and scales to the viewBox.
 * Returns null when fewer than 2 points (nothing to draw).
 */

interface Point {
  captured_at?: string;
  value_usd: number | null;
}

interface Props {
  points: Point[];
  width?: number;
  height?: number;
  /** Stroke color — defaults to zone.collection. Use --gc-* tokens or CSS color values. */
  color?: string;
  strokeWidth?: number;
}

export function Sparkline({
  points, width = 80, height = 24, color = "var(--gc-zone-collection-500)", strokeWidth = 1.5,
}: Props) {
  const values = points.map(p => (p.value_usd != null ? Number(p.value_usd) : null)).filter((v): v is number => v != null);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = width / (values.length - 1);
  const path = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={path} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
