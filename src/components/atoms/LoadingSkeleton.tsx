"use client";

/**
 * LoadingSkeleton — pulsing rectangle placeholder.
 *
 * Pass width/height/borderRadius. Default radius matches surface cards.
 */

interface Props {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
}

export function LoadingSkeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  className,
}: Props) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: "var(--gc-bg-surface-2)",
        animation: "gcSkeletonPulse 1400ms ease-in-out infinite",
      }}
    />
  );
}
