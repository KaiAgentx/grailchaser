"use client";
import type { ReactNode } from "react";

/**
 * EmptyState — placeholder for "no data yet" panels.
 * Centered icon + title + description + optional action slot.
 */

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div
      className="font-gc-ui"
      style={{
        textAlign: "center",
        padding: "60px 24px",
        color: "var(--gc-text-muted)",
      }}
    >
      {icon && <div style={{ fontSize: 48, marginBottom: 16, color: "var(--gc-text-muted)" }}>{icon}</div>}
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--gc-text-secondary)", marginBottom: 6 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 13, maxWidth: 320, margin: "0 auto", lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
