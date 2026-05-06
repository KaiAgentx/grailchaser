"use client";
import type { CSSProperties } from "react";
import type { Game } from "@/lib/types";
import { GAME_DISPLAY_NAME } from "@/lib/games";
import { LoadingSkeleton } from "@/components/atoms/LoadingSkeleton";
import { QuickActionsRow } from "./QuickActionsRow";
import { RecentActivityFeed } from "./RecentActivityFeed";
import { useHomeData } from "@/hooks/useHomeData";

interface Props {
  userId: string;
  activeGame: Game;
  setActiveGame: (g: Game) => void;
  activeShow: { name: string | null } | null;
  onStartOrResumeShow: () => void;
  onQuickCheck: () => void;
  onAddCard: () => void;
  onBatchImport: () => void;
  onCardSelect: (cardId: string) => void;
}

const TCG_GAME_LIST: Game[] = ["pokemon", "mtg", "one_piece"];
const isComingSoon = (g: Game) => g === "mtg" || g === "one_piece";

const PANEL_BG = "linear-gradient(180deg, rgba(18,22,28,0.92) 0%, rgba(10,13,18,0.92) 100%)";
const PANEL_BORDER = "1px solid rgba(255,255,255,0.07)";
const PANEL_SHADOW = "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.02)";
const sectionLabelStyle: CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontWeight: 600,
  fontSize: 18,
  color: "#b5afa6",
  marginBottom: 14,
};

