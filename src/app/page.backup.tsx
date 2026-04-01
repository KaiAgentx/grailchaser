"use client";
import { useState } from "react";
import { useCards } from "@/hooks/useCards";
import { PLATFORMS, calcNet, calcShipping } from "@/lib/utils";

type Screen = "home" | "addCard" | "myCards" | "cardDetail" | "cardCheck" | "cardResult";

export default function Home() {
  const { cards, loading, addCard, updateCard, deleteCard } = useCards();
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [checkSearch, setCheckSearch] = useState("");
  const [askingPrice, setAskingPrice] = useState(30);
  const [showComps, setShowComps] = useState(false);
  const [formData, setFormData] = useState({
    player: "", sport: "Baseball" as any, team: "", year: 2024, brand: "Topps",
    set: "Base", parallel: "Base", card_number: "#1", is_rc: false, is_auto: false,
    is_numbered: false, numbered_to: null as number | null, condition: "NM" as any,
    raw_value: 0, cost_basis: 0, storage_box: "BOX A", notes: "",
    purchase_source: null as string | null, purchase_intent: null as any,
  });
  const [filterSport, setFilterSport] = useState("All");

  const totalValue = cards.reduce((s, c) => s + (c.raw_value || 0), 0);
  const unsold = cards.filter(c => !c.sold);
  const listed = cards.filter(c => c.status === "listed");
  const grading = cards.filter(c => c.status === "grading");

  const filteredCards = unsold
    .filter(c => filterSport === "All" || c.sport === filterSport)
    .filter(c => !search || c.player.toLowerCase().includes(search.toLowerCase()) ||
      c.brand.toLowerCase().includes(search.toLowerCase()) ||
      c.set.toLowerCase().includes(search.toLowerCase()));

  const sports = ["All", ...new Set(cards.map(c => c.sport))];

  const bg = "#0a0a0f";
  const surface = "#13131a";
  const surface2 = "#1a1a24";
  const border = "#2a2a38";
  const accent = "#f0c040";
  const green = "#22c55e";
  const red = "#ef4444";
  const cyan = "#06b6d4";
  const purple = "#a855f7";
  const muted = "#6b6b80";
  const text = "#e8e8ef";
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const mono = "'SF Mono', 'Menlo', monospace";

  // Shell moved outside
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", maxWidth: 430, margin: "0 auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: bg, borderBottom: "1px solid " + border, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        {back && <button onClick={back} style={{ background: "none", border: "none", color: muted, fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>}
        <span style={{ flex: 1, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</span>
        {right}
      </div>
      <div style={{ padding: "0 20px 100px" }}>{children}</div>
    </div>
  );

  // ─── HOME ────────────────────────
  if (screen === "home") return (
    <Shell title="GrailChaser">
      <div style={{ paddingTop: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>Collection Value</div>
          <div style={{ fontSize: 42, fontFamily: mono, fontWeight: 700, color: accent, letterSpacing: "-0.03em" }}>
            ${totalValue.toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{unsold.length} cards</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
          {[
            { label: "Listed", count: listed.length, color: cyan },
            { label: "Grading", count: grading.length, color: purple },
            { label: "Sold", count: cards.filter(c => c.sold).length, color: green },
          ].map(s => (
            <div key={s.label} style={{ background: surface, borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <button onClick={() => { setCheckSearch(""); setAskingPrice(30); setShowComps(false); setScreen("cardCheck"); }} style={{ width: "100%", padding: "20px", background: "linear-gradient(135deg, " + green + "15, " + green + "08)", border: "1px solid " + green + "30", borderRadius: 16, cursor: "pointer", textAlign: "left", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: green, marginBottom: 4 }}>Check a Card</div>
          <div style={{ fontSize: 12, color: muted }}>Search any card — see value, comps, buy/pass verdict</div>
        </button>

        <button onClick={() => setScreen("addCard")} style={{ width: "100%", padding: "20px", background: "linear-gradient(135deg, " + accent + "15, " + accent + "08)", border: "1px solid " + accent + "30", borderRadius: 16, cursor: "pointer", textAlign: "left", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: accent, marginBottom: 4 }}>Add a Card</div>
          <div style={{ fontSize: 12, color: muted }}>Manually add a card to your collection</div>
        </button>

        <button onClick={() => setScreen("myCards")} style={{ width: "100%", padding: "20px", background: surface, border: "1px solid " + border, borderRadius: 16, cursor: "pointer", textAlign: "left", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 4 }}>My Cards ({unsold.length})</div>
          <div style={{ fontSize: 12, color: muted }}>Browse, search, and manage your collection</div>
        </button>
      </div>
    </Shell>
  );

  // ─── ADD CARD ────────────────────
  if (screen === "addCard") return (
    <Shell title="Add Card" back={() => setScreen("home")}>
      <div style={{ paddingTop: 16 }}>
        {[
          { label: "Player", key: "player", type: "text", placeholder: "Justin Herbert" },
          { label: "Year", key: "year", type: "number", placeholder: "2024" },
          { label: "Brand", key: "brand", type: "text", placeholder: "Panini" },
          { label: "Set", key: "set", type: "text", placeholder: "Prizm Football" },
          { label: "Card Number", key: "card_number", type: "text", placeholder: "#315" },
          { label: "Value ($)", key: "raw_value", type: "number", placeholder: "0" },
          { label: "Cost Paid ($)", key: "cost_basis", type: "number", placeholder: "0" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>{f.label}</label>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={(formData as any)[f.key] || ""}
              onChange={e => setFormData(prev => ({ ...prev, [f.key]: f.type === "number" ? +e.target.value : e.target.value }))}
              style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Sport</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Baseball", "Football", "Basketball", "Hockey", "Soccer"].map(s => (
              <button key={s} onClick={() => setFormData(prev => ({ ...prev, sport: s as any }))}
                style={{ padding: "8px 14px", background: formData.sport === s ? accent + "20" : surface2, border: "1px solid " + (formData.sport === s ? accent + "50" : border), borderRadius: 20, color: formData.sport === s ? accent : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Parallel</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Base", "Silver", "Gold", "Holo", "Refractor", "Numbered"].map(p => (
              <button key={p} onClick={() => setFormData(prev => ({ ...prev, parallel: p }))}
                style={{ padding: "8px 14px", background: formData.parallel === p ? cyan + "20" : surface2, border: "1px solid " + (formData.parallel === p ? cyan + "50" : border), borderRadius: 20, color: formData.parallel === p ? cyan : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{p}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Condition</label>
          <div style={{ display: "flex", gap: 6 }}>
            {["Mint", "NM", "EX", "VG"].map(c => (
              <button key={c} onClick={() => setFormData(prev => ({ ...prev, condition: c as any }))}
                style={{ flex: 1, padding: "10px", background: formData.condition === c ? green + "20" : surface2, border: "1px solid " + (formData.condition === c ? green + "50" : border), borderRadius: 8, color: formData.condition === c ? green : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setFormData(prev => ({ ...prev, is_rc: !prev.is_rc }))}
            style={{ flex: 1, padding: "10px", background: formData.is_rc ? purple + "20" : surface2, border: "1px solid " + (formData.is_rc ? purple + "50" : border), borderRadius: 8, color: formData.is_rc ? purple : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {formData.is_rc ? "✓ " : ""}Rookie
          </button>
          <button onClick={() => setFormData(prev => ({ ...prev, is_auto: !prev.is_auto }))}
            style={{ flex: 1, padding: "10px", background: formData.is_auto ? purple + "20" : surface2, border: "1px solid " + (formData.is_auto ? purple + "50" : border), borderRadius: 8, color: formData.is_auto ? purple : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {formData.is_auto ? "✓ " : ""}Auto
          </button>
          <button onClick={() => setFormData(prev => ({ ...prev, is_numbered: !prev.is_numbered }))}
            style={{ flex: 1, padding: "10px", background: formData.is_numbered ? purple + "20" : surface2, border: "1px solid " + (formData.is_numbered ? purple + "50" : border), borderRadius: 8, color: formData.is_numbered ? purple : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {formData.is_numbered ? "✓ " : ""}Numbered
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Storage Box</label>
          <input value={formData.storage_box} onChange={e => setFormData(prev => ({ ...prev, storage_box: e.target.value }))}
            style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
        </div>

        <button onClick={async () => {
          if (!formData.player) return;
          await addCard(formData);
          setFormData({ player: "", sport: "Baseball", team: "", year: 2024, brand: "Topps", set: "Base", parallel: "Base", card_number: "#1", is_rc: false, is_auto: false, is_numbered: false, numbered_to: null, condition: "NM", raw_value: 0, cost_basis: 0, storage_box: "BOX A", notes: "", purchase_source: null, purchase_intent: null });
          setScreen("myCards");
        }} style={{ width: "100%", padding: "16px", background: accent, border: "none", borderRadius: 12, color: "#000", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
          Add Card
        </button>
      </div>
    </Shell>
  );

  // ─── MY CARDS ────────────────────
  if (screen === "myCards") return (
    <Shell title={"My Cards (" + unsold.length + ")"} back={() => setScreen("home")}>
      <div style={{ paddingTop: 12 }}>
        <input placeholder="Search player, brand, set..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 14, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
          {sports.map(s => (
            <button key={s} onClick={() => setFilterSport(s)}
              style={{ padding: "6px 14px", background: filterSport === s ? accent + "20" : surface2, border: "1px solid " + (filterSport === s ? accent + "50" : border), borderRadius: 20, color: filterSport === s ? accent : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{s}</button>
          ))}
        </div>

        {loading && <div style={{ textAlign: "center", color: muted, padding: 40 }}>Loading...</div>}

        {!loading && filteredCards.length === 0 && (
          <div style={{ textAlign: "center", color: muted, padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14 }}>No cards yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Add your first card to get started</div>
          </div>
        )}

        {filteredCards.map(card => (
          <button key={card.id} onClick={() => { setSelectedCard(card); setScreen("cardDetail"); }}
            style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 12, padding: "14px 16px", marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{card.player}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{card.year} {card.brand} {card.parallel !== "Base" ? card.parallel : ""} {card.card_number}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {card.is_rc && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: green + "15", border: "1px solid " + green + "30", color: green, fontWeight: 600 }}>RC</span>}
                {card.is_auto && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: purple + "15", border: "1px solid " + purple + "30", color: purple, fontWeight: 600 }}>AUTO</span>}
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: surface2, color: muted }}>{card.sport}</span>
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: surface2, color: muted }}>{card.storage_box}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: card.raw_value >= 25 ? green : card.raw_value >= 5 ? text : muted }}>${card.raw_value}</div>
              <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{card.status}</div>
            </div>
          </button>
        ))}
      </div>
    </Shell>
  );

  // ─── CARD DETAIL ─────────────────
  if (screen === "cardDetail" && selectedCard) return (
    <Shell title="Card Detail" back={() => setScreen("myCards")}>
      <div style={{ paddingTop: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{selectedCard.player}</div>
          <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>{selectedCard.year} {selectedCard.brand} {selectedCard.set}</div>
          {selectedCard.parallel !== "Base" && <div style={{ fontSize: 13, color: cyan, marginTop: 2 }}>{selectedCard.parallel}</div>}
          <div style={{ fontSize: 13, color: muted }}>{selectedCard.card_number}</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
            {selectedCard.is_rc && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: green + "15", border: "1px solid " + green + "30", color: green, fontWeight: 600 }}>ROOKIE</span>}
            {selectedCard.is_auto && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: purple + "15", border: "1px solid " + purple + "30", color: purple, fontWeight: 600 }}>AUTO</span>}
            {selectedCard.is_numbered && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: cyan + "15", border: "1px solid " + cyan + "30", color: cyan, fontWeight: 600 }}>/{selectedCard.numbered_to}</span>}
          </div>
        </div>

        <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><div style={{ fontSize: 10, color: muted, marginBottom: 2 }}>RAW VALUE</div><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: green }}>${selectedCard.raw_value}</div></div>
            <div><div style={{ fontSize: 10, color: muted, marginBottom: 2 }}>COST BASIS</div><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700 }}>${selectedCard.cost_basis}</div></div>
            <div><div style={{ fontSize: 10, color: muted, marginBottom: 2 }}>TIER</div><div style={{ fontSize: 14, fontWeight: 600, color: selectedCard.tier === "Gem" ? accent : selectedCard.tier === "Star" ? green : text }}>{selectedCard.tier}</div></div>
            <div><div style={{ fontSize: 10, color: muted, marginBottom: 2 }}>STATUS</div><div style={{ fontSize: 14, fontWeight: 600 }}>{selectedCard.status}</div></div>
          </div>
        </div>

        <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Graded Values</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
            {(["10", "9", "8", "7"] as const).map(g => (
              <div key={g}>
                <div style={{ fontSize: 9, color: muted }}>PSA {g}</div>
                <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: g === "10" ? green : text }}>${selectedCard.graded_values?.[g] || 0}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Storage</div>
          <div style={{ fontSize: 14 }}>{selectedCard.storage_box} · Row {selectedCard.storage_row} · Position {selectedCard.storage_position}</div>
        </div>

        <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Sell Optimizer</div>
          {PLATFORMS.slice(0, 6).map(p => {
            const net = calcNet(selectedCard.raw_value, p);
            const ship = calcShipping(selectedCard.raw_value);
            return (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}>
                <span style={{ fontSize: 13, color: text }}>{p.name}</span>
                <span style={{ fontFamily: mono, fontSize: 13, color: green, fontWeight: 600 }}>${(net - ship).toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        <button onClick={async () => { await deleteCard(selectedCard.id); setScreen("myCards"); }}
          style={{ width: "100%", padding: "14px", background: red + "15", border: "1px solid " + red + "30", borderRadius: 12, color: red, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>
          Delete Card
        </button>
      </div>
    </Shell>
  );

  // ─── CARD CHECK ──────────────────
  if (screen === "cardCheck") return (
    <Shell title="Check a Card" back={() => setScreen("home")}>
      <div style={{ paddingTop: 20 }}>
        <input value={checkSearch} onChange={e => setCheckSearch(e.target.value)} placeholder="Herbert Prizm Silver 2020"
          style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 12, padding: "14px 16px", color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 16 }} />

        {checkSearch.length > 3 && (
          <div>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Results</div>
            {[
              { name: "2020 Prizm Silver #315 Justin Herbert RC", val: 45 },
              { name: "2020 Prizm Base #315 Justin Herbert RC", val: 4 },
              { name: "2021 Prizm Silver #315 Justin Herbert", val: 12 },
            ].map((r, i) => (
              <button key={i} onClick={() => { setAskingPrice(30); setScreen("cardResult"); }}
                style={{ width: "100%", padding: "14px 16px", background: surface, border: "1px solid " + border, borderRadius: 10, marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: text }}>{r.name}</span>
                <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: green }}>${r.val}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );

  // ─── CARD RESULT / BUY EVAL ──────
  if (screen === "cardResult") {
    const rawVal = 45;
    const psa10 = 180, psa9 = 85, psa8 = 50;
    const gemRate = 14.4;
    const ebayFee = +(rawVal * 0.1325 + 0.30).toFixed(2);
    const ship = 4.50;
    const flipNet = +(rawVal - ebayFee - ship).toFixed(2);
    const flipProfit = +(flipNet - askingPrice).toFixed(2);
    const flipROI = askingPrice > 0 ? +((flipProfit / askingPrice) * 100).toFixed(0) : 0;
    const gradeCost = 25;
    const expectedGrade = +(psa10 * 0.144 + psa9 * 0.35 + psa8 * 0.35 + 30 * 0.156).toFixed(2);
    const expectedNet = +(expectedGrade - (expectedGrade * 0.1325) - ship - gradeCost).toFixed(2);
    const expectedProfit = +(expectedNet - askingPrice).toFixed(2);
    const expectedROI = askingPrice > 0 ? +((expectedProfit / askingPrice) * 100).toFixed(0) : 0;
    const maxPayRaw = +flipNet.toFixed(2);
    const belowMarket = askingPrice > 0 ? +(((rawVal - askingPrice) / rawVal) * 100).toFixed(0) : 0;
    const verdict = flipROI > 20 ? "buy" : flipROI > 0 ? "maybe" : "pass";

    return (
      <Shell title="Card Check" back={() => setScreen("cardCheck")}>
        <div style={{ paddingTop: 16 }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Justin Herbert</div>
            <div style={{ fontSize: 13, color: muted }}>2020 Prizm Silver #315 RC</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: green + "15", border: "1px solid " + green + "30", color: green, fontWeight: 600 }}>RC</span>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: cyan + "15", border: "1px solid " + cyan + "30", color: cyan, fontWeight: 600 }}>POP 5,892</span>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: purple + "15", border: "1px solid " + purple + "30", color: purple, fontWeight: 600 }}>{gemRate}% GEM</span>
            </div>
          </div>

          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: muted }}>Asking price</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: muted, fontSize: 18 }}>$</span>
                <input type="number" value={askingPrice} onChange={e => setAskingPrice(+e.target.value)}
                  style={{ width: 80, background: surface2, border: "1px solid " + border, borderRadius: 8, padding: "8px 10px", color: text, fontFamily: mono, fontSize: 22, fontWeight: 700, outline: "none", textAlign: "right" }} />
              </div>
            </div>
            {belowMarket > 0 && <div style={{ fontSize: 12, color: green, marginTop: 6, textAlign: "right" }}>{belowMarket}% below market</div>}
          </div>

          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Market values</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, textAlign: "center" }}>
              {[{ l: "Raw", v: rawVal, c: text }, { l: "PSA 10", v: psa10, c: green }, { l: "PSA 9", v: psa9, c: cyan }, { l: "PSA 8", v: psa8, c: muted }].map(g => (
                <div key={g.l}>
                  <div style={{ fontSize: 9, color: muted, marginBottom: 2 }}>{g.l}</div>
                  <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: g.c }}>${g.v}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowComps(!showComps)}
              style={{ width: "100%", marginTop: 10, padding: "8px", background: cyan + "10", border: "1px solid " + cyan + "20", borderRadius: 8, color: cyan, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {showComps ? "Hide" : "View"} recent comps
            </button>
            {showComps && (
              <div style={{ marginTop: 10 }}>
                {[{ p: "$48", d: "3/28", s: "eBay BIN" }, { p: "$42", d: "3/25", s: "eBay Auction" }, { p: "$46", d: "3/22", s: "eBay BIN" }, { p: "$39", d: "3/20", s: "eBay BOA" }, { p: "$51", d: "3/18", s: "Whatnot" }].map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: i < 4 ? "1px solid " + border : "none", fontSize: 12 }}>
                    <span style={{ fontFamily: mono, color: green, fontWeight: 600 }}>{c.p}</span>
                    <span style={{ color: muted }}>{c.d}</span>
                    <span style={{ color: muted }}>{c.s}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11 }}>
                  <span style={{ color: muted }}>Median: <span style={{ color: text, fontWeight: 600 }}>$45</span></span>
                  <span style={{ color: green }}>Trending: +6% (30d)</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>If you buy at ${askingPrice}</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Flip raw on eBay</span>
                <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: flipProfit > 0 ? green : red }}>{flipProfit > 0 ? "+" : ""}${flipProfit}</span>
              </div>
              <div style={{ height: 6, background: surface2, borderRadius: 3, marginBottom: 4 }}>
                <div style={{ height: 6, background: flipROI > 20 ? green : flipROI > 0 ? accent : red, borderRadius: 3, width: Math.min(Math.max(flipROI, 0), 100) + "%", transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 11, color: muted }}>{flipROI}% ROI</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Grade & sell (expected)</span>
                <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: expectedProfit > 0 ? green : red }}>{expectedProfit > 0 ? "+" : ""}${expectedProfit}</span>
              </div>
              <div style={{ height: 6, background: surface2, borderRadius: 3, marginBottom: 4 }}>
                <div style={{ height: 6, background: expectedROI > 20 ? purple : expectedROI > 0 ? accent : red, borderRadius: 3, width: Math.min(Math.max(expectedROI, 0), 100) + "%", transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 11, color: muted }}>{expectedROI}% ROI · Gem rate {gemRate}%</div>
            </div>
          </div>

          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Max pay</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: muted }}>Break even (raw flip)</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600 }}>${maxPayRaw}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: muted }}>For 20% profit</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600 }}>${+(maxPayRaw / 1.2).toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: muted }}>Grade break even</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600 }}>${expectedNet}</span></div>
          </div>

          <div style={{ background: verdict === "buy" ? green + "10" : verdict === "maybe" ? accent + "10" : red + "10", border: "1px solid " + (verdict === "buy" ? green + "30" : verdict === "maybe" ? accent + "30" : red + "30"), borderRadius: 14, padding: 16, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: verdict === "buy" ? green : verdict === "maybe" ? accent : red, marginBottom: 4 }}>
              {verdict === "buy" ? "BUY" : verdict === "maybe" ? "NEGOTIATE" : "PASS"}
            </div>
            <div style={{ fontSize: 12, color: muted }}>
              {verdict === "buy" ? "Good at $" + askingPrice + " — " + belowMarket + "% below market" : verdict === "maybe" ? "Tight margin — try offering $" + +(maxPayRaw / 1.2).toFixed(0) : "Overpaying — max $" + maxPayRaw + " to break even"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setScreen("home")} style={{ flex: 1, padding: "18px", background: green, border: "none", borderRadius: 14, color: "#000", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>BUY</button>
            <button onClick={() => setScreen("home")} style={{ flex: 1, padding: "18px", background: surface2, border: "1px solid " + border, borderRadius: 14, color: muted, fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>PASS</button>
          </div>
        </div>
      </Shell>
    );
  }

  return null;
}
