"use client";
import type { Game } from "@/lib/types";
import { GAME_DISPLAY_NAME } from "@/lib/games";
import { LoadingSkeleton } from "@/components/atoms/LoadingSkeleton";
import { CollapsibleSection } from "@/components/atoms/CollapsibleSection";
import { TopBrandBar } from "./TopBrandBar";
import { ShowModeBanner } from "./ShowModeBanner";
import { QuickActionsRow } from "./QuickActionsRow";
import { RecentActivityFeed } from "./RecentActivityFeed";
import { CollectionSummaryCard } from "./CollectionSummaryCard";
import { useHomeData } from "@/hooks/useHomeData";

interface Props {
  userId: string;
  activeGame: Game;
  setActiveGame: (g: Game) => void;
  activeShow: { name: string | null } | null;
  /** Total count of TCG boxes for the user (any game). Sourced from useBoxes
   *  in page.tsx so we don't double-fetch — see techdebt note. */
  boxesCount: number;
  onStartOrResumeShow: () => void;
  onQuickCheck: () => void;
  onAddCard: () => void;
  onBatchImport: () => void;
  onCardSelect: (cardId: string) => void;
  /** Routes to the full collection list (myCards). */
  onViewAllCards: () => void;
}

const TCG_GAME_LIST: Game[] = ["pokemon", "mtg", "one_piece"];
const isComingSoon = (g: Game) => g === "mtg" || g === "one_piece";

