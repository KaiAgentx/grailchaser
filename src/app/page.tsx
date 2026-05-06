"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCards } from "@/hooks/useCards";
import { useBoxes } from "@/hooks/useBoxes";
import { useActiveGame } from "@/hooks/useActiveGame";
import { DEFAULT_BOX_NAME, GAME_DISPLAY_NAME } from "@/lib/games";
import type { Game } from "@/lib/types";
import { LoginScreen } from "@/components/LoginScreen";
import { Shell } from "@/components/shell/Shell";
import { AppShell } from "@/components/shell/AppShell";
import { SearchScreen } from "@/components/search/SearchScreen";
import { CollectionHomeScreen } from "@/components/collection/CollectionHomeScreen";
import { ProfileScreen } from "@/components/profile/ProfileScreen";
import { ShowModeHomeIdle } from "@/components/show-mode/ShowModeHomeIdle";
import { ShowModeHomeActive } from "@/components/show-mode/ShowModeHomeActive";
import { ShowModeResult, type ShowModePreload } from "@/components/show-mode/ShowModeResult";
import { useActiveShow } from "@/hooks/useActiveShow";
import { StorageView } from "@/components/StorageView";
import { CardDetail } from "@/components/CardDetail";
import { ScanScreen } from "@/components/ScanScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { WatchlistView } from "@/components/WatchlistView";
import { BatchImportView } from "@/components/BatchImportView";
import { TierBreakdownView } from "@/components/TierBreakdownView";
import { HomeScreen } from "@/components/home/HomeScreen";
import { createClient } from "@/lib/supabase";
import { TierBadge } from "@/components/atoms/TierBadge";
import { TIER_RANK, type Tier } from "@/lib/utils";
import { bg, surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "@/components/styles";

type Screen =
  | "home" | "myCards" | "cardDetail" | "storage" | "scanChooser" | "scan" | "result"
  | "watchlist" | "batchImport" | "tierBreakdown"
  // Phase B-ui-1 additions: 5-tab system + new sub-screens
  | "search" | "collection" | "profile"
  // Phase B-ui-1 Commit 4: Show Mode flow
  | "showHomeIdle" | "showHomeActive" | "showResult";

export default function Home() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { activeGame, setActiveGame, hydrated: gameHydrated } = useActiveGame();
  const { cards, loading, addCard, updateCardPrice, updateCard, deleteCard, markListed, markSold, markShipped } = useCards(user?.id, activeGame);
  const { boxes, loading: boxesLoading, addBox, updateBox, deleteBox, getNextPosition: getBoxNextPosition, getBoxCards } = useBoxes(user?.id, cards);

  const [screen, setScreen] = useState<Screen>("home");
  const [scanIntent, setScanIntent] = useState<"check" | "collect" | "show_mode">("check");
  const [recognizeResult, setRecognizeResult] = useState<any>(null);
  const [pendingFront, setPendingFront] = useState<File | null>(null);
  const [pendingBack, setPendingBack] = useState<Blob | null>(null);
  // ─── Show Mode state (Phase B-ui-1 Commit 4) ───
  const { activeShow, refetch: refetchActiveShow } = useActiveShow();
  const [showResultScanId, setShowResultScanId] = useState<string | null>(null);
  const [showResultPreload, setShowResultPreload] = useState<ShowModePreload | null>(null);
  const [tierBreakdownScope, setTierBreakdownScope] = useState<{ cardIds: string[]; label: string } | null>(null);

  // Clear any pending front/back captures whenever we (re-)enter the scan screen.
  // Prevents a leftover blob from a prior collect scan polluting a quick check.
  useEffect(() => {
    if (screen === "scan") {
      setPendingFront(null);
      setPendingBack(null);
    }
  }, [screen]);

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
    else if (s === "search") setScreen("search");
    else if (s === "collection") setScreen("collection");
    else if (s === "profile") setScreen("profile");
    else if (s === "watchlist") setScreen("watchlist");
    else if (s === "batchImport") setScreen("batchImport");
    else setScreen(s as Screen);
  };

  // Each branch wraps its content in <AppShell {...navProps}>...</AppShell>.
  // AppShell renders the persistent BottomNav at the bottom of the viewport.
  const navProps = { currentScreen: screen, prevScreen, onNavigate: handleBottomNav };

  // ─── HOME (TCG dashboard) ───
  if (screen === "home") return (
    <AppShell {...navProps}>
      <HomeScreen
        userId={user.id}
        activeGame={activeGame}
        setActiveGame={setActiveGame}
        activeShow={activeShow}
        onStartOrResumeShow={() => setScreen(activeShow ? "showHomeActive" : "showHomeIdle")}
        onQuickCheck={() => { setScanIntent("check"); setScreen("scan"); }}
        onAddCard={() => { setScanIntent("collect"); setScreen("scan"); }}
        onBatchImport={() => setScreen("batchImport")}
        onCardSelect={(cardId) => {
          const card = cards.find(c => c.id === cardId);
          if (card) goToCardDetail(card, "home");
        }}
      />
    </AppShell>
  );

  // ─── SCAN ───
  if (screen === "scan") return (
    <AppShell {...navProps}><ScanScreen
      game={activeGame}
      scanIntent={scanIntent}
      onBack={() => setScreen(scanIntent === "show_mode" ? "showHomeActive" : "home")}
      onResult={(result, intent) => {
        setRecognizeResult(result);
        setScanIntent(intent);
        // Show Mode auto-routes past ResultScreen straight into the canonical decision UI.
        // Falls through to result screen if scan_result_id is missing (rare telemetry-DB
        // write failure) or activeShow disappeared mid-scan. Stats refresh is automatic
        // on return: showHomeActive remounts and useShowStats refetches on mount.
        if (intent === "show_mode" && result?.scan_result_id && activeShow) {
          // Clear collect-flow pending captures — ShowModeResult uses the catalog image,
          // not the user's capture, so these would just dangle in state otherwise.
          setPendingFront(null);
          setPendingBack(null);
          // Pass all candidates + force-pick flag through so ShowModeResult can
          // render the Pick Your Version picker when the fuzzy fallback fired.
          // Skipping the scan_results + catalog_cards SELECTs also avoids the
          // read-after-write race that bit us on iPhone testing.
          const allCandidates = result?.result?.candidates ?? [];
          setShowResultPreload(allCandidates.length > 0 ? {
            candidates: allCandidates.map((c: any) => ({
              catalogCardId: c.catalogCardId,
              name: c.name,
              setName: c.setName,
              cardNumber: c.cardNumber,
              rarity: c.rarity ?? null,
              imageLargeUrl: c.imageLargeUrl ?? null,
              imageSmallUrl: c.imageSmallUrl ?? null,
            })),
            forcePickRequired: result?.result?.force_pick_required ?? false,
          } : null);
          setShowResultScanId(result.scan_result_id);
          setScreen("showResult");
        } else {
          setScreen("result");
        }
      }}
      onFrontCaptured={(front) => setPendingFront(front)}
      onBackCaptured={(back) => setPendingBack(back)}
    /></AppShell>
  );

  // ─── RESULT ───
  if (screen === "result" && recognizeResult) return (
    <AppShell {...navProps}><ResultScreen
      result={recognizeResult}
      scanIntent={scanIntent}
      onBack={() => setScreen("scan")}
      onSaved={() => setScreen(scanIntent === "show_mode" ? "showHomeActive" : "home")}
      onScanAnother={() => { setRecognizeResult(null); setScreen("scan"); }}
      userId={user?.id || ""}
      scanResultId={recognizeResult?.scan_result_id}
      rank1CatalogCardId={recognizeResult?.result?.candidates?.[0]?.catalogCardId}
      boxes={boxes}
      addBox={addBox}
      addCard={addCard}
      pendingFront={pendingFront}
      pendingBack={pendingBack}
    /></AppShell>
  );

  // ─── SCAN CHOOSER ───
  if (screen === "scanChooser") return (
    <AppShell {...navProps}>
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
    </AppShell>
  );

  // ─── SEARCH (stub) ───
  if (screen === "search") return (<AppShell {...navProps}><SearchScreen /></AppShell>);

  // ─── COLLECTION (hub stub) ───
  if (screen === "collection") return (<AppShell {...navProps}><CollectionHomeScreen onNavigate={handleBottomNav} /></AppShell>);

  // ─── PROFILE (stub) ───
  if (screen === "profile") return (<AppShell {...navProps}><ProfileScreen email={user?.email ?? null} onNavigate={handleBottomNav} /></AppShell>);

  // ─── SHOW MODE — IDLE (no active show) ───
  if (screen === "showHomeIdle") return (
    <AppShell {...navProps}>
      <ShowModeHomeIdle
        userId={user?.id || ""}
        onBack={() => setScreen("home")}
        onStarted={() => { refetchActiveShow(); setScreen("showHomeActive"); }}
      />
    </AppShell>
  );

  // ─── SHOW MODE — ACTIVE (show in progress) ───
  if (screen === "showHomeActive") {
    if (!activeShow) {
      // Defensive: no active show but we ended up on this screen — bounce to idle.
      return (
        <AppShell {...navProps}>
          <ShowModeHomeIdle
            userId={user?.id || ""}
            onBack={() => setScreen("home")}
            onStarted={() => { refetchActiveShow(); setScreen("showHomeActive"); }}
          />
        </AppShell>
      );
    }
    return (
      <AppShell {...navProps}>
        <ShowModeHomeActive
          show={activeShow}
          onBack={() => setScreen("home")}
          onOpenCamera={() => { setScanIntent("show_mode"); setScreen("scan"); }}
          onEnded={() => { refetchActiveShow(); setScreen("home"); }}
          onTestInjectScanResult={(scanResultId) => { setShowResultScanId(scanResultId); setScreen("showResult"); }}
        />
      </AppShell>
    );
  }

  // ─── SHOW MODE — RESULT (post-scan decision) ───
  if (screen === "showResult" && showResultScanId && activeShow) {
    return (
      <AppShell {...navProps}>
        <ShowModeResult
          scanResultId={showResultScanId}
          showId={activeShow.id}
          preloaded={showResultPreload ?? undefined}
          onBack={() => { setShowResultScanId(null); setShowResultPreload(null); setScreen("showHomeActive"); }}
          onDecided={() => { setShowResultScanId(null); setShowResultPreload(null); setScreen("showHomeActive"); }}
        />
      </AppShell>
    );
  }

  // ─── MY CARDS ───
  if (screen === "myCards") return (<AppShell {...navProps}>
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
  </AppShell>
  );

  // ─── STORAGE ───
  if (screen === "storage") return <AppShell {...navProps}><StorageView cards={cards} boxes={boxes} initialBoxName={storageInitialBox} onBack={() => { setStorageInitialBox(""); setScreen("home"); }} addBox={addBox} updateBox={updateBox} deleteBox={deleteBox} updateCard={updateCard} updateCardPrice={updateCardPrice} onCardTap={(card, boxName) => goToCardDetail(card, "storage", { boxName })} onNavigate={(t: any) => {
    if (t.screen === "tierBreakdown" && t.boxName) {
      const boxCards = getBoxCards(t.boxName);
      setTierBreakdownScope({ cardIds: boxCards.map(c => c.id), label: t.boxName });
      setScreen("tierBreakdown");
    } else {
      setScreen(t.screen as Screen);
    }
  }} getNextPosition={getBoxNextPosition} getBoxCards={getBoxCards} /></AppShell>;

  // ─── WATCHLIST ───
  if (screen === "watchlist") return (
    <AppShell {...navProps}><WatchlistView cards={cards.filter(c => c.is_watched === true)} onBack={() => setScreen("home")} onCardTap={(card) => goToCardDetail(card, "watchlist")} updateCardPrice={updateCardPrice} /></AppShell>
  );

  // ─── BATCH IMPORT ───
  if (screen === "batchImport") return (
    <AppShell {...navProps}><BatchImportView boxes={boxes} userId={user?.id || ""} onBack={() => setScreen("home")} addCard={addCard} updateCardPrice={updateCardPrice} onDone={(savedCardIds) => {
      if (savedCardIds.length > 0) {
        setTierBreakdownScope({ cardIds: savedCardIds, label: `${savedCardIds.length} cards from last import` });
        setScreen("tierBreakdown");
      } else {
        setScreen("home");
      }
    }} /></AppShell>
  );

  // ─── TIER BREAKDOWN ───
  if (screen === "tierBreakdown" && tierBreakdownScope) {
    const scopeCards = cards.filter(c => tierBreakdownScope.cardIds.includes(c.id));
    return <AppShell {...navProps}><TierBreakdownView cards={scopeCards} boxes={boxes} scopeLabel={tierBreakdownScope.label} onBack={() => { setTierBreakdownScope(null); setScreen("home"); }} onCardTap={c => goToCardDetail(c, "tierBreakdown")} updateCard={updateCard} /></AppShell>;
  }

  // ─── CARD DETAIL ───
  if (screen === "cardDetail" && selectedCard) {
    const liveCard = cards.find(c => c.id === selectedCard.id) || selectedCard;
    return <AppShell {...navProps}><CardDetail card={liveCard} boxes={boxes} userId={user?.id || ""} onBack={goBackFromDetail} updateCard={updateCard} updateCardPrice={updateCardPrice} deleteCard={async (id) => { await deleteCard(id); goBackFromDetail(); }} markListed={markListed} markSold={markSold} markShipped={markShipped} getNextPosition={getBoxNextPosition} watchedCount={cards.filter(c => c.is_watched === true).length} /></AppShell>;
  }

  return null;
}
