"use client";
import { useState, useEffect, type ReactNode } from "react";

interface Props {
  /** Uppercase label for the section header. */
  label: string;
  /** Optional localStorage key to persist collapsed state across mounts. */
  storageKey?: string;
  /** Initial expanded state when no localStorage value exists. Defaults true. */
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * CollapsibleSection — uppercase label header with chevron toggle and
 * collapsible body. Header style matches the gold/letter-spaced section
 * pattern used across home/show-mode screens.
 *
 * Persists state via localStorage when storageKey is provided. SSR-safe:
 * initial state defaults to defaultExpanded; localStorage is read in an
 * effect on mount (small FOUC if collapsed-on-load, acceptable trade-off
 * for SSR cleanliness).
 */
export function CollapsibleSection({ label, storageKey, defaultExpanded = true, children }: Props) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "true") setExpanded(true);
      else if (stored === "false") setExpanded(false);
    } catch { /* localStorage may throw in private mode; ignore */ }
  }, [storageKey]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (storageKey && typeof window !== "undefined") {
      try { window.localStorage.setItem(storageKey, String(next)); } catch { /* ignore */ }
    }
  };

  return (
    <div>
      <button
        onClick={toggle}
        aria-expanded={expanded}
        className="font-gc-ui"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          padding: 0,
          marginBottom: 12,
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gc-brand-gold-500)", textTransform: "uppercase", letterSpacing: 1.5 }}>
          {label}
        </span>
        <span style={{ color: "var(--gc-text-muted)", display: "inline-flex", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 180ms ease" }} aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {expanded && children}
    </div>
  );
}
