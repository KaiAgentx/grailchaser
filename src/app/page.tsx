"use client";
import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCards } from "@/hooks/useCards";
import { PLATFORMS, calcNet, calcShipping } from "@/lib/utils";
import { LoginScreen } from "@/components/LoginScreen";
import { Dashboard } from "@/components/Dashboard";
import { CardDetail } from "@/components/CardDetail";
import { StorageView } from "@/components/StorageView";
import { CsvImport } from "@/components/CsvImport";
import { PickList } from "@/components/PickList";
import { ScanToCollection } from "@/components/ScanToCollection";
import { BuyFlow, parseCardName } from "@/components/BuyFlow";
import { Shell } from "@/components/Shell";
import { useBoxes } from "@/hooks/useBoxes";
import { bg, surface, surface2, border, accent, green, red, cyan, purple, muted, text, font, mono } from "@/components/styles";

type Screen = "home" | "addCard" | "myCards" | "cardDetail" | "cardCheck" | "cardResult" | "storage" | "csvImport" | "pickList" | "scanToCollection";

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
  const { cards, loading, addCard, addCards, deleteCard, updateCard, markListed, markSold, markShipped, submitForGrading, returnFromGrading, getNextPosition } = useCards(user?.id);
  const { boxes, addBox, updateBox, deleteBox, getNextPosition: getBoxNextPosition, getBoxCards } = useBoxes(user?.id, cards);
  const [buyConfirm, setBuyConfirm] = useState("");
  const [showBuyFlow, setShowBuyFlow] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedCard, setSelectedCard] = useState<any>(null);
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
  const totalValue = cards.reduce((s, c) => s + (c.raw_value || 0), 0);
  const unsold = cards.filter(c => !c.sold);
  const listed = cards.filter(c => c.status === "listed");
  const grading = cards.filter(c => c.status === "grading");
  const filteredCards = (statusFilter === "pending" ? cards.filter(c => !c.storage_box || c.storage_box === "PENDING") : statusFilter === "stale" ? listed.filter(c => c.listed_date && (Date.now() - new Date(c.listed_date).getTime()) / 86400000 > 14) : statusFilter ? cards.filter(c => c.status === statusFilter) : unsold).filter(c => filterSport === "All" || c.sport === filterSport).filter(c => !search || c.player.toLowerCase().includes(search.toLowerCase()) || c.brand.toLowerCase().includes(search.toLowerCase()));
  const sports = ["All", ...Array.from(new Set(cards.map(c => c.sport)))];

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
        <div style={{ background: "linear-gradient(160deg, #b8860b, #f0c040 40%, #daa520 60%, #b8860b)", borderRadius: 14, padding: "20px 28px 16px", marginBottom: 12, boxShadow: "0 4px 24px rgba(184,134,11,0.25), inset 0 1px 0 rgba(255,255,255,0.15)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)" }} />
          <div style={{ position: "relative", fontSize: 28, fontWeight: 900, color: "#0a0a0f", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 1px 0 rgba(255,255,255,0.3)" }}>GRAILCHASER</div>
        </div>
        <div style={{ fontSize: 13, color: muted }}>Loading...</div>
      </div>
    </div>
  );

  if (!user) return <LoginScreen signIn={signIn} signUp={signUp} />;

  if (screen === "home") return (
    <Dashboard
      cards={cards}
      boxes={boxes}
      userEmail={user.email || ""}
      onNavigate={(t) => {
        if (t.screen === "cardCheck") { setCheckName(""); setCheckRaw(0); setCheckPsa10(0); setCheckPsa9(0); setCheckPsa8(0); setAskingPrice(0); setScanPreview(null); setScanResult(null); setLookupError(""); setNameEdited(false); }
        if (t.card) setSelectedCard(t.card);
        if (t.filter) setStatusFilter(t.filter);
        setScreen(t.screen as Screen);
      }}
      onSignOut={() => signOut()}
    />
  );

  if (screen === "addCard") return (
    <Shell title="Add Card" back={() => setScreen("home")}>
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
  );

  if (screen === "myCards") return (
    <Shell title={"My Cards (" + filteredCards.length + ")"} back={() => { setStatusFilter(""); setScreen("home"); }}>
      <div style={{ paddingTop: 12 }}>
        <input placeholder="Search player, brand, set..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 14, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
          {sports.map(s => (<button key={s} onClick={() => { setFilterSport(s); if (statusFilter === "pending") setStatusFilter(""); }} style={{ padding: "6px 14px", background: filterSport === s ? accent + "20" : surface2, border: "1px solid " + (filterSport === s ? accent + "50" : border), borderRadius: 20, color: filterSport === s ? accent : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{s}</button>))}
          <button onClick={() => setStatusFilter(statusFilter === "pending" ? "" : "pending")} style={{ padding: "6px 14px", background: statusFilter === "pending" ? red + "20" : surface2, border: "1px solid " + (statusFilter === "pending" ? red + "50" : border), borderRadius: 20, color: statusFilter === "pending" ? red : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Unassigned</button>
        </div>
        {loading && <div style={{ textAlign: "center", color: muted, padding: 40 }}>Loading...</div>}
        {!loading && filteredCards.length === 0 && (<div style={{ textAlign: "center", color: muted, padding: 40 }}><div style={{ fontSize: 36, marginBottom: 12 }}>📦</div><div style={{ fontSize: 14 }}>No cards yet</div></div>)}
        {filteredCards.map(card => (
          <button key={card.id} onClick={() => { setSelectedCard(card); setScreen("cardDetail"); }} style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 12, padding: "14px 16px", marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{card.player}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{card.year} {card.brand} {card.parallel !== "Base" ? card.parallel : ""} {card.card_number}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                {card.is_rc && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: green + "15", border: "1px solid " + green + "30", color: green, fontWeight: 600 }}>RC</span>}
                {card.is_auto && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: purple + "15", border: "1px solid " + purple + "30", color: purple, fontWeight: 600 }}>AUTO</span>}
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: surface2, color: muted }}>{card.sport}</span>
                {card.storage_box && card.storage_box !== "PENDING" ? <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: surface2, color: muted }}>{card.storage_box} #{card.storage_position}</span> : <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: red + "15", border: "1px solid " + red + "30", color: red, fontWeight: 600 }}>No Box</span>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}><div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: card.raw_value >= 25 ? green : card.raw_value >= 5 ? text : muted }}>${card.raw_value}</div><div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{card.status}</div></div>
          </button>
        ))}
      </div>
    </Shell>
  );

  if (screen === "csvImport") return <CsvImport onBack={() => setScreen("home")} addCards={addCards} />;

  if (screen === "pickList") return <PickList cards={cards} boxes={boxes} markShipped={markShipped} updateCard={updateCard} onBack={() => setScreen("home")} />;

  if (screen === "scanToCollection") return <ScanToCollection boxes={boxes} addCard={addCard} addBox={addBox} getNextPosition={getBoxNextPosition} onNavigate={(t) => setScreen(t.screen as Screen)} />;

  if (screen === "storage") return <StorageView cards={cards} boxes={boxes} onBack={() => setScreen("home")} addBox={addBox} updateBox={updateBox} deleteBox={deleteBox} updateCard={updateCard} onCardTap={(card) => { setSelectedCard(card); setScreen("cardDetail"); }} getNextPosition={getBoxNextPosition} getBoxCards={getBoxCards} />;

  if (screen === "cardDetail" && selectedCard) {
    const liveCard = cards.find(c => c.id === selectedCard.id) || selectedCard;
    return <CardDetail card={liveCard} boxes={boxes} onBack={() => setScreen("myCards")} updateCard={updateCard} deleteCard={async (id) => { await deleteCard(id); setScreen("myCards"); }} markListed={markListed} markSold={markSold} markShipped={markShipped} submitForGrading={submitForGrading} returnFromGrading={returnFromGrading} getNextPosition={getBoxNextPosition} />;
  }

  if (screen === "cardCheck") return (
    <Shell title="Check a Card" back={() => setScreen("home")}>
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
    return (
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
              onDone={() => { setShowBuyFlow(false); setScreen("home"); }}
              onCancel={() => setShowBuyFlow(false)}
            />
          ) : (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowBuyFlow(true)} style={{ flex: 1, padding: "18px", background: green, border: "none", borderRadius: 14, color: "#fff", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>BUY</button>
              <button onClick={() => setScreen("home")} style={{ flex: 1, padding: "18px", background: surface2, border: "1px solid " + border, borderRadius: 14, color: muted, fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>PASS</button>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  return null;
}
