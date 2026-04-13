"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCards } from "@/hooks/useCards";
import { useActiveGame } from "@/hooks/useActiveGame";
import { GAME_DISPLAY_NAME, TCG_GAMES, isTcgGame } from "@/lib/games";
import type { Game } from "@/lib/types";
import { PLATFORMS, calcNet, calcShipping } from "@/lib/utils";
import { LoginScreen } from "@/components/LoginScreen";
import { Dashboard } from "@/components/Dashboard";
import { CardDetail } from "@/components/CardDetail";
import { StorageView } from "@/components/StorageView";
import { CsvImport } from "@/components/CsvImport";
import { PickList } from "@/components/PickList";
import { ScanToCollection } from "@/components/ScanToCollection";
import { SmartPull } from "@/components/SmartPull";
import { GradeCheck } from "@/components/GradeCheck";
import { GradingReturn } from "@/components/GradingReturn";
import { LotBuilder } from "@/components/LotBuilder";
import { useLots } from "@/hooks/useLots";
import { BuyFlow, parseCardName } from "@/components/BuyFlow";
import { Shell } from "@/components/Shell";
import { BottomNav } from "@/components/BottomNav";
import { TcgScanScreen } from "@/components/TcgScanScreen";
import { TcgResultScreen } from "@/components/TcgResultScreen";
import { useBoxes } from "@/hooks/useBoxes";
import { createClient } from "@/lib/supabase";
import { bg, surface, surface2, border, borderMed, accent, green, red, cyan, purple, amber, muted, secondary, text, font, mono, sportColors } from "@/components/styles";

type Screen = "home" | "addCard" | "myCards" | "cardDetail" | "cardCheck" | "cardResult" | "storage" | "csvImport" | "pickList" | "scanToCollection" | "smartPull" | "gradeCheck" | "gradingReturn" | "lotBuilder" | "scanChooser" | "modeSelector" | "tcgHome" | "tcgScan" | "tcgResult";

function compressImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("No canvas");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const { cards, loading, addCard, addCards, deleteCard, updateCard, markListed, markSold, markShipped, submitForGrading, returnFromGrading, getNextPosition, renumberBox, fetchCards } = useCards(user?.id);
  const [smartPullBoxName, setSmartPullBoxName] = useState("");
  const { boxes, addBox, updateBox, deleteBox, getNextPosition: getBoxNextPosition, getBoxCards } = useBoxes(user?.id, cards);
  const { lots, createLot, updateLot, deleteLot, markLotListed, markLotSold, markLotShipped, fetchLots } = useLots(user?.id);
  const [lotBuilderBoxName, setLotBuilderBoxName] = useState("");
  const [tcgScanIntent, setTcgScanIntent] = useState<"check" | "collect">("check");
  const [tcgRecognizeResult, setTcgRecognizeResult] = useState<any>(null);
  const [tcgCardCount, setTcgCardCount] = useState<number | null>(null);
  const [tcgTotalValue, setTcgTotalValue] = useState<number>(0);
  const [tcgRecentActivity, setTcgRecentActivity] = useState<any[]>([]);
  const [tcgRecentlyAdded, setTcgRecentlyAdded] = useState<any[]>([]);
  const [tcgHomeLoading, setTcgHomeLoading] = useState(true);
  const [buyConfirm, setBuyConfirm] = useState("");
  const [showBuyFlow, setShowBuyFlow] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const { activeGame, setActiveGame, mode, modeStreak, recordModeSelection, hydrated: gameHydrated, lastTcgGame } = useActiveGame();
  const [screen, setScreen] = useState<Screen>("home");
  const [initialScreenSet, setInitialScreenSet] = useState(false);

  // Set initial screen based on activeGame after hydration
  useEffect(() => {
    if (!gameHydrated || initialScreenSet || authLoading || !user) return;
    if (activeGame === null) {
      setScreen("modeSelector");
    } else if (mode === "tcg") {
      setScreen("tcgHome");
    } else {
      setScreen("home");
    }
    setInitialScreenSet(true);
  }, [gameHydrated, initialScreenSet, authLoading, user, activeGame, mode]);

  // ─── TCG home data fetch ───
  useEffect(() => {
    if (screen !== "tcgHome" || !user || !activeGame || !isTcgGame(activeGame)) return;
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
          console.error("[tcgHome] stats query failed:", statsRes.reason);
          setTcgCardCount(0);
          setTcgTotalValue(0);
        }

        if (recentlyAddedRes.status === "fulfilled") {
          setTcgRecentlyAdded(recentlyAddedRes.value.data || []);
        } else {
          console.error("[tcgHome] recently added query failed:", recentlyAddedRes.reason);
          setTcgRecentlyAdded([]);
        }

        if (activityRes.status === "fulfilled") {
          setTcgRecentActivity(activityRes.value.data || []);
        } else {
          console.error("[tcgHome] activity query failed:", activityRes.reason);
          setTcgRecentActivity([]);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[tcgHome] data fetch threw:", err);
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
    if (prevScreen === "smartPull" && prevScreenData?.boxName) {
      setSmartPullBoxName(prevScreenData.boxName);
    }
    setScreen(prevScreen as Screen);
  };
  const [search, setSearch] = useState("");
  const [checkName, setCheckName] = useState("");
  const [checkRaw, setCheckRaw] = useState(0);
  const [checkPsa10, setCheckPsa10] = useState(0);
  const [checkPsa9, setCheckPsa9] = useState(0);
  const [checkPsa8, setCheckPsa8] = useState(0);
  const [askingPrice, setAskingPrice] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({ player: "", sport: "Baseball" as any, team: "", year: 2024, brand: "Topps", set: "Base", parallel: "Base", card_number: "#1", is_rc: false, is_auto: false, is_numbered: false, numbered_to: null as number | null, condition: "NM" as any, raw_value: 0, cost_basis: 0, storage_box: "BOX A", notes: "", purchase_source: null as string | null, purchase_intent: null as any });
  const [filterSport, setFilterSport] = useState("All");
  const [sortBy, setSortBy] = useState("value");
  const totalValue = cards.reduce((s, c) => s + (c.raw_value || 0), 0);
  const unsold = cards.filter(c => !c.sold);
  const listed = cards.filter(c => c.status === "listed");
  const grading = cards.filter(c => c.status === "grading");
  // Ecosystem filter: TCG = game in [pokemon, mtg, one_piece]. Sports = everything else (game='sports', null, etc).
  const TCG_GAME_VALUES = ["pokemon", "mtg", "one_piece"];
  const isTcgCard = (c: any) => c.game && TCG_GAME_VALUES.includes(c.game);
  const ecosystemCards = mode === "tcg" ? cards.filter(isTcgCard) : cards.filter(c => !isTcgCard(c));
  const ecosystemUnsold = ecosystemCards.filter(c => !c.sold);
  const filteredCards = (statusFilter === "pending" ? ecosystemCards.filter(c => !c.storage_box || c.storage_box === "PENDING") : statusFilter === "stale" ? ecosystemCards.filter(c => c.status === "listed" && c.listed_date && (Date.now() - new Date(c.listed_date).getTime()) / 86400000 > 14) : statusFilter ? ecosystemCards.filter(c => c.status === statusFilter) : ecosystemUnsold).filter(c => filterSport === "All" || (mode === "tcg" ? (c as any).game === filterSport : c.sport === filterSport)).filter(c => !search || c.player.toLowerCase().includes(search.toLowerCase()) || c.brand.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sortBy === "value" ? b.raw_value - a.raw_value : sortBy === "recent" ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : sortBy === "name" ? a.player.localeCompare(b.player) : (a.storage_box || "ZZZ").localeCompare(b.storage_box || "ZZZ") || (a.storage_position || 0) - (b.storage_position || 0));
  const sports = mode === "tcg" ? ["All", "pokemon", "mtg", "one_piece"] : ["All", ...Array.from(new Set(ecosystemCards.map(c => c.sport)))];

  const handleScan = async (file: File) => {
    setScanning(true);
    setScanPreview(URL.createObjectURL(file));
    setScanResult(null); setCheckPsa10(0); setCheckPsa9(0); setCheckPsa8(0); setCheckRaw(0); setNameEdited(false);
    try {
      const base64 = await compressImage(file, 800);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (data.success) {
        setCheckName([data.year, data.brand, data.set !== data.brand ? data.set : "", data.parallel !== "Base" ? data.parallel : "", data.player, data.card_number].filter(Boolean).join(" "));
        setScanResult(data);
        if (data.pricing?.raw) setCheckRaw(data.pricing.raw);
        if (data.pricing?.psa10) setCheckPsa10(data.pricing.psa10);
        if (data.pricing?.psa9) setCheckPsa9(data.pricing.psa9);
        if (data.pricing?.psa8) setCheckPsa8(data.pricing.psa8);
      } else {
        setScanResult({ error: data.error || data.debug?.error || "Could not identify card. Try manual entry." });
      }
    } catch (err: any) {
      setScanResult({ error: "Scan failed: " + err.message });
    }
    setScanning(false);
  };

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

  // Wait for game hydration to avoid flash
  if (!gameHydrated || !initialScreenSet) return (
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 13, color: muted }}>Loading...</div>
    </div>
  );

  // Mode-aware "back to home" target — used by every back button that
  // returns to the dashboard. Sports → "home", TCG → "tcgHome".
  const homeScreenForMode = (): Screen => mode === "tcg" ? "tcgHome" : "home";

  // Bottom nav handler
  const handleBottomNav = (s: string) => {
    if (s === "scanChooser") setScreen("scanChooser");
    else if (s === "home") setScreen(homeScreenForMode());
    else if (s === "myCards") { setStatusFilter(""); setScreen("myCards"); }
    else if (s === "storage") { setStorageInitialBox(""); setScreen("storage"); }
    else setScreen(s as Screen);
  };

  const bottomNav = <BottomNav currentScreen={screen} prevScreen={prevScreen} onNavigate={handleBottomNav} onSwitchWorld={() => { setActiveGame(null); setScreen("modeSelector"); }} currentMode={mode} />;

  // ─── MODE SELECTOR ───
  if (screen === "modeSelector") {
    const CARD_BG = "linear-gradient(180deg, rgba(18,22,28,0.92) 0%, rgba(10,13,18,0.92) 100%)";
    const CARD_BG_HOVER = "linear-gradient(180deg, rgba(24,28,36,0.95) 0%, rgba(14,18,24,0.95) 100%)";
    const CARD_BORDER_DEFAULT = "rgba(255,255,255,0.07)";
    const CARD_BORDER_HOVER = "rgba(212,175,82,0.5)";
    const CARD_SHADOW = "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.02)";
    const CARD_SHADOW_HOVER = "0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,82,0.08), inset 0 1px 0 rgba(212,175,82,0.15), inset 0 0 0 1px rgba(212,175,82,0.1)";
    const cardStyle: React.CSSProperties = {
      width: "100%",
      textAlign: "left",
      cursor: "pointer",
      position: "relative",
      background: CARD_BG,
      border: `1px solid ${CARD_BORDER_DEFAULT}`,
      borderRadius: 20,
      padding: "40px 36px",
      minHeight: 240,
      boxShadow: CARD_SHADOW,
      color: "#f4f1ea",
      fontFamily: font,
      transition: "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease, background 220ms ease",
      display: "flex",
      flexDirection: "column",
      gap: 18,
    };
    const iconBoxStyle: React.CSSProperties = {
      width: 52, height: 52, borderRadius: 12,
      background: "linear-gradient(180deg, rgba(212,175,82,0.12) 0%, rgba(212,175,82,0.04) 100%)",
      border: "1px solid rgba(212,175,82,0.25)",
      boxShadow: "inset 0 1px 0 rgba(212,175,82,0.2), 0 4px 12px rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center", color: "#d4af52", flexShrink: 0,
    };
    const titleStyle: React.CSSProperties = {
      fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 32, color: "#f8f5ed", margin: 0, lineHeight: 1.1,
    };
    const categoryStyle: React.CSSProperties = {
      fontSize: 14, color: "#b8b2a8", fontFamily: font, letterSpacing: "0.02em",
    };
    const valuePropStyle: React.CSSProperties = {
      fontSize: 14, color: "#cfc9bf", lineHeight: 1.6, marginTop: 4,
    };
    const enterRowStyle: React.CSSProperties = {
      marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center",
    };
    const enterLabelStyle: React.CSSProperties = {
      fontSize: 12, fontWeight: 600, letterSpacing: "0.28em", color: "#d1aa48", textTransform: "uppercase", transition: "color 220ms ease",
    };
    const cardMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = "translateY(-4px)";
      e.currentTarget.style.background = CARD_BG_HOVER;
      e.currentTarget.style.borderColor = CARD_BORDER_HOVER;
      e.currentTarget.style.boxShadow = CARD_SHADOW_HOVER;
    };
    const cardMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.background = CARD_BG;
      e.currentTarget.style.borderColor = CARD_BORDER_DEFAULT;
      e.currentTarget.style.boxShadow = CARD_SHADOW;
    };
    const cardFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.outline = "2px solid rgba(212,175,82,0.6)";
      e.currentTarget.style.outlineOffset = "2px";
    };
    const cardBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.outline = "none";
    };
    return (
      <div style={{ background: "#060606", color: "#f4f1ea", fontFamily: font, minHeight: "100vh", width: "100%", position: "relative", overflow: "hidden" }}>
        <style>{`
          .market-card .card-arrow { transition: transform 220ms ease; }
          .market-card:hover .card-arrow { transform: translateX(4px); }
          .market-card:hover .card-cta { color: #e1c46d; }

          .desc-mobile { display: none; }

          @media (max-width: 720px) {
            .market-wrapper { padding: 56px 20px 32px !important; }
            .market-header { margin-bottom: 36px !important; }
            .market-overline { font-size: 9px !important; letter-spacing: 0.36em !important; margin-bottom: 12px !important; }
            .market-title { font-size: 32px !important; line-height: 1.05 !important; }
            .market-subtitle { font-size: 14px !important; max-width: 320px !important; margin-top: 12px !important; }
            .market-grid { grid-template-columns: 1fr !important; gap: 16px !important; max-width: 100% !important; }
            .market-card { padding: 24px 22px !important; min-height: 170px !important; gap: 14px !important; }
            .market-card-icon { width: 46px !important; height: 46px !important; }
            .market-card-title { font-size: 24px !important; }
            .market-card-categories { font-size: 13px !important; }
            .market-card-cta { font-size: 11px !important; }
            .desc-desktop { display: none !important; }
            .desc-mobile { display: inline !important; font-size: 14px !important; line-height: 1.55 !important; }
          }

          @media (hover: none) {
            .market-card:hover {
              transform: none !important;
              border-color: rgba(255,255,255,0.07) !important;
              box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.02) !important;
              background: linear-gradient(180deg, rgba(18,22,28,0.92) 0%, rgba(10,13,18,0.92) 100%) !important;
            }
            .market-card:active {
              transform: scale(0.985) !important;
              transition: transform 120ms ease !important;
            }
          }
        `}</style>
        <div className="market-wrapper" style={{ position: "relative", width: "100%", maxWidth: 1040, margin: "0 auto", padding: "8vh 24px 6vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Atmosphere layer 1 — warm gold core */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(212,175,82,0.09) 0%, transparent 60%)" }} />
          {/* Atmosphere layer 2 — warm shadow grounding */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(20,15,8,0.4) 0%, transparent 70%)" }} />
          {/* Atmosphere layer 3 — edge vignette */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.6) 100%)" }} />

          {/* Header block */}
          <div className="market-header" style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 64 }}>
            <div className="market-overline" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.42em", color: "#8a7a4a", textTransform: "uppercase", marginBottom: 16 }}>Market Selection</div>
            <h1 className="market-title" style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 700,
              fontSize: "clamp(36px, 5.5vw, 52px)",
              letterSpacing: "0.01em",
              lineHeight: 1.05,
              background: "linear-gradient(180deg, #f4f1ea 0%, #c4bfb8 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "#f4f1ea",
              margin: 0,
            }}>Choose Your Market</h1>
            <div className="market-subtitle" style={{ fontFamily: font, fontSize: 16, fontWeight: 400, color: "#b5afa6", maxWidth: 560, textAlign: "center", lineHeight: 1.5, margin: "16px auto 0" }}>
              Access specialized recognition, pricing, and portfolio tools tailored to your category.
            </div>
          </div>

          {/* Cards grid */}
          <div className="market-grid" style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, width: "100%", maxWidth: 920 }}>
            {/* Sports Cards */}
            <button
              className="market-card"
              onClick={() => { setActiveGame("sports"); recordModeSelection("sports"); setScreen("home"); }}
              onMouseEnter={cardMouseEnter}
              onMouseLeave={cardMouseLeave}
              onFocus={cardFocus}
              onBlur={cardBlur}
              style={cardStyle}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="market-card-icon" style={iconBoxStyle}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="6" width="12" height="16" rx="2" />
                    <rect x="6" y="4" width="12" height="16" rx="2" />
                    <rect x="9" y="2" width="12" height="16" rx="2" />
                  </svg>
                </div>
                <h2 className="market-card-title" style={titleStyle}>Sports Cards</h2>
              </div>
              <div className="market-card-categories" style={categoryStyle}>Baseball · Football · Basketball · Hockey · Soccer</div>
              <div style={valuePropStyle}>
                <span className="desc-desktop">Recognition, comps, grading insight, and portfolio intelligence for sports collectors.</span>
                <span className="desc-mobile">Recognition, comps, grading, and portfolio tools.</span>
              </div>
              <div style={enterRowStyle}>
                <span className="card-cta market-card-cta" style={enterLabelStyle}>Enter Market</span>
                <svg className="card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1aa48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>

            {/* TCG */}
            <button
              className="market-card"
              onClick={() => { setActiveGame(lastTcgGame); recordModeSelection("tcg"); setScreen("tcgHome"); }}
              onMouseEnter={cardMouseEnter}
              onMouseLeave={cardMouseLeave}
              onFocus={cardFocus}
              onBlur={cardBlur}
              style={cardStyle}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="market-card-icon" style={iconBoxStyle}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="12" height="16" rx="2" />
                    <rect x="9" y="3" width="12" height="16" rx="2" />
                    <polygon points="17 6 18 8.5 20.5 9 18.5 10.8 19 13.5 17 12.2 15 13.5 15.5 10.8 13.5 9 16 8.5" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <h2 className="market-card-title" style={titleStyle}>TCG</h2>
              </div>
              <div className="market-card-categories" style={categoryStyle}>Pokémon · Magic: The Gathering · One Piece</div>
              <div style={valuePropStyle}>
                <span className="desc-desktop">Set recognition, rarity context, pricing, and collection intelligence for modern TCG.</span>
                <span className="desc-mobile">Set recognition, rarity, pricing, and collection tools.</span>
              </div>
              <div style={enterRowStyle}>
                <span className="card-cta market-card-cta" style={enterLabelStyle}>Enter Market</span>
                <svg className="card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1aa48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── TCG HOME ───
  if (screen === "tcgHome") {
    const gameDisplayName = activeGame ? GAME_DISPLAY_NAME[activeGame] || "TCG" : "TCG";
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
            .tcg-mode-pill { transition: background 220ms ease, border-color 220ms ease; }
            .tcg-mode-pill:hover { background: rgba(212,175,82,0.18) !important; border-color: rgba(212,175,82,0.55) !important; }
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
              .tcg-action-btn:hover, .tcg-mode-pill:hover,
              .tcg-activity-row:hover, .tcg-thumb-card:hover, .tcg-zero-cta:hover {
                background: revert !important;
                border-color: revert !important;
                color: revert !important;
                transform: none !important;
                box-shadow: revert !important;
                filter: none !important;
              }
              .tcg-action-btn:active, .tcg-mode-pill:active, .tcg-thumb-card:active, .tcg-zero-cta:active {
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
                  <button
                    className="tcg-mode-pill"
                    onClick={() => setScreen("modeSelector")}
                    style={{ background: "rgba(212,175,82,0.12)", border: "1px solid rgba(212,175,82,0.3)", borderRadius: 9999, padding: "5px 14px", color: "#d1aa48", fontFamily: font, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", cursor: "pointer" }}
                  >TCG ▾</button>
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
                { label: "Quick Check", onClick: () => { setTcgScanIntent("check"); setScreen("tcgScan"); }, icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                ) },
                { label: "Add Card", onClick: () => { setTcgScanIntent("collect"); setScreen("tcgScan"); }, icon: (
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
                    onClick={() => { setTcgScanIntent("collect"); setScreen("tcgScan"); }}
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
                      onClick={() => goToCardDetail(c, "tcgHome")}
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

  // ─── TCG SCAN ───
  if (screen === "tcgScan") return (
    <><TcgScanScreen
      game={activeGame || "pokemon"}
      scanIntent={tcgScanIntent}
      onBack={() => setScreen("tcgHome")}
      onResult={(result, intent) => { setTcgRecognizeResult(result); setTcgScanIntent(intent); setScreen("tcgResult"); }}
    />{bottomNav}</>
  );

  // ─── TCG RESULT ───
  if (screen === "tcgResult" && tcgRecognizeResult) return (
    <><TcgResultScreen
      result={tcgRecognizeResult}
      scanIntent={tcgScanIntent}
      onBack={() => setScreen("tcgScan")}
      onSaved={() => setScreen("tcgHome")}
      onScanAnother={() => { setTcgRecognizeResult(null); setScreen("tcgScan"); }}
      userId={user?.id || ""}
      scanResultId={tcgRecognizeResult?.scan_result_id}
      rank1CatalogCardId={tcgRecognizeResult?.result?.candidates?.[0]?.catalogCardId}
    />{bottomNav}</>
  );

  if (screen === "scanChooser") return (
    <>
      <Shell title="What are you doing?" back={() => setScreen(homeScreenForMode())}>
        <div style={{ paddingTop: 24 }}>
          <button onClick={() => { setCheckName(""); setCheckRaw(0); setCheckPsa10(0); setCheckPsa9(0); setCheckPsa8(0); setAskingPrice(0); setScanPreview(null); setScanResult(null); setLookupError(""); setNameEdited(false); setScreen("cardCheck"); }} style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 16, padding: "24px 20px", cursor: "pointer", textAlign: "left", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 4 }}>Check a Card</div>
            <div style={{ fontSize: 13, color: secondary }}>Evaluate a card before buying</div>
          </button>
          <button onClick={() => setScreen("scanToCollection")} style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 16, padding: "24px 20px", cursor: "pointer", textAlign: "left", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 4 }}>Scan to Collection</div>
            <div style={{ fontSize: 13, color: secondary }}>Log cards you already own</div>
          </button>
        </div>
      </Shell>
      {bottomNav}
    </>
  );

  if (screen === "home") return (
    <><Dashboard
      cards={cards}
      boxes={boxes}
      lots={lots}
      userEmail={user.email || ""}
      onNavigate={(t: any) => {
        if (t.screen === "cardCheck") { setCheckName(""); setCheckRaw(0); setCheckPsa10(0); setCheckPsa9(0); setCheckPsa8(0); setAskingPrice(0); setScanPreview(null); setScanResult(null); setLookupError(""); setNameEdited(false); }
        if (t.card && t.screen === "cardDetail") { goToCardDetail(t.card, "home"); return; }
        if (t.filter) setStatusFilter(t.filter);
        if (t.boxName) { setSmartPullBoxName(t.boxName); setLotBuilderBoxName(t.boxName); }
        setScreen(t.screen as Screen);
      }}
      onSignOut={() => signOut()}
      onModeSelect={() => setScreen("modeSelector")}
    />{bottomNav}</>
  );

  if (screen === "addCard") return (<>
    <Shell title="Add Card" back={() => setScreen(homeScreenForMode())}>
      <div style={{ paddingTop: 16 }}>
        {[{ label: "Player", key: "player", type: "text", placeholder: "Justin Herbert" }, { label: "Year", key: "year", type: "number", placeholder: "2024" }, { label: "Brand", key: "brand", type: "text", placeholder: "Panini" }, { label: "Set", key: "set", type: "text", placeholder: "Prizm Football" }, { label: "Card Number", key: "card_number", type: "text", placeholder: "#315" }, { label: "Value ($)", key: "raw_value", type: "number", placeholder: "0" }, { label: "Cost Paid ($)", key: "cost_basis", type: "number", placeholder: "0" }].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{f.label}</label>
            <input type={f.type} placeholder={f.placeholder} value={(formData as any)[f.key] || ""} onChange={e => setFormData(prev => ({ ...prev, [f.key]: f.type === "number" ? +e.target.value : e.target.value }))} style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Sport</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Baseball", "Football", "Basketball", "Hockey", "Soccer"].map(s => (
              <button key={s} onClick={() => setFormData(prev => ({ ...prev, sport: s as any }))} style={{ padding: "8px 14px", background: formData.sport === s ? accent + "20" : surface2, border: "1px solid " + (formData.sport === s ? accent + "50" : border), borderRadius: 20, color: formData.sport === s ? accent : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Parallel</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Base", "Silver", "Gold", "Holo", "Refractor", "Numbered"].map(p => (
              <button key={p} onClick={() => setFormData(prev => ({ ...prev, parallel: p }))} style={{ padding: "8px 14px", background: formData.parallel === p ? cyan + "20" : surface2, border: "1px solid " + (formData.parallel === p ? cyan + "50" : border), borderRadius: 20, color: formData.parallel === p ? cyan : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{p}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Condition</label>
          <div style={{ display: "flex", gap: 6 }}>
            {["Mint", "NM", "EX", "VG"].map(c => (
              <button key={c} onClick={() => setFormData(prev => ({ ...prev, condition: c as any }))} style={{ flex: 1, padding: "10px", background: formData.condition === c ? green + "20" : surface2, border: "1px solid " + (formData.condition === c ? green + "50" : border), borderRadius: 8, color: formData.condition === c ? green : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[{ key: "is_rc", label: "Rookie" }, { key: "is_auto", label: "Auto" }, { key: "is_numbered", label: "Numbered" }].map(b => (
            <button key={b.key} onClick={() => setFormData(prev => ({ ...prev, [b.key]: !(prev as any)[b.key] }))} style={{ flex: 1, padding: "10px", background: (formData as any)[b.key] ? purple + "20" : surface2, border: "1px solid " + ((formData as any)[b.key] ? purple + "50" : border), borderRadius: 8, color: (formData as any)[b.key] ? purple : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{(formData as any)[b.key] ? "✓ " : ""}{b.label}</button>
          ))}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Storage Box</label>
          <input value={formData.storage_box} onChange={e => setFormData(prev => ({ ...prev, storage_box: e.target.value }))} style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
        </div>
        <button onClick={async () => { if (!formData.player) return; await addCard(formData); setFormData({ player: "", sport: "Baseball", team: "", year: 2024, brand: "Topps", set: "Base", parallel: "Base", card_number: "#1", is_rc: false, is_auto: false, is_numbered: false, numbered_to: null, condition: "NM", raw_value: 0, cost_basis: 0, storage_box: "BOX A", notes: "", purchase_source: null, purchase_intent: null }); setScreen("myCards"); }} style={{ width: "100%", padding: "16px", background: accent, border: "none", borderRadius: 12, color: "#000", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>Add Card</button>
      </div>
    </Shell>
    {bottomNav}</>
  );

  if (screen === "myCards") return (<>
    <Shell title={"My Cards (" + filteredCards.length + ")"} back={() => { setStatusFilter(""); setFilterSport("All"); setScreen(mode === "tcg" ? "tcgHome" : "home"); }}>
      <div style={{ paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder="Search player, brand..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "8px 12px", color: secondary, fontFamily: font, fontSize: 12, outline: "none", cursor: "pointer" }}>
            <option value="value">Value ↓</option>
            <option value="recent">Recent</option>
            <option value="name">Name A-Z</option>
            <option value="box">Box</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
          {sports.map(s => { const chipLabel = mode === "tcg" ? (s === "All" ? "All" : GAME_DISPLAY_NAME[s as Game] || s) : s; return (<button key={s} onClick={() => { setFilterSport(s); if (statusFilter === "pending") setStatusFilter(""); }} style={{ padding: "6px 14px", background: filterSport === s ? accent + "20" : surface2, border: "1px solid " + (filterSport === s ? accent + "50" : border), borderRadius: 20, color: filterSport === s ? accent : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{chipLabel}</button>); })}
          <button onClick={() => setStatusFilter(statusFilter === "pending" ? "" : "pending")} style={{ padding: "6px 14px", background: statusFilter === "pending" ? red + "20" : surface2, border: "1px solid " + (statusFilter === "pending" ? red + "50" : border), borderRadius: 20, color: statusFilter === "pending" ? red : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Unassigned</button>
        </div>
        {loading && <div style={{ textAlign: "center", color: muted, padding: 40 }}>Loading...</div>}
        {!loading && filteredCards.length === 0 && (<div style={{ textAlign: "center", color: muted, padding: 40 }}><div style={{ fontSize: 36, marginBottom: 12 }}>{mode === "tcg" ? "🎴" : "📦"}</div><div style={{ fontSize: 14 }}>{mode === "tcg" ? "No TCG cards yet. Tap Scan to add your first card." : "No cards yet"}</div></div>)}
        {filteredCards.map(card => (
          <button key={card.id} onClick={() => goToCardDetail(card, "myCards")} style={{ width: "100%", background: surface, borderLeft: "3px solid " + (sportColors[card.sport] || muted), borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 12, padding: "14px 16px", marginBottom: 6, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: text }}>{card.player}</div>
              <div style={{ fontSize: 12, color: secondary, marginTop: 2 }}>{card.year} {card.brand} {card.parallel !== "Base" ? card.parallel : ""} {card.card_number}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                {card.is_rc && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 9999, background: "rgba(52,211,153,0.1)", color: green, fontWeight: 600 }}>RC</span>}
                {card.is_auto && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 9999, background: "rgba(167,139,250,0.1)", color: purple, fontWeight: 600 }}>AUTO</span>}
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

  if (screen === "csvImport") return <><CsvImport onBack={() => setScreen(homeScreenForMode())} addCards={addCards} />{bottomNav}</>;

  if (screen === "pickList") return <><PickList cards={cards} boxes={boxes} markShipped={markShipped} updateCard={updateCard} onBack={() => setScreen(homeScreenForMode())} />{bottomNav}</>;

  if (screen === "scanToCollection") return <><ScanToCollection boxes={boxes} addCard={addCard} addBox={addBox} getNextPosition={getBoxNextPosition} onNavigate={(t: any) => { if (t.boxName) setSmartPullBoxName(t.boxName); setScreen(t.screen as Screen); }} />{bottomNav}</>;

  if (screen === "lotBuilder") return <><LotBuilder cards={cards} boxes={boxes} lots={lots} boxName={lotBuilderBoxName || undefined} createLot={createLot} updateLot={updateLot} deleteLot={deleteLot} markLotListed={markLotListed} markLotSold={markLotSold} markLotShipped={markLotShipped} fetchLots={fetchLots} fetchCards={fetchCards} onNavigate={(t: any) => setScreen(t.screen as Screen)} />{bottomNav}</>;

  if (screen === "gradeCheck") return <><GradeCheck cards={cards} boxes={boxes} updateCard={updateCard} submitForGrading={submitForGrading} addBox={addBox} getNextPosition={getBoxNextPosition} onNavigate={(t: any) => { if (t.boxName) setSmartPullBoxName(t.boxName); setScreen(t.screen as Screen); }} />{bottomNav}</>;

  if (screen === "gradingReturn") return <><GradingReturn cards={cards} boxes={boxes} updateCard={updateCard} returnFromGrading={returnFromGrading} addBox={addBox} getNextPosition={getBoxNextPosition} onNavigate={(t: any) => setScreen(t.screen as Screen)} />{bottomNav}</>;

  if (screen === "smartPull" && smartPullBoxName) return <><SmartPull boxName={smartPullBoxName} cards={cards} boxes={boxes} updateCard={updateCard} addBox={addBox} getNextPosition={getBoxNextPosition} renumberBox={renumberBox} fetchCards={fetchCards} onNavigate={(t: any) => { if (t.card && t.screen === "cardDetail") { goToCardDetail(t.card, "smartPull", { boxName: smartPullBoxName }); return; } if (t.boxName) setLotBuilderBoxName(t.boxName); if (t.filter) setStatusFilter(t.filter); setScreen(t.screen as Screen); }} />{bottomNav}</>;

  if (screen === "storage") return <><StorageView cards={cards} boxes={boxes} ecosystemMode={mode} initialBoxName={storageInitialBox} onBack={() => { setStorageInitialBox(""); setScreen(homeScreenForMode()); }} addBox={addBox} updateBox={updateBox} deleteBox={deleteBox} updateCard={updateCard} onCardTap={(card, boxName) => goToCardDetail(card, "storage", { boxName })} onNavigate={(t: any) => { if (t.boxName) { setSmartPullBoxName(t.boxName); setLotBuilderBoxName(t.boxName); } setScreen(t.screen as Screen); }} getNextPosition={getBoxNextPosition} getBoxCards={getBoxCards} />{bottomNav}</>;

  if (screen === "cardDetail" && selectedCard) {
    const liveCard = cards.find(c => c.id === selectedCard.id) || selectedCard;
    return <><CardDetail card={liveCard} boxes={boxes} onBack={goBackFromDetail} updateCard={updateCard} deleteCard={async (id) => { await deleteCard(id); goBackFromDetail(); }} markListed={markListed} markSold={markSold} markShipped={markShipped} submitForGrading={submitForGrading} returnFromGrading={returnFromGrading} getNextPosition={getBoxNextPosition} />{bottomNav}</>;
  }

  if (screen === "cardCheck") return (<>
    <Shell title="Check a Card" back={() => setScreen(homeScreenForMode())}>
      <div style={{ paddingTop: 20 }}>
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f); }} />

        <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", aspectRatio: scanPreview ? "3/4" : "auto", height: scanPreview ? "auto" : 120, background: scanPreview ? surface : "linear-gradient(135deg, " + surface + ", " + surface2 + ")", border: scanning ? "2px solid " + accent : "2px dashed " + border, borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 16, position: "relative", overflow: "hidden", padding: 0 }}>
          {scanPreview && <img src={scanPreview} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />}
          {!scanPreview && !scanning && (<><div style={{ fontSize: 32, marginBottom: 6 }}>📸</div><div style={{ fontSize: 15, fontWeight: 700, color: text }}>Snap a Photo</div><div style={{ fontSize: 12, color: muted, marginTop: 4 }}>AI identifies the card for you</div></>)}
          {scanning && (<div style={{ background: "rgba(0,0,0,0.6)", position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: accent, fontSize: 14, fontWeight: 600 }}>Identifying card...</div></div>)}
          {scanPreview && !scanning && (<div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: green, fontWeight: 600 }}>Tap to rescan</div>)}
        </button>

        {scanResult?.error && <div style={{ background: red + "10", border: "1px solid " + red + "30", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: red }}>{scanResult.error}</div>}
        {scanResult?.success && <div style={{ background: green + "10", border: "1px solid " + green + "30", borderRadius: 12, padding: "12px 16px", marginBottom: 12, fontSize: 14.5, color: green, fontWeight: 500 }}>Identified: {checkName} (Confidence: {typeof scanResult.confidence === "number" ? (scanResult.confidence * 100).toFixed(0) : scanResult.confidence || "?"}%)</div>}

        <div style={{ textAlign: "center", fontSize: 12, color: muted, marginBottom: 12 }}>— or enter manually —</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "#f0c040", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Card Name</label>
          <input value={checkName} onChange={e => { setCheckName(e.target.value); if (scanResult?.success) setNameEdited(true); }} placeholder="2020 Prizm Silver Justin Herbert RC" style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 12, padding: "14px 16px", minHeight: 48, color: text, fontFamily: font, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "#f0c040", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Asking Price ($)</label>
          <input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={askingPrice || ""} onChange={e => setAskingPrice(+e.target.value || 0)} placeholder="What they want" style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 12, padding: "14px 16px", minHeight: 48, color: text, fontFamily: font, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
        {nameEdited && <div style={{ fontSize: 12, color: cyan, marginBottom: 8, textAlign: "center" }}>Card name changed — tap Look Up Prices for updated values</div>}
        <button disabled={lookingUp || checkName.length <= 3} onClick={async () => { if (lookingUp || checkName.length <= 3) return; setLookingUp(true); setLookupError(""); setCheckRaw(0); setCheckPsa10(0); setCheckPsa9(0); setCheckPsa8(0); try { const priceRes = await fetch("/api/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search_query: checkName }) }); const priceData = await priceRes.json(); setNameEdited(false); if (priceData.error) { setLookupError(priceData.error.includes("exceeded") ? "no_data" : priceData.error); } else if (priceData.prices) { const p = priceData.prices; if (p.psa10 || p.psa9 || p.psa8 || p.raw) { if (p.psa10) setCheckPsa10(p.psa10); if (p.psa9) setCheckPsa9(p.psa9); if (p.psa8) setCheckPsa8(p.psa8); const raw = p.raw || (p.psa9 ? +(p.psa9 * 0.6).toFixed(2) : 0) || (p.psa10 ? +(p.psa10 * 0.35).toFixed(2) : 0); if (raw) setCheckRaw(raw); if (p.raw) setCheckRaw(p.raw); } else { setLookupError("no_data"); } } } catch(e: any) { setLookupError("Lookup failed: " + e.message); } finally { setLookingUp(false); } }} style={{ width: "100%", padding: "14px 16px", minHeight: 48, background: cyan + "15", border: "1px solid " + cyan + "30", borderRadius: 12, color: cyan, fontFamily: font, fontSize: 15, fontWeight: 600, cursor: lookingUp ? "wait" : "pointer", marginBottom: 4, opacity: checkName.length > 3 ? 1 : 0.4, transition: "opacity 0.2s" }}>{lookingUp ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid " + cyan + "40", borderTopColor: cyan, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Searching...</span> : "Look Up Prices"}</button>
        {lookupError && lookupError !== "no_data" && <div style={{ fontSize: 12, color: muted, marginBottom: 10, textAlign: "center" }}>{lookupError}</div>}
        {lookupError === "no_data" && <div style={{ textAlign: "center", marginBottom: 10 }}><div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Pricing not available — enter values manually or tap below to search eBay</div><a href={"https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(checkName) + "&LH_Complete=1&LH_Sold=1&_sacat=261328"} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 20px", minHeight: 44, background: "#3665f3" + "18", border: "1px solid #3665f3" + "40", borderRadius: 10, color: "#3665f3", fontFamily: font, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Search eBay Sold Listings</a></div>}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <label style={{ fontSize: 11, color: "#f0c040", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Raw Value ($) <span style={{ fontWeight: 400, textTransform: "none" }}>— eBay sold price</span></label>
          <input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={checkRaw || ""} onChange={e => setCheckRaw(+e.target.value || 0)} placeholder="What it sells for raw" style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 12, padding: "14px 16px", minHeight: 48, color: text, fontFamily: font, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          <div><label style={{ fontSize: 11, color: "#ef4444", display: "block", marginBottom: 4 }}>💎 PSA 10 ($)</label><input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={checkPsa10 || ""} onChange={e => setCheckPsa10(+e.target.value || 0)} style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 10px", minHeight: 48, color: text, fontFamily: mono, fontSize: 15, outline: "none", boxSizing: "border-box" }} /></div>
          <div><label style={{ fontSize: 11, color: "#ef4444", display: "block", marginBottom: 4 }}>PSA 9 ($)</label><input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={checkPsa9 || ""} onChange={e => setCheckPsa9(+e.target.value || 0)} style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 10px", minHeight: 48, color: text, fontFamily: mono, fontSize: 15, outline: "none", boxSizing: "border-box" }} /></div>
          <div><label style={{ fontSize: 11, color: "#ef4444", display: "block", marginBottom: 4 }}>PSA 8 ($)</label><input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={checkPsa8 || ""} onChange={e => setCheckPsa8(+e.target.value || 0)} style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 10px", minHeight: 48, color: text, fontFamily: mono, fontSize: 15, outline: "none", boxSizing: "border-box" }} /></div>
        </div>
        <button onClick={() => { if (checkRaw > 0) setScreen("cardResult"); }} style={{ width: "100%", padding: "16px", minHeight: 52, background: green, border: "none", borderRadius: 12, color: "#ffffff", fontFamily: font, fontSize: 17, fontWeight: 700, cursor: "pointer", opacity: checkRaw > 0 ? 1 : 0.4 }}>Evaluate Card</button>
      </div>
    </Shell>
    {bottomNav}</>
  );

  if (screen === "cardResult") {
    const rawVal = checkRaw;
    const psa10 = +(checkPsa10 || rawVal * 3).toFixed(2);
    const psa9 = +(checkPsa9 || rawVal * 1.8).toFixed(2);
    const psa8 = +(checkPsa8 || rawVal * 1.2).toFixed(2);
    const psa7 = +(rawVal * 0.8).toFixed(2);
    const gemRate = 15;
    const ebayFee = +(rawVal * 0.1325 + 0.30).toFixed(2);
    const ship = rawVal >= 20 ? 4.50 : 1.05;
    const flipNet = +(rawVal - ebayFee - ship).toFixed(2);
    const flipProfit = +(flipNet - askingPrice).toFixed(2);
    const flipROI = askingPrice > 0 ? +((flipProfit / askingPrice) * 100).toFixed(0) : 0;
    const gradeCost = 25;
    const expectedGrade = +(psa10 * 0.15 + psa9 * 0.35 + psa8 * 0.30 + psa7 * 0.20).toFixed(2);
    const expectedFees = +(expectedGrade * 0.1325 + 0.30).toFixed(2);
    const expectedNet = +(expectedGrade - expectedFees - ship - gradeCost).toFixed(2);
    const expectedProfit = +(expectedNet - askingPrice).toFixed(2);
    const expectedROI = askingPrice > 0 ? +((expectedProfit / askingPrice) * 100).toFixed(0) : 0;
    const maxPayRaw = +flipNet.toFixed(2);
    const belowMarket = askingPrice > 0 && rawVal > 0 ? +(((rawVal - askingPrice) / rawVal) * 100).toFixed(0) : 0;
    const verdict = flipROI > 20 ? "buy" : flipROI > 0 ? "maybe" : "pass";
    const gradeBreakdown = [{ grade: "PSA 10", prob: "15%", val: psa10, color: green }, { grade: "PSA 9", prob: "35%", val: psa9, color: cyan }, { grade: "PSA 8", prob: "30%", val: psa8, color: text }, { grade: "PSA 7", prob: "20%", val: psa7, color: muted }];
    return (<>
      <Shell title={checkName || "Card Check"} back={() => setScreen("cardCheck")}>
        <div style={{ paddingTop: 16 }}>
          {checkName && <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{checkName}</div>}
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: muted }}>Asking price</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: muted, fontSize: 18 }}>$</span><input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={askingPrice || ""} onChange={e => setAskingPrice(+e.target.value || 0)} style={{ width: 90, background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", minHeight: 48, color: text, fontFamily: mono, fontSize: 22, fontWeight: 700, outline: "none", textAlign: "right" }} /></div>
            </div>
            {belowMarket > 0 && <div style={{ fontSize: 12, color: green, marginTop: 6, textAlign: "right" }}>{belowMarket}% below market</div>}
          </div>
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Market values</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, textAlign: "center" }}>
              {[{ l: "Raw", v: rawVal, c: text }, { l: "PSA 10", v: psa10, c: green }, { l: "PSA 9", v: psa9, c: cyan }, { l: "PSA 8", v: psa8, c: muted }].map(g => (
                <div key={g.l}><div style={{ fontSize: 9, color: muted, marginBottom: 2 }}>{g.l}</div><div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: g.c }}>${g.v}</div></div>
              ))}
            </div>
          </div>
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>If you buy at ${askingPrice}</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>Flip raw on eBay</span><span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: flipProfit > 0 ? green : red }}>{flipProfit > 0 ? "+" : ""}${flipProfit}</span></div>
              <div style={{ height: 6, background: surface2, borderRadius: 3, marginBottom: 4 }}><div style={{ height: 6, background: flipROI > 20 ? green : flipROI > 0 ? accent : red, borderRadius: 3, width: Math.min(Math.max(flipROI, 0), 100) + "%" }} /></div>
              <div style={{ fontSize: 11, color: muted }}>{flipROI}% ROI · Fees ${ebayFee} · Ship ${ship}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>Grade & sell (expected avg)</span><span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: expectedProfit > 0 ? green : red }}>{expectedProfit > 0 ? "+" : ""}${expectedProfit}</span></div>
              <div style={{ height: 6, background: surface2, borderRadius: 3, marginBottom: 4 }}><div style={{ height: 6, background: expectedROI > 20 ? purple : expectedROI > 0 ? accent : red, borderRadius: 3, width: Math.min(Math.max(expectedROI, 0), 100) + "%" }} /></div>
              <div style={{ fontSize: 11, color: muted }}>{expectedROI}% ROI · Grade cost $25 · Gem rate {gemRate}%</div>
            </div>
            <div style={{ borderTop: "1px solid " + border, paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Per-grade breakdown</div>
              {gradeBreakdown.map(g => { const gFees = +(g.val * 0.1325 + 0.30).toFixed(2); const gShip = g.val >= 20 ? 4.50 : 1.05; const gProfit = +(g.val - gFees - gShip - 25 - askingPrice).toFixed(2); return (
                <div key={g.grade} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + border }}>
                  <div><span style={{ fontSize: 13, fontWeight: 600, color: g.color }}>{g.grade}</span><span style={{ fontSize: 11, color: muted, marginLeft: 6 }}>({g.prob})</span></div>
                  <div style={{ textAlign: "right" }}><span style={{ fontSize: 11, color: muted, marginRight: 8 }}>${g.val}</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: gProfit > 0 ? green : red }}>{gProfit > 0 ? "+" : ""}${gProfit}</span></div>
                </div>); })}
            </div>
          </div>
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Max pay</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: muted }}>Break even (raw flip)</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600 }}>${maxPayRaw}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: muted }}>For 20% profit</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600 }}>${+(maxPayRaw / 1.2).toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: muted }}>Grade break even</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600 }}>${expectedNet}</span></div>
          </div>
          <div style={{ background: verdict === "buy" ? green + "10" : verdict === "maybe" ? accent + "10" : red + "10", border: "1px solid " + (verdict === "buy" ? green + "30" : verdict === "maybe" ? accent + "30" : red + "30"), borderRadius: 14, padding: 16, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: verdict === "buy" ? green : verdict === "maybe" ? accent : red, marginBottom: 4 }}>{verdict === "buy" ? "BUY" : verdict === "maybe" ? "NEGOTIATE" : "PASS"}</div>
            <div style={{ fontSize: 12, color: muted }}>{verdict === "buy" ? "Good at $" + askingPrice + " — " + belowMarket + "% below market" : verdict === "maybe" ? "Tight margin — try $" + +(maxPayRaw / 1.2).toFixed(0) : "Overpaying — max $" + maxPayRaw}</div>
          </div>
          {showBuyFlow ? (
            <BuyFlow
              isManual={!scanResult?.success}
              cardData={scanResult?.success ? {
                player: scanResult.player,
                year: scanResult.year,
                brand: scanResult.brand,
                set: scanResult.set,
                parallel: scanResult.parallel || "Base",
                card_number: scanResult.card_number || "",
                sport: scanResult.sport || "Baseball",
                raw_value: checkRaw,
                cost_basis: askingPrice,
                graded_values: { "10": checkPsa10 || rawVal * 3, "9": checkPsa9 || rawVal * 1.8, "8": checkPsa8 || rawVal * 1.2, "7": psa7 },
              } : {
                ...parseCardName(checkName),
                raw_value: checkRaw,
                cost_basis: askingPrice,
                graded_values: { "10": checkPsa10 || rawVal * 3, "9": checkPsa9 || rawVal * 1.8, "8": checkPsa8 || rawVal * 1.2, "7": psa7 },
              }}
              boxes={boxes}
              getNextPosition={getBoxNextPosition}
              addCard={addCard}
              addBox={addBox}
              onDone={() => { setShowBuyFlow(false); setScreen(homeScreenForMode()); }}
              onCancel={() => setShowBuyFlow(false)}
            />
          ) : (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowBuyFlow(true)} style={{ flex: 1, padding: "18px", background: green, border: "none", borderRadius: 14, color: "#fff", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>BUY</button>
              <button onClick={() => setScreen(homeScreenForMode())} style={{ flex: 1, padding: "18px", background: surface2, border: "1px solid " + border, borderRadius: 14, color: muted, fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>PASS</button>
            </div>
          )}
        </div>
      </Shell>
      {bottomNav}</>
    );
  }

  return null;
}