const fmtMoney = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function HomeScreen({ userId, activeGame, setActiveGame, activeShow, boxesCount, onStartOrResumeShow, onQuickCheck, onAddCard, onBatchImport, onCardSelect, onViewAllCards }: Props) {
  const { cardCount, totalValue, gradedCount, roiPct, avgCardValue, recentlyAdded, recentActivity, loading } = useHomeData(userId, activeGame);
  const gameDisplayName = GAME_DISPLAY_NAME[activeGame] || "TCG";
  const hasData = (cardCount ?? 0) > 0;

  return (
    <div style={{ background: "var(--gc-bg-canvas)", minHeight: "100vh", width: "100%", position: "relative", overflow: "hidden", color: "var(--gc-text-primary)" }}>
      <style>{`
        .home-thumbs-row { scrollbar-width: none; -ms-overflow-style: none; }
        .home-thumbs-row::-webkit-scrollbar { display: none; }
        .home-game-pills::-webkit-scrollbar { display: none; }
        .home-zero-cta { transition: transform 220ms ease, filter 220ms ease; }
        .home-zero-cta:active { transform: scale(0.985); filter: brightness(1.08); }

        @media (max-width: 720px) {
          .home-wrapper { padding: 12px 20px 80px !important; }
          .home-page-title { font-size: 36px !important; }
        }
      `}</style>

      <div className="home-wrapper" style={{ maxWidth: 720, margin: "0 auto", padding: "12px 24px 100px", position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Atmosphere — subtle gold wash behind hero, kept from prior version for warmth */}
        <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 80% 40% at 50% 18%, rgba(212,175,82,0.05) 0%, transparent 60%)" }} />

        {/* ─── Top brand bar ─── */}
        <TopBrandBar activeGame={activeGame} />

        {/* ─── Page title ─── */}
        <div style={{ position: "relative", zIndex: 1, marginBottom: 18 }}>
          <h1 className="home-page-title" style={{
            margin: 0,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 700,
            fontSize: "clamp(36px, 5vw, 44px)",
            letterSpacing: "0.01em",
            lineHeight: 1.05,
            color: "var(--gc-text-primary)",
            textAlign: "center",
          }}>{gameDisplayName}</h1>

          {/* Game pills */}
          <div className="home-game-pills" style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "nowrap", justifyContent: "center", paddingTop: 4, paddingBottom: 4 }}>
            {TCG_GAME_LIST.map(g => {
              const isActive = activeGame === g;
              const dimmed = isComingSoon(g);
              return (
                <button
                  key={g}
                  onClick={() => { if (!dimmed) setActiveGame(g); }}
                  disabled={dimmed}
                  className="font-gc-ui"
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    padding: "7px 16px",
                    background: dimmed ? "rgba(255,255,255,0.03)" : isActive ? "color-mix(in srgb, var(--gc-brand-gold-500) 14%, transparent)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${dimmed ? "rgba(255,255,255,0.08)" : isActive ? "color-mix(in srgb, var(--gc-brand-gold-500) 50%, transparent)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 9999,
                    color: dimmed ? "rgba(255,255,255,0.3)" : isActive ? "var(--gc-brand-gold-500)" : "var(--gc-text-muted)",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    cursor: dimmed ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {GAME_DISPLAY_NAME[g]}
                  {dimmed && (
                    <span style={{ position: "absolute", top: -6, right: -8, fontSize: 7, fontWeight: 700, letterSpacing: "0.1em", color: "var(--gc-brand-gold-500)", background: "var(--gc-bg-canvas)", border: "1px solid color-mix(in srgb, var(--gc-brand-gold-500) 45%, transparent)", borderRadius: 4, padding: "2px 5px", pointerEvents: "none", textTransform: "uppercase" }}>Soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Show Mode banner (dramatic) ─── */}
        <div style={{ position: "relative", zIndex: 1, marginTop: 16 }}>
          <ShowModeBanner activeShow={activeShow} onClick={onStartOrResumeShow} />
        </div>

        {/* ─── Quick Actions ─── */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <QuickActionsRow onQuickCheck={onQuickCheck} onAddCard={onAddCard} onBatchImport={onBatchImport} />
        </div>

        {/* ─── Loading state ─── */}
        {loading && (
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ marginBottom: 24 }}>
              <LoadingSkeleton width="100%" height={160} borderRadius={16} />
            </div>
            <div className="font-gc-ui" style={{ fontSize: 13, color: "var(--gc-text-muted)", padding: "12px 0" }}>
              Loading recent activity…
            </div>
          </div>
        )}

        {/* ─── Zero state ─── */}
        {!loading && !hasData && (
          <div style={{ position: "relative", zIndex: 1, background: "var(--gc-bg-surface-1)", border: "1px solid var(--gc-border-subtle)", borderRadius: 16, padding: "36px 28px", textAlign: "center", marginBottom: 24 }}>
            <div className="font-gc-ui" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: "var(--gc-brand-gold-500)", textTransform: "uppercase", marginBottom: 12 }}>Get Started</div>
            <h2 style={{ margin: 0, marginBottom: 10, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 26, color: "var(--gc-text-primary)", lineHeight: 1.15 }}>
              Build Your {gameDisplayName} Collection
            </h2>
            <div className="font-gc-ui" style={{ fontSize: 14, color: "var(--gc-text-muted)", lineHeight: 1.5, maxWidth: 420, margin: "0 auto 20px" }}>
              Scan your first card to unlock pricing, activity, and collection insights.
            </div>
            <button
              className="home-zero-cta font-gc-ui"
              onClick={onAddCard}
              style={{
                height: 48,
                padding: "0 24px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(180deg, #d8b14c 0%, #b78935 100%)",
                color: "#111",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(146,107,23,0.25)",
              }}
            >
              Scan First Card
            </button>
          </div>
        )}

        {/* ─── Collection summary (structured) ─── */}
        {!loading && hasData && (
          <div style={{ position: "relative", zIndex: 1 }}>
            <CollectionSummaryCard
              cardCount={cardCount ?? 0}
              totalValue={totalValue}
              gradedCount={gradedCount}
              boxesCount={boxesCount}
              roi={roiPct}
              avgCardValue={avgCardValue}
            />
          </div>
        )}

        {/* ─── Recent activity (collapsible, default expanded) ─── */}
        {!loading && hasData && recentActivity.length > 0 && (
          <div style={{ position: "relative", zIndex: 1, marginBottom: 28 }}>
            <CollapsibleSection label="Recent Activity" storageKey="home_recent_activity_collapsed" defaultExpanded={true}>
              <RecentActivityFeed items={recentActivity} onCardTap={onCardSelect} />
            </CollapsibleSection>
          </div>
        )}

        {/* ─── Recently added (with View all link) ─── */}
        {!loading && hasData && recentlyAdded.length > 0 && (
          <div style={{ position: "relative", zIndex: 1, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className="font-gc-ui" style={{ fontSize: 11, fontWeight: 600, color: "var(--gc-brand-gold-500)", textTransform: "uppercase", letterSpacing: 1.5 }}>
                Recently Added
              </span>
              <button
                onClick={onViewAllCards}
                className="font-gc-ui"
                style={{ background: "transparent", border: "none", color: "var(--gc-text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 4 }}
              >
                View all ›
              </button>
            </div>
            <div className="home-thumbs-row" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory" }}>
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
                    borderRadius: 12,
                    padding: 10,
                    textAlign: "left",
                    color: "var(--gc-text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {c.scan_image_url ? (
                    <img src={c.scan_image_url} alt={c.player || ""} style={{ width: "100%", aspectRatio: "5 / 7", objectFit: "cover", borderRadius: 8, marginBottom: 8, background: "var(--gc-bg-surface-2)" }} />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "5 / 7", background: "var(--gc-bg-surface-2)", borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "var(--gc-text-muted)" }}>🎴</div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gc-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.player || "Unknown"}</div>
                  <div style={{ fontSize: 11, color: "var(--gc-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {[c.set, c.card_number].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="font-gc-mono" style={{ fontSize: 13, color: "var(--gc-brand-gold-500)", fontWeight: 700, marginTop: 4 }}>{fmtMoney(Number(c.raw_value) || 0)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
