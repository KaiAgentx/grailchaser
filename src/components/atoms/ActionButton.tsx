"use client";
import { useState } from "react";

/**
 * Action Engine atom. 9 variants, 3 sizes, default/loading/disabled states.
 *
 * Variants and color mapping (per locked decisions):
 *   buy        → semantic.success bg     (filled, primary)
 *   walk       → semantic.danger bg      (filled, primary)
 *   negotiate  → zone.show bg            (filled, primary)
 *   grade      → zone.actions bg         (filled, primary, dark text)
 *   sell       → zone.actions bg         (filled, primary, dark text)
 *   list       → zone.actions bg         (filled, primary, dark text)
 *   move       → zone.collection outline (secondary)
 *   watch      → zone.scan outline       (secondary)
 *   pull       → zone.collection outline (secondary)
 *
 * 44px+ touch target, pill radius, 120ms tap-feedback scale, uppercase label.
 */

export type ActionVariant =
  | "buy" | "walk" | "negotiate" | "grade" | "move"
  | "sell" | "watch" | "pull" | "list";

export type ActionSize = "sm" | "md" | "lg";

interface Props {
  variant: ActionVariant;
  size?: ActionSize;
  /** Override the default uppercase label. */
  label?: string;
  /** Replace the right-side area with a custom icon. */
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface VariantStyle {
  label: string;
  bg: string;
  text: string;
  border?: string;
}

const VARIANTS: Record<ActionVariant, VariantStyle> = {
  buy:       { label: "BUY",       bg: "var(--gc-semantic-success)", text: "#fff" },
  walk:      { label: "WALK",      bg: "var(--gc-semantic-danger)",  text: "#fff" },
  negotiate: { label: "NEGOTIATE", bg: "var(--gc-zone-show-500)",    text: "#fff" },
  grade:     { label: "GRADE",     bg: "var(--gc-zone-actions-500)", text: "#0a0a12" },
  sell:      { label: "SELL",      bg: "var(--gc-zone-actions-500)", text: "#0a0a12" },
  list:      { label: "LIST",      bg: "var(--gc-zone-actions-500)", text: "#0a0a12" },
  move:      { label: "MOVE",      bg: "transparent", text: "var(--gc-zone-collection-500)", border: "var(--gc-zone-collection-500)" },
  watch:     { label: "WATCH",     bg: "transparent", text: "var(--gc-zone-scan-500)",       border: "var(--gc-zone-scan-500)" },
  pull:      { label: "PULL",      bg: "transparent", text: "var(--gc-zone-collection-500)", border: "var(--gc-zone-collection-500)" },
};

const SIZES: Record<ActionSize, { height: number; px: number; fs: number }> = {
  sm: { height: 36, px: 14, fs: 13 },
  md: { height: 44, px: 18, fs: 15 },
  lg: { height: 52, px: 22, fs: 16 },
};

export function ActionButton({
  variant, size = "md", label, icon, loading = false, disabled = false, onClick,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const inactive = disabled || loading;

  return (
    <button
      onClick={inactive ? undefined : onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      disabled={inactive}
      className="font-gc-ui"
      style={{
        minHeight: s.height,
        padding: `0 ${s.px}px`,
        background: inactive ? "var(--gc-bg-surface-2)" : v.bg,
        color: inactive ? "var(--gc-text-disabled)" : v.text,
        border: v.border ? `1.5px solid ${inactive ? "var(--gc-border-subtle)" : v.border}` : "none",
        borderRadius: "var(--gc-radius-pill)",
        fontSize: s.fs,
        fontWeight: 600,
        letterSpacing: 0.5,
        cursor: inactive ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transform: pressed && !inactive ? "scale(0.97)" : "scale(1)",
        transition: "transform var(--gc-duration-micro)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading ? <Spinner /> : (
        <>
          {icon}
          <span>{label ?? v.label}</span>
        </>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
}
