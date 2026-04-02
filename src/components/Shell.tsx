"use client";
import { bg, text, border, muted, font } from "./styles";

export function Shell({ children, title, back, brandTitle }: { children: React.ReactNode; title: string; back?: () => void; brandTitle?: boolean }) {
  return (
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: bg, borderBottom: "1px solid " + border, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        {back && <button onClick={back} style={{ background: "none", border: "none", color: muted, fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>}
        {brandTitle ? <span style={{ flex: 1, fontSize: 20, fontWeight: 800, fontStyle: "italic", letterSpacing: "-0.01em", background: "linear-gradient(135deg, #c9a227, #f6e27a, #c9a227)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{title}</span> : <span style={{ flex: 1, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</span>}
      </div>
      <div style={{ padding: "0 20px 100px" }}>{children}</div>
    </div>
  );
}
