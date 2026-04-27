"use client";
import { Shell } from "../shell/Shell";

/**
 * Search tab stub. Real search lands in B-ui-2 (SetBrowser, SetDetail).
 * For B-ui-1 we render a "Coming soon" empty state to occupy the route.
 */
export function SearchScreen() {
  return (
    <Shell title="Search">
      <div style={{ paddingTop: 80, textAlign: "center", color: "var(--gc-text-muted)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--gc-text-secondary)", marginBottom: 8 }}>
          Coming soon
        </div>
        <div style={{ fontSize: 13, maxWidth: 280, margin: "0 auto" }}>
          Browse Pokémon sets and individual cards. Lands in the next UI phase.
        </div>
      </div>
    </Shell>
  );
}