const fmtMoney = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function HomeScreen({ userId, activeGame, setActiveGame, activeShow, onStartOrResumeShow, onQuickCheck, onAddCard, onBatchImport, onCardSelect }: Props) {
  const { cardCount, totalValue, recentlyAdded, recentActivity, loading } = useHomeData(userId, activeGame);
  const gameDisplayName = GAME_DISPLAY_NAME[activeGame] || "TCG";
  const hasData = (cardCount ?? 0) > 0;

  return (
    <div style={{ background: "#060606", minHeight: "100vh", width: "100%", position: "relative", overflow: "hidden", color: "#f4f1ea" }}>
      <style>{`
        .tcg-zero-cta { transition: transform 220ms ease, box-shadow 220ms ease, filter 220ms ease; }
        .tcg-zero-cta:hover { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 14px 32px rgba(146,107,23,0.32), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.10) !important; }
        .tcg-thumbs-row { scrollbar-width: none; -ms-overflow-style: none; }
        .tcg-thumbs-row::-webkit-scrollbar { display: none; }
        .tcg-game-pills::-webkit-scrollbar { display: none; }

        @media (max-width: 720px) {
          .tcg-home-wrapper { padding: 40px 20px 80px !important; }
          .tcg-title { font-size: 30px !important; }
          .tcg-hero { padding: 24px 22px !important; }
          .tcg-hero-number { font-size: 44px !important; }
          .tcg-hero-value { font-size: 22px !important; }
        }

        @media (hover: none) {
          .tcg-zero-cta:hover { transform: none !important; box-shadow: revert !important; filter: none !important; }
          .tcg-zero-cta:active { transform: scale(0.985) !important; transition: transform 120ms ease !important; }
        }
      `}</style>

      <div className="tcg-home-wrapper" style={{ maxWidth: 1040, margin: "0 auto", padding: "6vh 24px 100px", position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Atmosphere layers */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 80% 50% at 50% 25%, rgba(212,175,82,0.07) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(20,15,8,0.35) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.55) 100%)" }} />

        {/* ─── Header (artisanal) ─── */}
        <div style={{ position: "relative", zIndex: 1, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
            <h1 className="tcg-title" style={{
              margin: 0,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 700,
              fontSize: "clamp(32px, 5vw, 44px)",
              letterSpacing: "0.01em",
              lineHeight: 1.05,
              background: "linear-gradient(180deg, #f4f1ea 0%, #c4bfb8 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "#f4f1ea",
            }}>{gameDisplayName}</h1>
          </div>

          {/* Game pills */}
          <div className="tcg-game-pills" style={{ display: "flex", gap: 8, marginTop: 18, marginBottom: 28, flexWrap: "nowrap", paddingTop: 12, paddingBottom: 4 }}>
            {TCG_GAME_LIST.map(g => {
              const isActive = activeGame === g;
              const dimmed = isComingSoon(g);
              return (
                <button
                  key={g}
                  onClick={() => { if (!dimmed) setActiveGame(g); }}
                  disabled={dimmed}
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    padding: "7px 16px",
                    background: dimmed ? "rgba(255,255,255,0.03)" : isActive ? "rgba(212,175,82,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${dimmed ? "rgba(255,255,255,0.08)" : isActive ? "rgba(212,175,82,0.5)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 9999,
                    color: dimmed ? "#5a5a5a" : isActive ? "#e1c46d" : "#a7a19a",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    cursor: dimmed ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {GAME_DISPLAY_NAME[g]}
                  {dimmed && (
                    <span style={{ position: "absolute", top: -6, right: -8, fontSize: 7, fontWeight: 700, letterSpacing: "0.1em", color: "#d1aa48", background: "#060606", border: "1px solid rgba(212,175,82,0.4)", borderRadius: 4, padding: "2px 5px", pointerEvents: "none", textTransform: "uppercase" }}>Soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Show Mode CTA (gc-*, preserved verbatim) ─── */}
        <button
          onClick={onStartOrResumeShow}
          className="font-gc-ui"
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            minHeight: 80,
            marginBottom: 16,
            padding: "16px 20px",
            background: activeShow
              ? "transparent"
              : "color-mix(in srgb, var(--gc-zone-show-500) 12%, var(--gc-bg-surface-1))",
            border: `1.5px solid ${activeShow
              ? "color-mix(in srgb, var(--gc-zone-show-500) 50%, transparent)"
              : "color-mix(in srgb, var(--gc-zone-show-500) 35%, transparent)"}`,
            borderRadius: "var(--gc-radius-lg)",
            color: "var(--gc-text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 14,
            textAlign: "left",
            boxShadow: activeShow ? "none" : "var(--gc-glow-show)",
          }}
        >
          <span style={{ fontSize: 28 }}>{activeShow ? "🎴" : "⚡"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gc-text-primary)", textTransform: "uppercase", letterSpacing: 0.6 }}>
              {activeShow ? "Resume Active Show" : "Start Show Mode"}
            </div>
            <div style={{ fontSize: 12, color: "var(--gc-text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeShow
                ? (activeShow.name || "Untitled show")
                : "Track buys, walks, negotiations"}
            </div>
          </div>
          <span style={{ fontSize: 18, color: "var(--gc-zone-show-500)" }}>→</span>
        </button>

        {/* ─── Quick Actions (gc-*) ─── */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <QuickActionsRow onQuickCheck={onQuickCheck} onAddCard={onAddCard} onBatchImport={onBatchImport} />
        </div>

        {/* ─── Loading state ─── */}
        {loading && (
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ marginBottom: 32 }}>
              <LoadingSkeleton width="100%" height={140} borderRadius={20} />
            </div>
            <div style={{ marginBottom: 32 }}>
              <div style={sectionLabelStyle}>Recent Activity</div>
              <div className="font-gc-ui" style={{ fontSize: 13, color: "var(--gc-text-muted)", padding: "20px 0" }}>
                Loading recent activity…
              </div>
            </div>
          </div>
        )}

        {/* ─── Zero state (artisanal, preserved) ─── */}
        {!loading && !hasData && (
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="tcg-hero" style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: 20, padding: "40px 36px", boxShadow: PANEL_SHADOW, textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.42em", color: "#8a7a4a", textTransform: "uppercase", marginBottom: 14 }}>Get Started</div>
              <h2 style={{ margin: 0, marginBottom: 12, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 28, color: "#f8f5ed", lineHeight: 1.1 }}>
                Build Your {gameDisplayName} Collection
              </h2>
              <div style={{ fontSize: 15, color: "#b5afa6", lineHeight: 1.55, maxWidth: 460, margin: "0 auto 28px" }}>
                Scan your first card to unlock pricing, activity, and collection insights.
              </div>
              <button
                className="tcg-zero-cta"
                onClick={onAddCard}
                style={{
                  height: 52,
                  padding: "0 28px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "linear-gradient(180deg, #d8b14c 0%, #c89a2b 55%, #a67b1f 100%)",
                  color: "#111111",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "0 8px 20px rgba(146,107,23,0.18), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10)",
                }}
              >
                Scan First Card
              </button>
            </div>
            <div style={{ marginTop: 40, textAlign: "center", opacity: 0.6 }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.36em", color: "#8a7a4a", textTransform: "uppercase", marginBottom: 14 }}>Supported Games</div>
              <div style={{ fontSize: 12, color: "#8e887f", lineHeight: 1.8 }}>
                Available now &middot; Pokémon<br/>
                Coming soon &middot; Magic: The Gathering, One Piece
              </div>
            </div>
          </div>
        )}

        {/* ─── Hero summary (artisanal, preserved) ─── */}
        {!loading && hasData && (
          <div className="tcg-hero" style={{ position: "relative", zIndex: 1, background: PANEL_BG, border: PANEL_BORDER, borderRadius: 20, padding: 32, boxShadow: PANEL_SHADOW, marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.42em", color: "#8a7a4a", textTransform: "uppercase", marginBottom: 12 }}>Collection</div>
            <div className="tcg-hero-number" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 48, color: "#f4f1ea", lineHeight: 1, marginBottom: 4, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
              {cardCount}
            </div>
            <div style={{ fontSize: 13, color: "#a7a19a", letterSpacing: "0.04em" }}>cards owned</div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "20px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.28em", color: "#8a7a4a", textTransform: "uppercase" }}>Total Value</span>
              <span className="tcg-hero-value" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 28, color: "#e1c46d" }}>
                {fmtMoney(totalValue)}
              </span>
            </div>
          </div>
        )}

        {/* ─── Recent Activity (gc-*) ─── */}
        {!loading && hasData && recentActivity.length > 0 && (
          <div style={{ position: "relative", zIndex: 1, marginBottom: 32 }}>
            <div style={sectionLabelStyle}>Recent Activity</div>
            <RecentActivityFeed items={recentActivity} onCardTap={onCardSelect} />
          </div>
        )}

        {/* ─── Recently Added (gc-*) ─── */}
        {!loading && hasData && recentlyAdded.length > 0 && (
          <div style={{ position: "relative", zIndex: 1, marginBottom: 32 }}>
            <div style={sectionLabelStyle}>Recently Added</div>
            <div className="tcg-thumbs-row" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
              {recentlyAdded.map(c => (
                <button
                  key={c.id}
                  onClick={() => onCardSelect(c.id)}
                  className="font-gc-ui"
                  style={{
                    flex: "0 0 auto",
                    width: 124,
                    scrollSnapAlign: "start",
                    background: "var(--gc-bg-surface-1)",
                    border: "1px solid var(--gc-border-subtle)",
                    borderRadius: "var(--gc-radius-md)",
                    padding: 10,
                    textAlign: "left",
                    color: "var(--gc-text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {c.scan_image_url ? (
                    <img src={c.scan_image_url} alt={c.player || ""} style={{ width: "100%", height: 144, objectFit: "cover", borderRadius: "var(--gc-radius-sm)", marginBottom: 8, background: "var(--gc-bg-surface-2)" }} />
                  ) : (
                    <div style={{ width: "100%", height: 144, background: "var(--gc-bg-surface-2)", borderRadius: "var(--gc-radius-sm)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--gc-text-muted)" }}>🎴</div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--gc-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.player || "Unknown"}</div>
                  <div style={{ fontSize: 10, color: "var(--gc-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {[c.set, c.card_number].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="font-gc-mono" style={{ fontSize: 12, color: "var(--gc-brand-gold-500)", fontWeight: 700, marginTop: 4 }}>{fmtMoney(Number(c.raw_value) || 0)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
