"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCards } from "@/hooks/useCards";
import { useBoxes } from "@/hooks/useBoxes";
import { useActiveGame } from "@/hooks/useActiveGame";
import { DEFAULT_BOX_NAME, GAME_DISPLAY_NAME } from "@/lib/games";
import type { Game } from "@/lib/types";
import { LoginScreen } from "@/components/LoginScreen";
import { Shell } from "@/components/Shell";
import { BottomNav } from "@/components/BottomNav";
import { StorageView } from "@/components/StorageView";
import { CardDetail } from "@/components/CardDetail";
import { ScanScreen } from "@/components/ScanScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { WatchlistView } from "@/components/WatchlistView";
import { BatchImportView } from "@/components/BatchImportView";
import { TierBreakdownView } from "@/components/TierBreakdownView";
import { createClient } from "@/lib/supabase";
import { TierBadge } from "@/components/TierBadge";
import { TIER_RANK, type Tier } from "@/lib/utils";
import { bg, surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "@/components/styles";

type Screen = "home" | "myCards" | "cardDetail" | "storage" | "scanChooser" | "scan" | "result" | "watchlist" | "batchImport" | "tierBreakdown";

export default function Home() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { activeGame, setActiveGame, hydrated: gameHydrated } = useActiveGame();
  const { cards, loading, addCard, updateCardPrice, updateCard, deleteCard, markListed, markSold, markShipped } = useCards(user?.id, activeGame);
  const { boxes, loading: boxesLoading, addBox, updateBox, deleteBox, getNextPosition: getBoxNextPosition, getBoxCards } = useBoxes(user?.id, cards);

  const [screen, setScreen] = useState<Screen>("home");
  const [scanIntent, setScanIntent] = useState<"check" | "collect">("check");
  const [recognizeResult, setRecognizeResult] = useState<any>(null);
  const [pendingFront, setPendingFront] = useState<File | null>(null);
  const [pendingBack, setPendingBack] = useState<Blob | null>(null);
  const [tierBreakdownScope, setTierBreakdownScope] = useState<{ cardIds: string[]; label: string } | null>(null);
  const [tcgCardCount, setTcgCardCount] = useState<number | null>(null);
  const [tcgTotalValue, setTcgTotalValue] = useState<number>(0);
  const [tcgRecentActivity, setTcgRecentActivity] = useState<any[]>([]);
  const [tcgRecentlyAdded, setTcgRecentlyAdded] = useState<any[]>([]);
  const [tcgHomeLoading, setTcgHomeLoading] = useState(true);

  // Clear any pending front/back captures whenever we (re-)enter the scan screen.
  // Prevents a leftover blob from a prior collect scan polluting a quick check.
  useEffect(() => {
    if (screen === "scan") {
      setPendingFront(null);
      setPendingBack(null);
    }
  }, [screen]);

  // ─── Home data fetch ───
  useEffect(() => {
    if (screen !== "home" || !user || !activeGame) return;
    let cancelled = false;
    setTcgHomeLoading(true);
    const supabase = createClient();
    (async () => {
      try {
        const [statsRes, recentlyAddedRes, activityRes] = await Promise.allSettled([
          supabase.from("cards").select("id, raw_value", { count: "exact" }).eq("user_id", user.id).eq("game", activeGame),
          supabase.from("cards").select("id, player, set, card_number, raw_value, scan_image_url, created_at").eq("user_id", user.id).eq("game", activeGame).order("created_at", { ascending: false }).limit(5),
          supabase.from("scan_results").select("id, catalog_match_name, final_catalog_name, created_at").eq("user_id", user.id).eq("game", activeGame).order("created_at", { ascending: false }).limit(5),
        ]);
        if (cancelled) return;

        if (statsRes.status === "fulfilled") {
          const statsRows: any[] = statsRes.value.data || [];
          setTcgCardCount(statsRes.value.count ?? statsRows.length);
          setTcgTotalValue(statsRows.reduce((s, r) => s + (Number(r.raw_value) || 0), 0));
        } else {
          console.error("[home] stats query failed:", statsRes.reason);
          setTcgCardCount(0);
          setTcgTotalValue(0);
        }

        if (recentlyAddedRes.status === "fulfilled") {
          setTcgRecentlyAdded(recentlyAddedRes.value.data || []);
        } else {
          console.error("[home] recently added query failed:", recentlyAddedRes.reason);
          setTcgRecentlyAdded([]);
        }

        if (activityRes.status === "fulfilled") {
          setTcgRecentActivity(activityRes.value.data || []);
        } else {
          console.error("[home] activity query failed:", activityRes.reason);
          setTcgRecentActivity([]);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[home] data fetch threw:", err);
        setTcgCardCount(0);
        setTcgTotalValue(0);
        setTcgRecentlyAdded([]);
        setTcgRecentActivity([]);
      } finally {
        if (!cancelled) setTcgHomeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [screen, activeGame, user?.id]);

  // Auto-create default box if none exist
  const [boxCreated, setBoxCreated] = useState(false);
  useEffect(() => {
    if (screen !== "home" || !user || !gameHydrated || boxCreated || boxesLoading) return;
    if (boxes.length > 0) return;
    setBoxCreated(true);
    addBox(DEFAULT_BOX_NAME[activeGame], 1, 100, "singles");
  }, [screen, user, gameHydrated, boxes, boxCreated, boxesLoading, activeGame, addBox]);

  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [prevScreen, setPrevScreen] = useState<string>("home");
  const [prevScreenData, setPrevScreenData] = useState<any>(null);
  const [storageInitialBox, setStorageInitialBox] = useState("");

  const goToCardDetail = (card: any, fromScreen: string, fromData?: any) => {
    setSelectedCard(card);
    setPrevScreen(fromScreen);
    setPrevScreenData(fromData || null);
    setScreen("cardDetail");
  };
  const goBackFromDetail = () => {
    if (prevScreen === "storage" && prevScreenData?.boxName) {
      setStorageInitialBox(prevScreenData.boxName);
    }
    setScreen(prevScreen as Screen);
  };

  const [search, setSearch] = useState("");
  const [filterGame, setFilterGame] = useState<"All" | Game>("All");
  const [sortBy, setSortBy] = useState("value");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredCards = (statusFilter === "pending" ? cards.filter(c => !c.storage_box || c.storage_box === "PENDING") : statusFilter ? cards.filter(c => c.status === statusFilter) : cards.filter(c => !c.sold))
    .filter(c => filterGame === "All" || (c as any).game === filterGame)
    .filter(c => !search || c.player.toLowerCase().includes(search.toLowerCase()) || c.brand.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortBy === "value" ? b.raw_value - a.raw_value :
      sortBy === "recent" ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() :
      sortBy === "name" ? a.player.localeCompare(b.player) :
      sortBy === "tier" ? (TIER_RANK[(a.tier ?? "Unpriced") as Tier] ?? 4) - (TIER_RANK[(b.tier ?? "Unpriced") as Tier] ?? 4) :
      ((a.storage_box || "ZZZ").localeCompare(b.storage_box || "ZZZ") || (a.storage_position || 0) - (b.storage_position || 0))
    );

  // Auth loading
  if (authLoading) return (
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          <span style={{ color: accent, opacity: 0.7 }}>♦ </span>
          <span style={{ background: "linear-gradient(135deg, " + accent + ", #e8c66a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>GRAILCHASER</span>
        </div>
        <div style={{ fontSize: 13, color: muted }}>Loading...</div>
      </div>
    </div>
  );

  if (!user) return <LoginScreen signIn={signIn} signUp={signUp} />;

  if (!gameHydrated) return (
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 13, color: muted }}>Loading...</div>
    </div>
  );

  // Bottom nav handler
  const handleBottomNav = (s: string) => {
    if (s === "scanChooser") setScreen("scanChooser");
    else if (s === "home") setScreen("home");
    else if (s === "myCards") { setStatusFilter(""); setScreen("myCards"); }
    else if (s === "storage") { setStorageInitialBox(""); setScreen("storage"); }
    else setScreen(s as Screen);
  };

  const bottomNav = <BottomNav currentScreen={screen} prevScreen={prevScreen} onNavigate={handleBottomNav} />;

  // ─── HOME (TCG dashboard) ───
  if (screen === "home") {
    const gameDisplayName = GAME_DISPLAY_NAME[activeGame] || "TCG";
    const hasData = (tcgCardCount ?? 0) > 0;
    const fmtMoney = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtRelative = (iso: string) => {
      const ms = Date.now() - new Date(iso).getTime();
      const m = Math.floor(ms / 60000);
      if (m < 1) return "just now";
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const d = Math.floor(h / 24);
      if (d < 7) return `${d}d ago`;
      return new Date(iso).toLocaleDateString();
    };
    const PANEL_BG = "linear-gradient(180deg, rgba(18,22,28,0.92) 0%, rgba(10,13,18,0.92) 100%)";
    const PANEL_BORDER = "1px solid rgba(255,255,255,0.07)";
    const PANEL_SHADOW = "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.02)";
    const sectionLabelStyle: React.CSSProperties = {
      fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: 18, color: "#b5afa6", marginBottom: 14,
    };
    const TCG_GAME_LIST: Game[] = ["pokemon", "mtg", "one_piece"];
    const isComingSoon = (g: Game) => g === "mtg" || g === "one_piece";

    return (
      <>
        <div style={{ background: "#060606", minHeight: "100vh", width: "100%", position: "relative", overflow: "hidden", color: "#f4f1ea", fontFamily: font }}>
          <style>{`
            .tcg-action-btn { transition: border-color 220ms ease, color 220ms ease, background 220ms ease; }
            .tcg-action-btn:hover { border-color: rgba(212,175,82,0.4) !important; color: #e1c46d !important; }
            .tcg-activity-row { transition: background 220ms ease; }
            .tcg-activity-row:hover { background: rgba(255,255,255,0.025) !important; }
            .tcg-thumb-card { transition: transform 220ms ease, border-color 220ms ease; cursor: pointer; }
            .tcg-thumb-card:hover { transform: translateY(-2px); border-color: rgba(212,175,82,0.4) !important; }
            .tcg-zero-cta { transition: transform 220ms ease, box-shadow 220ms ease, filter 220ms ease; }
            .tcg-zero-cta:hover { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 14px 32px rgba(146,107,23,0.32), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.10) !important; }
            .tcg-thumbs-row { scrollbar-width: none; -ms-overflow-style: none; }
            .tcg-thumbs-row::-webkit-scrollbar { display: none; }
            .tcg-game-pills::-webkit-scrollbar { display: none; }

            @media (max-width: 720px) {
              .tcg-home-wrapper { padding: 40px 20px 80px !important; }
              .tcg-title { font-size: 30px !important; }
              .tcg-overline { font-size: 9px !important; letter-spacing: 0.36em !important; }
              .tcg-quick-actions { gap: 10px !important; }
              .tcg-action-btn { padding: 14px 8px !important; }
              .tcg-action-label { font-size: 9px !important; }
              .tcg-hero { padding: 24px 22px !important; }
              .tcg-hero-number { font-size: 44px !important; }
              .tcg-hero-value { font-size: 22px !important; }
            }

            @media (hover: none) {
              .tcg-action-btn:hover, .tcg-activity-row:hover, .tcg-thumb-card:hover, .tcg-zero-cta:hover {
                background: revert !important;
                border-color: revert !important;
                color: revert !important;
                transform: none !important;
                box-shadow: revert !important;
                filter: none !important;
              }
              .tcg-action-btn:active, .tcg-thumb-card:active, .tcg-zero-cta:active {
                transform: scale(0.985) !important;
                transition: transform 120ms ease !important;
              }
            }
          `}</style>

          <div className="tcg-home-wrapper" style={{ maxWidth: 1040, margin: "0 auto", padding: "6vh 24px 100px", position: "relative", display: "flex", flexDirection: "column" }}>
            {/* Atmosphere layers */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 80% 50% at 50% 25%, rgba(212,175,82,0.07) 0%, transparent 60%)" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(20,15,8,0.35) 0%, transparent 70%)" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.55) 100%)" }} />

            {/* ─── Header ─── */}
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
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span aria-hidden="true" title="Search coming soon" style={{ color: "#6a655e", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                </div>
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
                        fontFamily: font,
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

            {/* ─── Quick Actions ─── */}
            <div className="tcg-quick-actions" style={{ position: "relative", zIndex: 1, display: "flex", gap: 12, marginBottom: 32 }}>
              {[
                { label: "Quick Check", onClick: () => { setScanIntent("check"); setScreen("scan"); }, icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                ) },
                { label: "Add Card", onClick: () => { setScanIntent("collect"); setScreen("scan"); }, icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                ) },
                { label: "Search", onClick: () => console.log("search"), icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                ) },
              ].map((a, i) => (
                <button
                  key={i}
                  className="tcg-action-btn"
                  onClick={a.onClick}
                  style={{
                    flex: 1,
                    minHeight: 96,
                    background: "rgba(12,15,20,0.85)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 14,
                    color: "#c4bfb8",
                    fontFamily: font,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0,
                    padding: "16px 12px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(180deg, rgba(212,175,82,0.12) 0%, rgba(212,175,82,0.04) 100%)",
                    border: "1px solid rgba(212,175,82,0.25)",
                    boxShadow: "inset 0 1px 0 rgba(212,175,82,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#d4af52",
                    marginBottom: 10,
                  }}>
                    {a.icon}
                  </div>
                  <span className="tcg-action-label" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center" }}>{a.label}</span>
                </button>
              ))}
            </div>

            {/* ─── Loading skeleton ─── */}
            {tcgHomeLoading && (
              <div style={{ position: "relative", zIndex: 1, padding: "60px 0", textAlign: "center", color: "#5a5a5a", fontSize: 13 }}>
                Loading collection…
              </div>
            )}

            {/* ─── Zero state ─── */}
            {!tcgHomeLoading && !hasData && (
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
                    onClick={() => { setScanIntent("collect"); setScreen("scan"); }}
                    style={{
                      height: 52,
                      padding: "0 28px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "linear-gradient(180deg, #d8b14c 0%, #c89a2b 55%, #a67b1f 100%)",
                      color: "#111111",
                      fontFamily: font,
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
                  <div style={{ fontFamily: font, fontSize: 12, color: "#8e887f", lineHeight: 1.8 }}>
                    Available now &middot; Pokémon<br/>
                    Coming soon &middot; Magic: The Gathering, One Piece
                  </div>
                </div>
              </div>
            )}

            {/* ─── Hero summary (populated) ─── */}
            {!tcgHomeLoading && hasData && (
              <div className="tcg-hero" style={{ position: "relative", zIndex: 1, background: PANEL_BG, border: PANEL_BORDER, borderRadius: 20, padding: 32, boxShadow: PANEL_SHADOW, marginBottom: 32 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.42em", color: "#8a7a4a", textTransform: "uppercase", marginBottom: 12 }}>Collection</div>
                <div className="tcg-hero-number" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 48, color: "#f4f1ea", lineHeight: 1, marginBottom: 4, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                  {tcgCardCount}
                </div>
                <div style={{ fontSize: 13, color: "#a7a19a", letterSpacing: "0.04em" }}>cards owned</div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "20px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.28em", color: "#8a7a4a", textTransform: "uppercase" }}>Total Value</span>
                  <span className="tcg-hero-value" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 28, color: "#e1c46d" }}>
                    {fmtMoney(tcgTotalValue)}
                  </span>
                </div>
              </div>
            )}

            {/* ─── Recent Activity ─── */}
            {!tcgHomeLoading && hasData && tcgRecentActivity.length > 0 && (
              <div style={{ position: "relative", zIndex: 1, marginBottom: 32 }}>
                <div style={sectionLabelStyle}>Recent Activity</div>
                <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: 16, boxShadow: PANEL_SHADOW, overflow: "hidden" }}>
                  {tcgRecentActivity.map((a, idx) => {
                    const name = a.catalog_match_name || a.final_catalog_name || "Unknown card";
                    return (
                      <div
                        key={a.id || idx}
                        className="tcg-activity-row"
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: idx < tcgRecentActivity.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", gap: 12 }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: "#f4f1ea", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                          <div style={{ fontSize: 11, color: "#8a847d", letterSpacing: "0.02em" }}>checked</div>
                        </div>
                        <div style={{ fontSize: 11, color: "#8a847d", flexShrink: 0 }}>{fmtRelative(a.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Recently Added ─── */}
            {!tcgHomeLoading && hasData && tcgRecentlyAdded.length > 0 && (
              <div style={{ position: "relative", zIndex: 1, marginBottom: 32 }}>
                <div style={sectionLabelStyle}>Recently Added</div>
                <div className="tcg-thumbs-row" style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
                  {tcgRecentlyAdded.map(c => (
                    <button
                      key={c.id}
                      className="tcg-thumb-card"
                      onClick={() => goToCardDetail(c, "home")}
                      style={{
                        flex: "0 0 auto",
                        width: 120,
                        background: "rgba(12,15,20,0.85)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 12,
                        padding: 10,
                        textAlign: "left",
                        color: "#f4f1ea",
                        fontFamily: font,
                      }}
                    >
                      {c.scan_image_url ? (
                        <img src={c.scan_image_url} alt={c.player || ""} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, marginBottom: 8, background: "#151a21" }} />
                      ) : (
                        <div style={{ width: "100%", height: 140, background: "#151a21", borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#3a3a44" }}>🎴</div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f4f1ea", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.player || "Unknown"}</div>
                      <div style={{ fontSize: 10, color: "#8a847d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                        {[c.set, c.card_number].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#e1c46d", fontWeight: 600, marginTop: 4 }}>{fmtMoney(Number(c.raw_value) || 0)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {bottomNav}
      </>
    );
  }

  // ─── SCAN ───
  if (screen === "scan") return (
    <><ScanScreen
      game={activeGame}
      scanIntent={scanIntent}
      onBack={() => setScreen("home")}
      onResult={(result, intent) => { setRecognizeResult(result); setScanIntent(intent); setScreen("result"); }}
      onFrontCaptured={(front) => setPendingFront(front)}
      onBackCaptured={(back) => setPendingBack(back)}
    />{bottomNav}</>
  );

  // ─── RESULT ───
  if (screen === "result" && recognizeResult) return (
    <><ResultScreen
      result={recognizeResult}
      scanIntent={scanIntent}
      onBack={() => setScreen("scan")}
      onSaved={() => setScreen("home")}
      onScanAnother={() => { setRecognizeResult(null); setScreen("scan"); }}
      userId={user?.id || ""}
      scanResultId={recognizeResult?.scan_result_id}
      rank1CatalogCardId={recognizeResult?.result?.candidates?.[0]?.catalogCardId}
      boxes={boxes}
      addBox={addBox}
      addCard={addCard}
      pendingFront={pendingFront}
      pendingBack={pendingBack}
    />{bottomNav}</>
  );

  // ─── SCAN CHOOSER ───
  if (screen === "scanChooser") return (
    <>
      <Shell title="What are you doing?" back={() => setScreen("home")}>
        <div style={{ paddingTop: 24 }}>
          <button onClick={() => { setScanIntent("check"); setScreen("scan"); }} style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 16, padding: "24px 20px", cursor: "pointer", textAlign: "left", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 4 }}>Quick Check</div>
            <div style={{ fontSize: 13, color: secondary }}>Evaluate a card before buying</div>
          </button>
          <button onClick={() => { setScanIntent("collect"); setScreen("scan"); }} style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 16, padding: "24px 20px", cursor: "pointer", textAlign: "left", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 4 }}>Scan to Collection</div>
            <div style={{ fontSize: 13, color: secondary }}>Log cards you already own</div>
          </button>
        </div>
      </Shell>
      {bottomNav}
    </>
  );

  // ─── MY CARDS ───
  if (screen === "myCards") return (<>
    <Shell title={"My Cards (" + filteredCards.length + ")"} back={() => { setStatusFilter(""); setFilterGame("All"); setScreen("home"); }}>
      <div style={{ paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder="Search player, brand..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "8px 12px", color: secondary, fontFamily: font, fontSize: 12, outline: "none", cursor: "pointer" }}>
            <option value="value">Value ↓</option>
            <option value="tier">Tier</option>
            <option value="recent">Recent</option>
            <option value="name">Name A-Z</option>
            <option value="box">Box</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
          {(["All", "pokemon", "mtg", "one_piece"] as const).map(s => {
            const chipLabel = s === "All" ? "All" : (GAME_DISPLAY_NAME[s as Game] || s);
            return (
              <button key={s} onClick={() => { setFilterGame(s as "All" | Game); if (statusFilter === "pending") setStatusFilter(""); }} style={{ padding: "6px 14px", background: filterGame === s ? accent + "20" : surface2, border: "1px solid " + (filterGame === s ? accent + "50" : border), borderRadius: 20, color: filterGame === s ? accent : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{chipLabel}</button>
            );
          })}
          <button onClick={() => setStatusFilter(statusFilter === "pending" ? "" : "pending")} style={{ padding: "6px 14px", background: statusFilter === "pending" ? red + "20" : surface2, border: "1px solid " + (statusFilter === "pending" ? red + "50" : border), borderRadius: 20, color: statusFilter === "pending" ? red : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Unassigned</button>
        </div>
        {loading && <div style={{ textAlign: "center", color: muted, padding: 40 }}>Loading...</div>}
        {!loading && filteredCards.length === 0 && (<div style={{ textAlign: "center", color: muted, padding: 40 }}><div style={{ fontSize: 36, marginBottom: 12 }}>🎴</div><div style={{ fontSize: 14 }}>No cards yet. Tap Scan to add your first card.</div></div>)}
        {filteredCards.map(card => (
          <button key={card.id} onClick={() => goToCardDetail(card, "myCards")} style={{ width: "100%", background: surface, borderLeft: "3px solid " + accent, borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 12, padding: "14px 16px", marginBottom: 6, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: text }}>{card.player}</div>
              <div style={{ fontSize: 12, color: secondary, marginTop: 2 }}>{card.year} {card.brand} {card.parallel !== "Base" ? card.parallel : ""} {card.card_number}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                <TierBadge tier={card.tier} size="sm" />
                {card.storage_box && card.storage_box !== "PENDING" ? <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 9999, background: "rgba(255,255,255,0.06)", color: muted }}>{card.storage_box} #{card.storage_position}</span> : <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 9999, background: "rgba(248,113,113,0.1)", color: red, fontWeight: 600 }}>No Box</span>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}><div style={{ fontFamily: mono, fontSize: 15, fontWeight: 600, color: green }}>${card.raw_value}</div><div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{card.status}</div></div>
          </button>
        ))}
      </div>
    </Shell>
    {bottomNav}</>
  );

  // ─── STORAGE ───
  if (screen === "storage") return <><StorageView cards={cards} boxes={boxes} initialBoxName={storageInitialBox} onBack={() => { setStorageInitialBox(""); setScreen("home"); }} addBox={addBox} updateBox={updateBox} deleteBox={deleteBox} updateCard={updateCard} updateCardPrice={updateCardPrice} onCardTap={(card, boxName) => goToCardDetail(card, "storage", { boxName })} onNavigate={(t: any) => {
    if (t.screen === "tierBreakdown" && t.boxName) {
      const boxCards = getBoxCards(t.boxName);
      setTierBreakdownScope({ cardIds: boxCards.map(c => c.id), label: t.boxName });
      setScreen("tierBreakdown");
    } else {
      setScreen(t.screen as Screen);
    }
  }} getNextPosition={getBoxNextPosition} getBoxCards={getBoxCards} />{bottomNav}</>;

  // ─── WATCHLIST ───
  if (screen === "watchlist") return (
    <><WatchlistView cards={cards.filter(c => c.is_watched === true)} onBack={() => setScreen("home")} onCardTap={(card) => goToCardDetail(card, "watchlist")} updateCardPrice={updateCardPrice} />{bottomNav}</>
  );

  // ─── BATCH IMPORT ───
  if (screen === "batchImport") return (
    <><BatchImportView boxes={boxes} userId={user?.id || ""} onBack={() => setScreen("home")} addCard={addCard} onDone={(savedCardIds) => {
      if (savedCardIds.length > 0) {
        setTierBreakdownScope({ cardIds: savedCardIds, label: `${savedCardIds.length} cards from last import` });
        setScreen("tierBreakdown");
      } else {
        setScreen("home");
      }
    }} />{bottomNav}</>
  );

  // ─── TIER BREAKDOWN ───
  if (screen === "tierBreakdown" && tierBreakdownScope) {
    const scopeCards = cards.filter(c => tierBreakdownScope.cardIds.includes(c.id));
    return <><TierBreakdownView cards={scopeCards} boxes={boxes} scopeLabel={tierBreakdownScope.label} onBack={() => { setTierBreakdownScope(null); setScreen("home"); }} onCardTap={c => goToCardDetail(c, "tierBreakdown")} updateCard={updateCard} />{bottomNav}</>;
  }

  // ─── CARD DETAIL ───
  if (screen === "cardDetail" && selectedCard) {
    const liveCard = cards.find(c => c.id === selectedCard.id) || selectedCard;
    return <><CardDetail card={liveCard} boxes={boxes} onBack={goBackFromDetail} updateCard={updateCard} updateCardPrice={updateCardPrice} deleteCard={async (id) => { await deleteCard(id); goBackFromDetail(); }} markListed={markListed} markSold={markSold} markShipped={markShipped} getNextPosition={getBoxNextPosition} watchedCount={cards.filter(c => c.is_watched === true).length} />{bottomNav}</>;
  }

  return null;
}
