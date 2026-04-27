"use client";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";

interface Props {
  children: ReactNode;
  title: string;
  back?: () => void;
  brandTitle?: boolean;
}

/**
 * Per-screen wrapper. Pairs a TopBar with a content area, vertically.
 *
 * Wrapped INSIDE AppShell — so each screen renders its own Shell for the
 * top bar + content, while AppShell takes care of the persistent BottomNav
 * and outer canvas. The two together = one app frame.
 *
 * Most legacy screens (CardDetail, BatchImportView, etc.) use this. New
 * screens that don't need a Shell-style frame can render TopBar directly.
 */
export function Shell({ children, title, back, brandTitle }: Props) {
  return (
    <div
      className="font-gc-ui"
      style={{
        background: "var(--gc-bg-canvas)",
        color: "var(--gc-text-primary)",
        minHeight: "100vh",
        maxWidth: 500,
        margin: "0 auto",
      }}
    >
      <TopBar title={title} back={back} brandTitle={brandTitle} />
      <div
        style={{
          padding: "0 20px 96px",
          animation: "fadeIn 0.3s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
