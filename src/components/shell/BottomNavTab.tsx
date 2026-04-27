"use client";
import type { ReactNode } from "react";

interface Props {
  id: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  elevated?: boolean;
  onTap: (id: string) => void;
}

/**
 * Single bottom-nav tab.
 *
 * Two visual states:
 *   - regular: icon + label stacked, gold when active, muted when inactive
 *   - elevated: raised pill above the bar (used for the Scan tab) with the
 *     scan-zone color, glow shadow, and a 1800ms breathing pulse animation
 *
 * Both meet the 44px minimum touch target. Animation duration is hardcoded
 * to 1800ms per the design tokens motion.use.showModeCapturePulse value
 * (it's a UX-specific value, not part of the duration scale).
 */
export function BottomNavTab({ id, label, icon, active, elevated, onTap }: Props) {
  if (elevated) {
    return (
      <button
        onClick={() => onTap(id)}
        aria-label={label}
        className="flex-1 flex flex-col items-center justify-end gap-gc-xs bg-transparent border-0 cursor-pointer"
        style={{ minHeight: "var(--gc-touch-target-min)" }}
      >
        <span
          className="flex items-center justify-center rounded-gc-pill"
          style={{
            width: 56,
            height: 56,
            background: "var(--gc-zone-scan-500)",
            color: "var(--gc-text-primary)",
            transform: "translateY(-12px)",
            /* Pulse duration per design tokens motion.use.showModeCapturePulse */
            animation: "gcScanPulse 1800ms cubic-bezier(0.19, 1, 0.22, 1) infinite",
          }}
        >
          {icon}
        </span>
        <span
          className="font-gc-ui"
          style={{
            fontSize: 11,
            lineHeight: 1,
            fontWeight: 500,
            color: "var(--gc-text-muted)",
            marginBottom: 6,
          }}
        >
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={() => onTap(id)}
      aria-label={label}
      className="flex-1 flex flex-col items-center justify-center gap-gc-xs bg-transparent border-0 cursor-pointer"
      style={{ minHeight: "var(--gc-touch-target-min)" }}
    >
      <span
        style={{
          color: active ? "var(--gc-brand-gold-500)" : "var(--gc-text-muted)",
          lineHeight: 1,
          display: "inline-flex",
        }}
      >
        {icon}
      </span>
      <span
        className="font-gc-ui"
        style={{
          fontSize: 11,
          lineHeight: 1,
          fontWeight: active ? 600 : 500,
          color: active ? "var(--gc-brand-gold-500)" : "var(--gc-text-muted)",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        className="rounded-gc-pill"
        style={{
          width: 16,
          height: 2,
          background: active ? "var(--gc-brand-gold-500)" : "transparent",
          transition: "background var(--gc-duration-fast)",
        }}
      />
    </button>
  );
}
