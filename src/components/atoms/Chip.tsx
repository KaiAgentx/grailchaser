"use client";
import type { ReactNode } from "react";

/**
 * Selectable pill. Active state: gold border + tinted bg.
 */
interface Props {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}

export function Chip({ active, onClick, disabled, children }: Props) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="font-gc-ui"
      style={{
        padding: "6px 14px",
        minHeight: 32,
        background: active ? "color-mix(in srgb, var(--gc-brand-gold-300) 12%, transparent)" : "var(--gc-bg-surface-2)",
        border: `1px solid ${active ? "var(--gc-brand-gold-300)" : "var(--gc-border-subtle)"}`,
        borderRadius: "var(--gc-radius-pill)",
        color: active ? "var(--gc-brand-gold-300)" : "var(--gc-text-secondary)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background var(--gc-duration-fast), border-color var(--gc-duration-fast)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
