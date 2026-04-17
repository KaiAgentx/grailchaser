"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { bg, border, accent, muted, secondary, text, font, mono, red } from "./styles";

type Tab = "home" | "myCards" | "scanChooser" | "storage" | "more";

const tabScreenMap: Record<string, Tab> = {
  home: "home", tcgHome: "home", modeSelector: "home",
  myCards: "myCards", cardDetail: "myCards", cardCheck: "scanChooser", cardResult: "scanChooser",
  scanToCollection: "scanChooser", scanChooser: "scanChooser", tcgScanChooser: "scanChooser", tcgScan: "scanChooser", tcgResult: "scanChooser",
  storage: "storage", smartPull: "storage",
  gradeCheck: "storage", gradingReturn: "storage", pickList: "home", lotBuilder: "more", csvImport: "more",
};

interface Props {
  currentScreen: string;
  prevScreen: string;
  onNavigate: (screen: string) => void;
  onSwitchWorld?: () => void;
  currentMode?: string | null;
}

export function BottomNav({ currentScreen, prevScreen, onNavigate, onSwitchWorld, currentMode }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Determine active tab — use prevScreen context for detail screens
  let activeTab: Tab = tabScreenMap[currentScreen] || "home";
  if (currentScreen === "cardDetail") {
    activeTab = tabScreenMap[prevScreen] || "myCards";
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "myCards", label: "Cards", icon: "☰" },
    { id: "scanChooser", label: "Scan", icon: "◎" },
    { id: "storage", label: "Boxes", icon: "▦" },
    { id: "more", label: "More", icon: "•••" },
  ];

  const handleTab = (tab: Tab) => {
    if (tab === "more") {
      setMoreOpen(!moreOpen);
      return;
    }
    setMoreOpen(false);
    onNavigate(tab);
  };

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <>
          <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 98 }} />
          <div style={{ position: "fixed", bottom: 56, left: 0, right: 0, zIndex: 99, display: "flex", justifyContent: "center" }}>
            <div style={{ maxWidth: 500, width: "100%", background: "#111318", borderTop: "1px solid " + border, borderRadius: "16px 16px 0 0", padding: "8px 0", animation: "scaleIn 0.15s ease" }}>
              {onSwitchWorld && (
                <button onClick={() => { setMoreOpen(false); onSwitchWorld(); }} style={{ width: "100%", padding: "14px 24px", background: "none", border: "none", borderBottom: "1px solid " + border, color: text, fontFamily: font, fontSize: 15, fontWeight: 500, cursor: "pointer", textAlign: "left", minHeight: 48 }}>
                  <div>Switch World</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Currently: {currentMode === "tcg" ? "TCG" : "Sports Cards"}</div>
                </button>
              )}
              {[
                { label: "Lot Builder", screen: "lotBuilder" },
                { label: "Import CSV", screen: "csvImport" },
              ].map(item => (
                <button key={item.screen} onClick={() => { setMoreOpen(false); onNavigate(item.screen); }} style={{ width: "100%", padding: "14px 24px", background: "none", border: "none", borderBottom: "1px solid " + border, color: text, fontFamily: font, fontSize: 15, fontWeight: 500, cursor: "pointer", textAlign: "left", minHeight: 48 }}>{item.label}</button>
              ))}
              <button onClick={() => { setMoreOpen(false); handleSignOut(); }} style={{ width: "100%", padding: "14px 24px", background: "none", border: "none", borderTop: "1px solid " + border, color: "#ef4444", fontFamily: font, fontSize: 15, fontWeight: 500, cursor: "pointer", textAlign: "left", minHeight: 48, marginTop: 8 }}>Sign Out</button>
            </div>
          </div>
        </>
      )}

      {/* Tab bar */}
      <style>{`
        @keyframes scanBreathe {
          0%, 100% { opacity: 0.92; transform: scale(1); box-shadow: 0 4px 16px rgba(212,175,82,0.3); }
          50% { opacity: 1; transform: scale(1.015); box-shadow: 0 8px 24px rgba(255,215,0,0.45); }
        }
        .nav-scan-btn { animation: scanBreathe 3.5s ease-in-out infinite; border-radius: 12px; }
      `}</style>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 500, width: "100%", height: 56, background: "rgba(8,9,13,0.95)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderTop: "1px solid " + border, display: "flex", alignItems: "center" }}>
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            const isScan = tab.id === "scanChooser";
            return (
              <button key={tab.id} onClick={() => handleTab(tab.id)} className={isScan ? "nav-scan-btn" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 0", transition: "transform 0.15s" }}>
                <span style={{ fontSize: isScan ? 22 : 18, color: isScan ? accent : active ? accent : muted, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: active ? 10 : 9, color: active ? accent : muted, fontFamily: font, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
