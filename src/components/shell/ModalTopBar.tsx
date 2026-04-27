"use client";
import type { ReactNode } from "react";

interface Props {
  title: string;
  /** Close-handler — typically dismisses the modal/sheet. Required (modals always need a way out). */
  onClose: () => void;
  /** Optional right-side action slot — typically a Save/Done button. */
  rightSlot?: ReactNode;
}

/**
 * Top bar variant for modals and bottom sheets.
 *
 * Differences from TopBar:
 *   - X close button on the left (instead of a back arrow)
 *   - No brand wordmark variant
 *   - Designed to render at the top of a modal panel, not stick to the
 *     viewport — caller controls positioning via the parent modal/sheet.
 */
export function ModalTopBar({ title, onClose, rightSlot }: Props) {
  return (
    <div
      className="flex items-center font-gc-ui"
      style={{
        borderBottom: "1px solid var(--gc-border-subtle)",
        paddingLeft: 16,
        paddingRight: 16,
        height: 52,
        gap: 12,
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="bg-transparent border-0 cursor-pointer"
        style={{
          color: "var(--gc-text-muted)",
          fontSize: 22,
          lineHeight: 1,
          minWidth: 32,
          minHeight: 32,
        }}
      >
        ✕
      </button>
      <span
        className="flex-1"
        style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--gc-text-primary)" }}
      >
        {title}
      </span>
      {rightSlot}
    </div>
  );
}
