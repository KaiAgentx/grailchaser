"use client";
import type { ReactNode } from "react";

/**
 * ErrorBanner — danger-tinted message strip with optional retry.
 */

interface Props {
  message: string;
  detail?: string;
  retryLabel?: string;
  onRetry?: () => void;
  /** Optional dismiss callback — when provided, renders an X button. */
  onDismiss?: () => void;
  /** Override the default icon. */
  icon?: ReactNode;
}

export function ErrorBanner({ message, detail, retryLabel = "Retry", onRetry, onDismiss, icon }: Props) {
  return (
    <div
      className="font-gc-ui"
      style={{
        background: "color-mix(in srgb, var(--gc-semantic-danger) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--gc-semantic-danger) 30%, transparent)",
        borderRadius: "var(--gc-radius-md)",
        padding: "12px 14px",
        color: "var(--gc-semantic-danger)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
      role="alert"
    >
      <span style={{ fontSize: 16, lineHeight: 1.2 }}>{icon ?? "⚠"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{message}</div>
        {detail && (
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{detail}</div>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 8,
              background: "transparent",
              border: "1px solid currentColor",
              borderRadius: "var(--gc-radius-sm)",
              color: "currentColor",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            {retryLabel}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "currentColor",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
