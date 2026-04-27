"use client";
import { useEffect } from "react";

/**
 * Toast — temporary message anchored above the BottomNav.
 *
 * Standalone (not global). Parent owns visibility + dismissal. Pass
 * `visible=true` to show; auto-dismisses after `duration` if provided.
 *
 * Variants:
 *   info    → semantic.info
 *   success → semantic.success
 *   warning → semantic.warning
 *   danger  → semantic.danger
 */

export type ToastVariant = "info" | "success" | "warning" | "danger";

interface Props {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss after N ms. Pass 0 to keep visible until parent flips visible=false. */
  duration?: number;
  onDismiss?: () => void;
}

const COLOR: Record<ToastVariant, string> = {
  info: "var(--gc-semantic-info)",
  success: "var(--gc-semantic-success)",
  warning: "var(--gc-semantic-warning)",
  danger: "var(--gc-semantic-danger)",
};

export function Toast({ visible, message, variant = "info", duration = 2400, onDismiss }: Props) {
  useEffect(() => {
    if (!visible || !duration) return;
    const t = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(t);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;
  const color = COLOR[variant];

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(80px + env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 200,
        maxWidth: "min(90vw, 460px)",
        padding: "12px 18px",
        background: "var(--gc-bg-surface-2)",
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "var(--gc-radius-md)",
        color: "var(--gc-text-primary)",
        fontFamily: "var(--gc-font-ui)",
        fontSize: 14,
        boxShadow: "var(--gc-shadow-md)",
        animation: "gcToastIn var(--gc-duration-fast) var(--gc-ease-enter)",
      }}
    >
      {message}
    </div>
  );
}
