"use client";
import { bg, text, border, muted, accent, font } from "./styles";

export function Shell({ children, title, back, brandTitle }: { children: React.ReactNode; title: string; back?: () => void; brandTitle?: boolean }) {
  return (
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", maxWidth: 500, margin: "0 auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,9,13,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid " + border, padding: "0 20px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        {back && <button onClick={back} style={{ background: "none", border: "none", color: muted, fontSize: 18, cursor: "pointer", padding: "8px 4px", lineHeight: 1 }}>←</button>}
        {brandTitle ? (
          <span style={{ flex: 1, fontSize: 18, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>
            <span style={{ color: accent, opacity: 0.7, marginRight: 4 }}>♦</span>
            <span style={{ color: text }}>GRAIL</span>
            <span style={{ color: accent }}>CHASER</span>
          </span>
        ) : (
          <span style={{ flex: 1, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</span>
        )}
      </div>
      <div style={{ padding: "0 20px 100px", animation: "fadeIn 0.3s ease" }}>{children}</div>
    </div>
  );
}
