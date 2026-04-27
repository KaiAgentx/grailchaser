"use client";
import type { ReactNode } from "react";

interface Props {
  /** Plain text title (rendered when brandTitle is false). */
  title: string;
  /** Optional back-button callback. When omitted no back chevron renders. */
  back?: () => void;
  /** Replace the title with the GRAILCHASER wordmark (used on the Home tab). */
  brandTitle?: boolean;
  /** Optional right-side action slot — buttons / icons / chips. */
  rightSlot?: ReactNode;
}

/**
 * Default top bar for the per-screen Shell.
 *
 * Sticky, blurred surface, 56px tall. Hosts an optional back arrow, a title
 * (or brand wordmark), and a right-side action slot.
 *
 * Reachable directly by new screens that want a top bar without the legacy
 * Shell wrapper (e.g., ShowModeResult, CardDetail in B-ui-2).
 */
export function TopBar({ title, back, brandTitle, rightSlot }: Props) {
  return (
    <div
      className="sticky top-0 z-[100] flex items-center backdrop-blur font-gc-ui"
      style={{
        background: "color-mix(in srgb, var(--gc-bg-canvas) 85%, transparent)",
        borderBottom: "1px solid var(--gc-border-subtle)",
        paddingLeft: 20,
        paddingRight: 20,
        height: 56,
        gap: 12,
      }}
    >
      {back && (
        <button
          onClick={back}
          aria-label="Back"
          className="bg-transparent border-0 cursor-pointer p-2"
          style={{ color: "var(--gc-text-muted)", fontSize: 18, lineHeight: 1 }}
        >
          ←
        </button>
      )}
      {brandTitle ? (
        <span
          className="flex-1"
          style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}
        >
          <span style={{ color: "var(--gc-brand-gold-500)", opacity: 0.7, marginRight: 4 }}>♦</span>
          <span style={{ color: "var(--gc-text-primary)" }}>GRAIL</span>
          <span style={{ color: "var(--gc-brand-gold-500)" }}>CHASER</span>
        </span>
      ) : (
        <span
          className="flex-1"
          style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--gc-text-primary)" }}
        >
          {title}
        </span>
      )}
      {rightSlot}
    </div>
  );
}
