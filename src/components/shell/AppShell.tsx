"use client";
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface Props {
  /** Current Screen state value from page.tsx. Drives active-tab highlight. */
  currentScreen: string;
  /** Previous Screen value — used so detail screens (cardDetail) keep their parent tab active. */
  prevScreen: string;
  /** Tab-tap handler. Called with the destination Screen value. */
  onNavigate: (screen: string) => void;
  /** The current screen's rendered content. */
  children: ReactNode;
}

/**
 * App-wide outer frame.
 *
 * Renders the active screen's content above a persistent BottomNav.
 * Sits at the top of every authed render path in page.tsx — wraps each
 * branch's screen content. Per-screen top bars come from <Shell> or
 * <TopBar> inside the children.
 *
 * Pads the bottom of the content area to clear the fixed BottomNav
 * (--gc-touch-target-min × roughly 1.5) plus safe-area-inset-bottom
 * for iOS home-indicator clearance.
 */
export function AppShell({ currentScreen, prevScreen, onNavigate, children }: Props) {
  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--gc-bg-canvas)",
          color: "var(--gc-text-primary)",
          paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
      <BottomNav
        currentScreen={currentScreen}
        prevScreen={prevScreen}
        onNavigate={onNavigate}
      />
    </>
  );
}
