"use client";
import { useState, useRef } from "react";
import { NewCard } from "@/lib/types";
import { Box, BoxType } from "@/hooks/useBoxes";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, purple, muted, text, font, mono } from "./styles";

const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", minHeight: 44, color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" as const, width: "100%" };
const labelStyle = { fontSize: 10, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 4 };
const btnStyle = { padding: "12px 16px", minHeight: 48, border: "none", borderRadius: 12, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" };

function compressImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w; canvas.height = h;
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

type Screen = "setup" | "scan" | "review" | "summary";

interface SavedCard { player: string; position: number; rawValue: number; gradeCandidate: boolean }

interface Props {
  boxes: Box[];
  addCard: (card: Partial<NewCard>) => Promise<{ data: any; error: any }>;
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType) => Promise<any>;
  getNextPosition: (boxName: string) => number;
  onNavigate: (target: { screen: string }) => void;
}

export function ScanToCollection({ boxes, addCard, addBox, getNextPosition, onNavigate }: Props) {
  const [screen, setScreen] = useState<Screen>("setup");

  // Session state
  const [targetBox, setTargetBox] = useState(boxes[0]?.name || "");
  const [costPerCard, setCostPerCard] = useState(0);
  const [sessionCards, setSessionCards] = useState<SavedCard[]>([]);

  // New box inline
  const [showNewBox, setShowNewBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState("");

  // Scan state
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Card fields
  const [cardName, setCardName] = useState("");
  const [player, setPlayer] = useState("");
  const [year, setYear] = useState(0);
  const [brand, setBrand] = useState("");
  const [cardSet, setCardSet] = useState("");
  const [parallel, setParallel] = useState("Base");
  const [cardNumber, setCardNumber] = useState("");
  const [sport, setSport] = useState("Baseball");
  const [condition, setCondition] = useState("NM");
  const [isRc, setIsRc] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const [isNumbered, setIsNumbered] = useState(false);

  // Pricing
  const [rawValue, setRawValue] = useState(0);
  const [psa10, setPsa10] = useState(0);
  const [psa9, setPsa9] = useState(0);
  const [psa8, setPsa8] = useState(0);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState("");

  const resetCard = () => {
    setPreview(null); setScanResult(null); setCardName(""); setPlayer(""); setYear(0); setBrand(""); setCardSet(""); setParallel("Base"); setCardNumber(""); setSport("Baseball"); setCondition("NM"); setIsRc(false); setIsAuto(false); setIsNumbered(false); setRawValue(0); setPsa10(0); setPsa9(0); setPsa8(0); setSaveFlash("");
  };

  const handleScan = async (file: File) => {
    setScanning(true);
    setPreview(URL.createObjectURL(file));
    setScanResult(null);
    try {
      const base64 = await compressImage(file, 800);
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: base64 }) });
      const data = await res.json();
      if (data.success) {
        setScanResult(data);
        setPlayer(data.player || "");
        setYear(data.year || 0);
        setBrand(data.brand || "");
        setCardSet(data.set || "");
        setParallel(data.parallel || "Base");
        setCardNumber(data.card_number || "");
        setSport(data.sport || "Baseball");
        setCardName([data.year, data.brand, data.set !== data.brand ? data.set : "", data.parallel !== "Base" ? data.parallel : "", data.player, data.card_number].filter(Boolean).join(" "));
        if (data.pricing?.raw) setRawValue(data.pricing.raw);
        if (data.pricing?.psa10) setPsa10(data.pricing.psa10);
        if (data.pricing?.psa9) setPsa9(data.pricing.psa9);
        if (data.pricing?.psa8) setPsa8(data.pricing.psa8);
      } else {
        setScanResult({ error: data.error || "Could not identify card" });
      }
    } catch (err: any) {
      setScanResult({ error: err.message });
    }
    setScanning(false);
    setScreen("review");
  };

  const handleLookup = async () => {
    setLookingUp(true);
    try {
      const res = await fetch("/api/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search_query: cardName || player }) });
      const data = await res.json();
      if (data.prices) {
        if (data.prices.raw) setRawValue(data.prices.raw);
        if (data.prices.psa10) setPsa10(data.prices.psa10);
        if (data.prices.psa9) setPsa9(data.prices.psa9);
        if (data.prices.psa8) setPsa8(data.prices.psa8);
      }
    } catch {}
    setLookingUp(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const pos = getNextPosition(targetBox);
    const rv = rawValue || 0;
    const p10 = psa10 || rv * 3;
    const p9 = psa9 || rv * 1.8;
    const p8 = psa8 || rv * 1.2;
    const gradeRatio = rv > 0 ? p10 / rv : 0;
    const gradeCandidate = gradeRatio >= 5 && rv >= 5;

    const { error } = await addCard({
      player: player || cardName || "Unknown",
      year: year || new Date().getFullYear(),
      brand, set: cardSet, parallel, card_number: cardNumber,
      sport: sport as any, condition: condition as any,
      is_rc: isRc, is_auto: isAuto, is_numbered: isNumbered,
      raw_value: rv, cost_basis: costPerCard,
      graded_values: { "10": +p10.toFixed(2), "9": +p9.toFixed(2), "8": +p8.toFixed(2), "7": +(rv * 0.8).toFixed(2) },
      grade_candidate: gradeCandidate,
      storage_box: targetBox, storage_row: 1, storage_position: pos,
      notes: "Scan to Collection",
    });

    setSaving(false);
    if (!error) {
      setSessionCards(prev => [...prev, { player: player || cardName, position: pos, rawValue: rv, gradeCandidate }]);
      setSaveFlash(`Saved! ${targetBox} #${pos}`);
      setTimeout(() => { resetCard(); setScreen("scan"); setTimeout(() => fileRef.current?.click(), 100); }, 800);
    }
  };

  const position = getNextPosition(targetBox);
  const tier = rawValue >= 100 ? "Gem" : rawValue >= 25 ? "Star" : rawValue >= 5 ? "Core" : "Bulk";
  const tierColor = tier === "Gem" ? accent : tier === "Star" ? green : tier === "Core" ? text : muted;
  const p10val = psa10 || rawValue * 3;
  const p9val = psa9 || rawValue * 1.8;
  const p8val = psa8 || rawValue * 1.2;
  const gradeRatio = rawValue > 0 ? (p10val / rawValue).toFixed(1) : "0";
  const isGradeCandidate = +gradeRatio >= 5 && rawValue >= 5;
  const gradeCost = 25;
  const calcGradeProfit = (gv: number) => +(gv - gv * 0.1325 - 4.50 - gradeCost - costPerCard).toFixed(2);

  // ─── SETUP ───
  if (screen === "setup") return (
    <Shell title="Scan to Collection" back={() => onNavigate({ screen: "home" })}>
      <div style={{ paddingTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Target Box</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {boxes.map(b => <button key={b.id} onClick={() => setTargetBox(b.name)} style={{ ...btnStyle, padding: "10px 14px", background: targetBox === b.name ? green + "20" : surface2, border: "1px solid " + (targetBox === b.name ? green + "50" : border), color: targetBox === b.name ? green : muted, fontSize: 13 }}>{b.name} ({b.card_count})</button>)}
            <button onClick={() => setShowNewBox(true)} style={{ ...btnStyle, padding: "10px 14px", background: surface2, border: "1px dashed " + border, color: muted, fontSize: 13 }}>+ New</button>
          </div>
          {showNewBox && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input value={newBoxName} onChange={e => setNewBoxName(e.target.value)} placeholder="Box name" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={async () => { if (!newBoxName.trim()) return; await addBox(newBoxName.trim(), 1, 50, "scanned"); setTargetBox(newBoxName.trim()); setShowNewBox(false); setNewBoxName(""); }} style={{ ...btnStyle, background: green, color: "#fff", padding: "10px 16px" }}>Add</button>
            </div>
          )}
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={labelStyle}>Cost Per Card ($) <span style={{ textTransform: "none", fontWeight: 400 }}>— optional, for packs: price ÷ count</span></div>
          <input type="text" inputMode="decimal" value={costPerCard || ""} onChange={e => setCostPerCard(+e.target.value || 0)} placeholder="0" style={inputStyle} />
        </div>
        <button disabled={!targetBox} onClick={() => { setScreen("scan"); setTimeout(() => fileRef.current?.click(), 100); }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", fontSize: 17, fontWeight: 700, opacity: targetBox ? 1 : 0.4 }}>Start Scanning</button>
      </div>
    </Shell>
  );

  // ─── SCAN ───
  if (screen === "scan") return (
    <Shell title={`Scan #${sessionCards.length + 1}`} back={() => sessionCards.length > 0 ? setScreen("summary") : setScreen("setup")}>
      <div style={{ paddingTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: surface, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 11 }}>
          <span style={{ color: muted }}>📦 {targetBox}</span>
          {costPerCard > 0 && <span style={{ color: muted }}>${costPerCard}/card</span>}
          <span style={{ color: green }}>{sessionCards.length} saved</span>
        </div>

        <input type="file" accept="image/*" capture="environment" ref={fileRef} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f); e.target.value = ""; }} />

        <button onClick={() => fileRef.current?.click()} style={{ width: "100%", height: 160, background: "linear-gradient(135deg, " + surface + ", " + surface2 + ")", border: "2px dashed " + border, borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 12 }}>
          {scanning ? <div style={{ color: accent, fontSize: 14, fontWeight: 600 }}>Identifying card...</div> : <><div style={{ fontSize: 40, marginBottom: 6 }}>📸</div><div style={{ fontSize: 15, fontWeight: 700, color: text }}>Tap to Scan</div></>}
        </button>

        {sessionCards.length > 0 && <button onClick={() => setScreen("summary")} style={{ width: "100%", ...btnStyle, background: surface2, border: "1px solid " + border, color: muted }}>Done — View Summary</button>}
      </div>
    </Shell>
  );

  // ─── REVIEW ───
  if (screen === "review") return (
    <Shell title={`Scan #${sessionCards.length + 1}`} back={() => setScreen("scan")}>
      <div style={{ paddingTop: 8 }}>
        {/* Session bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: surface, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 11 }}>
          <span style={{ color: muted }}>📦 {targetBox} → #{position}</span>
          <span style={{ color: green }}>{sessionCards.length} saved</span>
        </div>

        {/* Save flash */}
        {saveFlash && <div style={{ background: green + "15", border: "1px solid " + green + "30", borderRadius: 10, padding: "10px", marginBottom: 12, fontSize: 14, color: green, textAlign: "center", fontWeight: 700 }}>{saveFlash}</div>}

        {/* Card image */}
        {preview && <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", marginBottom: 12, background: surface }}><img src={preview} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>}

        {/* Scan result */}
        {scanResult?.error && <div style={{ background: red + "10", border: "1px solid " + red + "30", borderRadius: 10, padding: "10px", marginBottom: 12, fontSize: 12, color: red }}>{scanResult.error}</div>}
        {scanResult?.success && <div style={{ background: green + "10", border: "1px solid " + green + "30", borderRadius: 10, padding: "10px", marginBottom: 12, fontSize: 13, color: green, fontWeight: 500 }}>Identified: {cardName} ({typeof scanResult.confidence === "number" ? (scanResult.confidence * 100).toFixed(0) + "%" : "?"})</div>}

        {/* Editable fields */}
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Card Name</div>
          <input value={cardName} onChange={e => { setCardName(e.target.value); setPlayer(e.target.value); }} style={inputStyle} />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {["Baseball", "Football", "Basketball", "Hockey", "Soccer"].map(s => <button key={s} onClick={() => setSport(s)} style={{ ...btnStyle, padding: "6px 10px", fontSize: 11, background: sport === s ? cyan + "20" : surface2, border: "1px solid " + (sport === s ? cyan + "50" : border), color: sport === s ? cyan : muted }}>{s}</button>)}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {["Base", "Silver", "Gold", "Holo", "Refractor", "Numbered"].map(p => <button key={p} onClick={() => setParallel(p)} style={{ ...btnStyle, padding: "6px 10px", fontSize: 11, background: parallel === p ? cyan + "20" : surface2, border: "1px solid " + (parallel === p ? cyan + "50" : border), color: parallel === p ? cyan : muted }}>{p}</button>)}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[{ label: "RC", val: isRc, set: setIsRc, c: green }, { label: "AUTO", val: isAuto, set: setIsAuto, c: purple }, { label: "#/d", val: isNumbered, set: setIsNumbered, c: cyan }].map(t => (
            <button key={t.label} onClick={() => t.set(!t.val)} style={{ ...btnStyle, flex: 1, padding: "8px", fontSize: 11, background: t.val ? t.c + "20" : surface2, border: "1px solid " + (t.val ? t.c + "50" : border), color: t.val ? t.c : muted }}>{t.val ? "✓ " : ""}{t.label}</button>
          ))}
        </div>

        {/* Pricing */}
        <button disabled={lookingUp || !cardName} onClick={handleLookup} style={{ width: "100%", ...btnStyle, background: cyan + "15", border: "1px solid " + cyan + "30", color: cyan, marginBottom: 10, fontSize: 13, opacity: cardName ? 1 : 0.4 }}>{lookingUp ? "Searching..." : "Look Up Prices"}</button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
          {[{ l: "Raw", v: rawValue, s: setRawValue }, { l: "PSA 10", v: psa10, s: setPsa10 }, { l: "PSA 9", v: psa9, s: setPsa9 }, { l: "PSA 8", v: psa8, s: setPsa8 }].map(f => (
            <div key={f.l}>
              <div style={{ fontSize: 9, color: muted, marginBottom: 2 }}>{f.l}</div>
              <input type="text" inputMode="decimal" value={f.v || ""} onChange={e => f.s(+e.target.value || 0)} style={{ ...inputStyle, fontSize: 13, padding: "8px 6px", textAlign: "center", fontFamily: mono }} />
            </div>
          ))}
        </div>

        {/* Analytics */}
        {rawValue > 0 && (
          <div style={{ background: surface, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: tierColor + "15", border: "1px solid " + tierColor + "30", color: tierColor, fontWeight: 700 }}>{tier}</span>
              {isGradeCandidate && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: accent + "15", border: "1px solid " + accent + "30", color: accent, fontWeight: 700 }}>GRADE CANDIDATE</span>}
            </div>
            <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>PSA 10 is {gradeRatio}x raw value</div>

            <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Grade Breakdown</div>
            {[{ g: "PSA 10", v: p10val, c: green }, { g: "PSA 9", v: p9val, c: cyan }, { g: "PSA 8", v: p8val, c: text }, { g: "PSA 7", v: +(rawValue * 0.8).toFixed(2), c: muted }].map(g => {
              const profit = calcGradeProfit(g.v);
              return (
                <div key={g.g} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + border }}>
                  <span style={{ fontSize: 12, color: g.c }}>{g.g} <span style={{ color: muted }}>${g.v.toFixed(0)}</span></span>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: profit > 0 ? green : red }}>{profit > 0 ? "+" : ""}${profit}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Save */}
        <button disabled={saving} onClick={handleSave} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{saving ? "Saving..." : `Save to ${targetBox} → #${position}`}</button>
        <button onClick={() => { resetCard(); setScreen("scan"); setTimeout(() => fileRef.current?.click(), 100); }} style={{ width: "100%", background: "none", border: "none", color: muted, fontFamily: font, fontSize: 13, cursor: "pointer", padding: "10px" }}>Skip — Don't Save</button>
      </div>
    </Shell>
  );

  // ─── SUMMARY ───
  if (screen === "summary") {
    const totalValue = sessionCards.reduce((s, c) => s + c.rawValue, 0);
    const totalCost = sessionCards.length * costPerCard;
    const above20 = sessionCards.filter(c => c.rawValue >= 20).length;
    const gradeCandidates = sessionCards.filter(c => c.gradeCandidate).length;
    const bulk = sessionCards.filter(c => c.rawValue < 5).length;
    const positions = sessionCards.map(c => c.position);
    const posRange = positions.length > 0 ? `${Math.min(...positions)}–${Math.max(...positions)}` : "—";

    return (
      <Shell title="Session Complete" back={() => onNavigate({ screen: "home" })}>
        <div style={{ paddingTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: green, marginBottom: 4 }}>{sessionCards.length} cards added</div>
          <div style={{ fontSize: 13, color: muted }}>to {targetBox} · Positions {posRange}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 20, marginBottom: 20 }}>
            <div style={{ background: surface, borderRadius: 12, padding: 14 }}><div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: green }}>${totalValue.toFixed(0)}</div><div style={{ fontSize: 10, color: muted }}>Total Value</div></div>
            <div style={{ background: surface, borderRadius: 12, padding: 14 }}><div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: text }}>${totalCost.toFixed(0)}</div><div style={{ fontSize: 10, color: muted }}>Total Cost</div></div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
            {above20 > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: green + "15", color: green, fontWeight: 600 }}>{above20} above $20</span>}
            {gradeCandidates > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: accent + "15", color: accent, fontWeight: 600 }}>{gradeCandidates} grade candidates</span>}
            {bulk > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: surface2, color: muted, fontWeight: 600 }}>{bulk} bulk</span>}
          </div>

          <button onClick={() => onNavigate({ screen: "smartPull", boxName: targetBox } as any)} style={{ width: "100%", ...btnStyle, background: "#a855f715", border: "1px solid #a855f730", color: "#a855f7", marginBottom: 8 }}>Run Smart Pull on {targetBox}</button>
          <button onClick={() => onNavigate({ screen: "myCards" })} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", marginBottom: 8 }}>View Added Cards</button>
          <button onClick={() => onNavigate({ screen: "home" })} style={{ width: "100%", ...btnStyle, background: surface2, border: "1px solid " + border, color: muted }}>Back to Home</button>
        </div>
      </Shell>
    );
  }

  return null;
}
