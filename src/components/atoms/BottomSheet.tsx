"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";

/**
 * BottomSheet — slide-up modal panel anchored to the bottom of the viewport.
 *
 * Implementation: position-fixed (no React Portal). Backdrop scrim + sheet
 * panel. Tapping the scrim or pressing Escape calls onClose.
 *
 * Designed for StartShowModal, EndShowModal, NegotiateModal, and other
 * Phase B-ui-1 modals that don't need full-screen take-over.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional label for accessibility. */
  ariaLabel?: string;
}

export function BottomSheet({ open, onClose, children, ariaLabel }: Props) {
  // Esc-to-close
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--gc-overlay-scrim)",
          zIndex: 300,
          animation: "gcScrimEnter var(--gc-duration-fast) var(--gc-ease-enter)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 500,
          background: "var(--gc-bg-surface-1)",
          borderTopLeftRadius: "var(--gc-radius-lg)",
          borderTopRightRadius: "var(--gc-radius-lg)",
          borderTop: "1px solid var(--gc-border-subtle)",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: 301,
          boxShadow: "var(--gc-shadow-lg)",
          animation: "gcSheetEnter var(--gc-duration-emphasis) var(--gc-ease-enter)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "var(--gc-border-strong)",
            borderRadius: "var(--gc-radius-pill)",
            margin: "10px auto 0",
          }}
        />
        {children}
      </div>
    </>
  );
}
