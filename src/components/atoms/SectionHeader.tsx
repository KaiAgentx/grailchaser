"use client";
import type { ReactNode } from "react";

/**
 * SectionHeader — uppercase label with optional right-side action.
 * Used to title panels and lists.
 */

interface Props {
  label: string;
  rightSlot?: ReactNode;
}

export function SectionHeader({ label, rightSlot }: Props) {
  return (
    <div
      className="font-gc-ui"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--gc-text-muted)",
          textTransform: "uppercase",
          letterSpacing: 1.2,
        }}
      >
        {label}
      </span>
      {rightSlot}
    </div>
  );
}
