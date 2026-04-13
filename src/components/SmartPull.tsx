"use client";
import { useState, useMemo } from "react";
import { Card } from "@/lib/types";
import { Box, BoxType } from "@/hooks/useBoxes";
import { analyzePull, PullCard, PullSettings } from "@/hooks/useSmartPull";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, purple, muted, text, font, mono } from "./styles";

const btnStyle = { padding: "12px 16px", minHeight: 48, border: "none", borderRadius: 12, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", minHeight: 44, color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" as const };
const amber = "#f59e0b";
const pl = (n: number) => n === 1 ? "card" : "cards";

type Screen = "analysis" | "detail" | "confirm" | "pulling" | "complete";
type Category = "sellRaw" | "gradeCandidate" | "both" | "borderline" | "noPricing" | "bulk";

const catInfo: Record<Category, { icon: string; label: string; color: string }> = {
  sellRaw: { icon: "💰", label: "Sell Raw", color: green },
  gradeCandidate: { icon: "💎", label: "Grade Candidates", color: purple },
  both: { icon: "💰💎", label: "Sell or Grade", color: accent },
  borderline: { icon: "⚡", label: "Borderline", color: amber },
  noPricing: { icon: "⚠️", label: "No Pricing", color: red },
  bulk: { icon: "📦", label: "Bulk", color: muted },
};

interface Props {
  boxName: string;
  cards: Card[];
  boxes: Box[];
  updateCard: (id: string, updates: Partial<Card>) => Promise<any>;
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType, mode?: "sports" | "tcg") => Promise<any>;
  getNextPosition: (boxName: string) => number;
  renumberBox: (boxName: string) => Promise<number>;
  fetchCards: () => Promise<void>;
  onNavigate: (target: { screen: string; filter?: string }) => void;
}

export function SmartPull({ boxName, cards, boxes, updateCard, addBox, getNextPosition, renumberBox, fetchCards, onNavigate }: Props) {
  const boxCards = useMemo(() => cards.filter(c => c.storage_box === boxName).sort((a, b) => (a.storage_position || 0) - (b.storage_position || 0)), [cards, boxName]);
  const box = boxes.find(b => b.name === boxName);
  const dividerSize = box?.divider_size || 50;

  const [screen, setScreen] = useState<Screen>("analysis");
  const [rawThreshold, setRawThreshold] = useState(20);
  const [gradeRatio, setGradeRatio] = useState(5);
  const [detailCat, setDetailCat] = useState<Category>("sellRaw");

  // Pull state managed as mutable overrides
  const [destOverrides, setDestOverrides] = useState<Record<string, "sell" | "grade">>({});
  const [borderlineIncludes, setBorderlineIncludes] = useState<Set<string>>(new Set());
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const settings: PullSettings = { rawThreshold, gradeRatio, minRawForGrading: 5, borderlineRange: 0.2 };
  const result = useMemo(() => analyzePull(boxCards, settings), [boxCards, rawThreshold, gradeRatio]);

  // Apply overrides
  const getDestination = (pc: PullCard) => destOverrides[pc.card.id] || pc.destination;
  const isIncluded = (pc: PullCard) => pc.category === "borderline" ? borderlineIncludes.has(pc.card.id) : pc.included;

  // All cards to pull
  const pullCards = [...result.sellRaw, ...result.gradeCandidates, ...result.both, ...result.borderline.filter(b => borderlineIncludes.has(b.card.id))];
  const pullSellCount = pullCards.filter(pc => getDestination(pc) === "sell").length;
  const pullGradeCount = pullCards.filter(pc => getDestination(pc) === "grade").length;

  // Pull mode state
  const [pullIndex, setPullIndex] = useState(0);
  const [gotIds, setGotIds] = useState<Set<string>>(new Set());
  const [skipIds, setSkipIds] = useState<Set<string>>(new Set());

  // Complete state
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [moveResults, setMoveResults] = useState({ moved: 0, errors: 0, sellBoxName: "", gradeBoxName: "", renumbered: 0, movedToSell: 0, movedToGrade: 0 });

  const getSection = (pos: number) => { const s = Math.floor((pos - 1) / dividerSize) * dividerSize + 1; return `${s}–${s + dividerSize - 1}`; };

  // ─── ANALYSIS ───
  if (screen === "analysis") {
    const categories: { key: Category; items: PullCard[] }[] = [
      { key: "sellRaw", items: result.sellRaw },
      { key: "gradeCandidate", items: result.gradeCandidates },
      { key: "both", items: result.both },
      { key: "borderline", items: result.borderline },
      { key: "noPricing", items: result.noPricing },
      { key: "bulk", items: result.bulk },
    ];

    return (
      <Shell title={`Smart Pull — ${boxName}`} back={() => onNavigate({ screen: "home" })}>
        <div style={{ paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>{boxCards.length} {pl(boxCards.length)} in box</div>

          {/* Threshold controls */}
          <div style={{ background: surface, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: muted, marginBottom: 2 }}>Sell threshold</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: muted }}>$</span><input type="text" inputMode="numeric" value={rawThreshold} onChange={e => setRawThreshold(+e.target.value || 0)} style={{ ...inputStyle, width: 60, textAlign: "center" }} /></div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: muted, marginBottom: 2 }}>Grade ratio</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[3, 5, 7, 10].map(r => <button key={r} onClick={() => setGradeRatio(r)} style={{ padding: "6px 10px", background: gradeRatio === r ? purple + "20" : surface2, border: "1px solid " + (gradeRatio === r ? purple + "50" : border), borderRadius: 8, color: gradeRatio === r ? purple : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{r}x</button>)}
                </div>
              </div>
            </div>
          </div>

          {/* Category cards */}
          {categories.map(({ key, items }) => {
            if (items.length === 0) return null;
            const info = catInfo[key];
            const totalValue = items.reduce((s, pc) => s + (pc.card.raw_value || 0), 0);
            return (
              <button key={key} onClick={() => { setDetailCat(key); setScreen("detail"); }} style={{ width: "100%", background: surface, borderLeft: "3px solid " + info.color, borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 10, padding: "14px", marginBottom: 8, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: info.color }}>{info.icon} {info.label}</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{items.length} {pl(items.length)} · ${totalValue.toFixed(0)}</div>
                </div>
                <span style={{ fontSize: 12, color: muted }}>View →</span>
              </button>
            );
          })}

          {pullCards.length === 0 && <div style={{ textAlign: "center", color: muted, fontSize: 13, padding: "20px 0" }}>Nothing to pull at these thresholds</div>}

          {pullCards.length > 0 && (
            <button onClick={() => setScreen("confirm")} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", marginTop: 12, fontSize: 16 }}>Start Pull ({pullCards.length} {pl(pullCards.length)})</button>
          )}
        </div>
      </Shell>
    );
  }

  // ─── CATEGORY DETAIL ───
  if (screen === "detail") {
    const info = catInfo[detailCat];
    const items = detailCat === "sellRaw" ? result.sellRaw : detailCat === "gradeCandidate" ? result.gradeCandidates : detailCat === "both" ? result.both : detailCat === "borderline" ? result.borderline : detailCat === "noPricing" ? result.noPricing : result.bulk;

    const calcGradeProfit = (gv: number, cost: number) => +(gv - gv * 0.1325 - 4.50 - 25 - cost).toFixed(2);
    const calcSellNet = (rv: number, cost: number) => { const fees = +(rv * 0.1325 + 0.30).toFixed(2); const ship = rv >= 20 ? 4.50 : 1.05; return { net: +(rv - fees - ship - cost).toFixed(2), fees, ship }; };

    return (
      <Shell title={`${info.icon} ${info.label}`} back={() => setScreen("analysis")}>
        <div style={{ paddingTop: 16 }}>
          {items.map(pc => {
            const c = pc.card;
            const dest = getDestination(pc);
            const included = isIncluded(pc);
            const expanded = expandedCard === c.id;
            const gv = c.graded_values || { "10": 0, "9": 0, "8": 0, "7": 0 };
            const cost = c.cost_basis || 0;
            const sell = calcSellNet(c.raw_value || 0, cost);

            return (
              <div key={c.id} style={{ background: surface, borderRadius: 12, marginBottom: 8, opacity: included || pc.category !== "borderline" ? 1 : 0.5, overflow: "hidden" }}>
                {/* Compact header — tap to expand */}
                <button onClick={() => setExpandedCard(expanded ? null : c.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: 14, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontFamily: mono, fontSize: 28, fontWeight: 800, color: accent, minWidth: 40, textAlign: "center" }}>{c.storage_position}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.player}</div>
                    <div style={{ fontSize: 11, color: muted }}>{c.year} {c.brand} {c.set}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: green }}>${c.raw_value}</div>
                    <div style={{ fontSize: 10, color: muted }}>{expanded ? "▲" : "▼"}</div>
                  </div>
                </button>

                {/* Category-specific summary (always visible) */}
                <div style={{ padding: "0 14px 10px", borderTop: "1px solid " + border }}>
                  {pc.category === "sellRaw" && (
                    <div style={{ paddingTop: 8 }}>
                      <div style={{ fontSize: 13, color: green, fontWeight: 600 }}>Net if sold on eBay: ${sell.net}</div>
                      <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>price ${c.raw_value} - fees ${sell.fees} - shipping ${sell.ship} - cost ${cost}</div>
                    </div>
                  )}

                  {pc.category === "gradeCandidate" && (
                    <div style={{ paddingTop: 8 }}>
                      <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>Raw: ${c.raw_value} → PSA 10: ${gv["10"]} ({pc.ratio}x) 💎</div>
                      {[{ g: "PSA 10", v: gv["10"], c: green }, { g: "PSA 9", v: gv["9"], c: cyan }, { g: "PSA 8", v: gv["8"], c: text }].map(gr => {
                        const p = calcGradeProfit(gr.v, cost);
                        return <div key={gr.g} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 12 }}><span style={{ color: gr.c }}>If {gr.g}:</span><span style={{ fontFamily: mono, fontWeight: 600, color: p >= 0 ? green : red }}>{p >= 0 ? "+" : ""}${p}</span></div>;
                      })}
                      <div style={{ fontSize: 10, color: muted, marginTop: 4 }}>Grade cost: $25 (PSA)</div>
                    </div>
                  )}

                  {pc.category === "both" && (
                    <div style={{ paddingTop: 8 }}>
                      <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>Raw: ${c.raw_value} → PSA 10: ${gv["10"]} ({pc.ratio}x)</div>
                      <div style={{ background: green + "08", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: green }}>OPTION A — Sell raw now:</div>
                        <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: green, marginTop: 2 }}>Net profit: ${sell.net} <span style={{ fontSize: 10, fontWeight: 400, color: muted }}>(guaranteed)</span></div>
                      </div>
                      <div style={{ background: purple + "08", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: purple }}>OPTION B — Grade first:</div>
                        {[{ g: "PSA 10", v: gv["10"], c: green }, { g: "PSA 9", v: gv["9"], c: cyan }, { g: "PSA 8", v: gv["8"], c: text }].map(gr => {
                          const p = calcGradeProfit(gr.v, cost);
                          return <div key={gr.g} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", fontSize: 11 }}><span style={{ color: gr.c }}>If {gr.g}:</span><span style={{ fontFamily: mono, fontWeight: 600, color: p >= 0 ? green : red }}>{p >= 0 ? "+" : ""}${p}</span></div>;
                        })}
                        <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Grade cost: $25</div>
                      </div>
                      <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>Currently going to: {dest === "grade" ? "💎 GRADE CHECK" : "💰 SELL BOX"}</div>
                      <button onClick={() => setDestOverrides(prev => ({ ...prev, [c.id]: dest === "grade" ? "sell" : "grade" }))} style={{ padding: "8px 14px", background: (dest === "grade" ? green : purple) + "15", border: "1px solid " + (dest === "grade" ? green : purple) + "30", borderRadius: 8, color: dest === "grade" ? green : purple, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Switch to {dest === "grade" ? "💰 SELL BOX" : "💎 GRADE CHECK"}</button>
                    </div>
                  )}

                  {pc.category === "borderline" && (
                    <div style={{ paddingTop: 8 }}>
                      <div style={{ fontSize: 13, color: text }}>Net if sold: ${sell.net}</div>
                      <div style={{ fontSize: 11, color: amber, marginTop: 2 }}>${(rawThreshold - (c.raw_value || 0)).toFixed(0)} below your sell threshold</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button onClick={() => setBorderlineIncludes(prev => { const n = new Set(prev); n.add(c.id); return n; })} style={{ flex: 1, padding: "8px", background: included ? green + "20" : surface2, border: "1px solid " + (included ? green + "50" : border), borderRadius: 8, color: included ? green : muted, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{included ? "✓ Included" : "Include in Pull"}</button>
                        <button onClick={() => setBorderlineIncludes(prev => { const n = new Set(prev); n.delete(c.id); return n; })} style={{ flex: 1, padding: "8px", background: !included ? surface2 : surface2, border: "1px solid " + border, borderRadius: 8, color: muted, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Leave in Bulk</button>
                      </div>
                    </div>
                  )}

                  {pc.category === "noPricing" && <div style={{ fontSize: 11, color: red, paddingTop: 8 }}>No pricing data — look up prices before pulling</div>}
                  {pc.category === "bulk" && <div style={{ fontSize: 11, color: muted, paddingTop: 8 }}>Below thresholds — stays in box</div>}
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div style={{ padding: "0 14px 14px", borderTop: "1px solid " + border }}>
                    <div style={{ paddingTop: 10 }}>
                      <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Graded Values</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginBottom: 10 }}>
                        {[{ l: "PSA 10", v: gv["10"], c: green }, { l: "PSA 9", v: gv["9"], c: cyan }, { l: "PSA 8", v: gv["8"], c: text }, { l: "PSA 7", v: gv["7"], c: muted }].map(g => (
                          <div key={g.l} style={{ textAlign: "center", background: surface2, borderRadius: 6, padding: "6px 4px" }}>
                            <div style={{ fontSize: 9, color: muted }}>{g.l}</div>
                            <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: g.c }}>${g.v}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <div><div style={{ fontSize: 9, color: muted }}>Cost</div><div style={{ fontFamily: mono, fontSize: 12, color: text }}>${cost}</div></div>
                        <div><div style={{ fontSize: 9, color: muted }}>Tier</div><div style={{ fontSize: 12, color: (c.raw_value || 0) >= 100 ? accent : (c.raw_value || 0) >= 25 ? green : text }}>{(c.raw_value || 0) >= 100 ? "Gem" : (c.raw_value || 0) >= 25 ? "Star" : (c.raw_value || 0) >= 5 ? "Core" : "Bulk"}</div></div>
                        <div><div style={{ fontSize: 9, color: muted }}>Location</div><div style={{ fontSize: 12, color: text }}>{c.storage_box} #{c.storage_position}</div></div>
                      </div>

                      <button onClick={() => onNavigate({ screen: "cardDetail", card: c, boxName } as any)} style={{ width: "100%", padding: "8px", background: surface2, border: "1px solid " + border, borderRadius: 8, color: cyan, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>View Full Detail →</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  // ─── CONFIRM ───
  if (screen === "confirm") {
    const sellBoxExists = boxes.some(b => b.name === "SELL BOX");
    const gradeBoxExists = boxes.some(b => b.name === "GRADE CHECK");

    return (
      <Shell title="Confirm Pull" back={() => setScreen("analysis")}>
        <div style={{ paddingTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: text, marginBottom: 16 }}>Pull {pullCards.length} {pl(pullCards.length)} from {boxName}?</div>
          <div style={{ background: surface, borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "left" }}>
            {pullSellCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}><span style={{ fontSize: 13, color: green }}>💰 To SELL BOX</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: green }}>{pullSellCount}</span></div>}
            {pullGradeCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ fontSize: 13, color: purple }}>💎 To GRADE CHECK</span><span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: purple }}>{pullGradeCount}</span></div>}
          </div>
          {!sellBoxExists && pullSellCount > 0 && <div style={{ fontSize: 12, color: cyan, marginBottom: 8 }}>SELL BOX will be created automatically</div>}
          {!gradeBoxExists && pullGradeCount > 0 && <div style={{ fontSize: 12, color: cyan, marginBottom: 8 }}>GRADE CHECK will be created automatically</div>}
          <button onClick={() => { setPullIndex(0); setGotIds(new Set()); setSkipIds(new Set()); setScreen("pulling"); }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", fontSize: 16, marginBottom: 8 }}>Confirm & Start Pulling</button>
          <button onClick={() => setScreen("analysis")} style={{ width: "100%", ...btnStyle, background: surface2, border: "1px solid " + border, color: muted }}>Go Back</button>
        </div>
      </Shell>
    );
  }

  // ─── PULLING ───
  if (screen === "pulling") {
    const sorted = [...pullCards].sort((a, b) => (a.card.storage_position || 0) - (b.card.storage_position || 0));
    const current = sorted[pullIndex];

    if (!current) {
      // Done pulling — move to complete
      if (!completing && !completed) handleComplete(sorted);
      return (
        <Shell title="Processing...">
          <div style={{ paddingTop: 60, textAlign: "center" }}>
            <div style={{ display: "inline-block", width: 32, height: 32, border: "3px solid " + border, borderTopColor: green, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 14, color: muted, marginTop: 12 }}>Moving cards...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </Shell>
      );
    }

    const dest = getDestination(current);
    const destLabel = dest === "grade" ? "💎 GRADE CHECK" : "💰 SELL BOX";
    const destColor = dest === "grade" ? purple : green;
    const nextCard = sorted[pullIndex + 1];

    return (
      <Shell title="Pulling" back={() => setScreen("confirm")}>
        <div style={{ paddingTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>Pull {pullIndex + 1} of {sorted.length}</div>

          <div style={{ background: surface, borderRadius: 16, padding: "28px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: accent, letterSpacing: 1, marginBottom: 4 }}>📦 {boxName}</div>
            <div style={{ fontSize: 12, color: cyan, marginBottom: 12 }}>Section {getSection(current.card.storage_position || 1)}</div>
            <div style={{ fontFamily: mono, fontSize: 64, fontWeight: 900, color: accent, lineHeight: 1 }}>#{current.card.storage_position}</div>
            <div style={{ borderTop: "1px solid " + border, marginTop: 16, paddingTop: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: text }}>{current.card.player}</div>
              <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>${current.card.raw_value} raw · PSA 10: ${current.card.graded_values?.["10"] || 0}</div>
              <div style={{ marginTop: 8 }}><span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, background: destColor + "15", border: "1px solid " + destColor + "30", color: destColor, fontWeight: 700 }}>{destLabel}</span></div>
            </div>
          </div>

          {nextCard && <div style={{ fontSize: 11, color: muted, marginBottom: 12 }}>Next: #{nextCard.card.storage_position} {getDestination(nextCard) === "grade" ? "💎" : "💰"} Section {getSection(nextCard.card.storage_position || 1)}</div>}

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setGotIds(prev => new Set(prev).add(current.card.id)); setPullIndex(pullIndex + 1); }} style={{ flex: 2, ...btnStyle, background: green, color: "#fff", fontSize: 18, padding: "20px" }}>GOT IT</button>
            <button onClick={() => { setSkipIds(prev => new Set(prev).add(current.card.id)); setPullIndex(pullIndex + 1); }} style={{ flex: 1, ...btnStyle, background: surface2, border: "1px solid " + border, color: muted }}>SKIP</button>
          </div>
        </div>
      </Shell>
    );
  }

  async function handleComplete(sorted: PullCard[]) {
    if (completing || completed) return;
    setCompleting(true);

    let moved = 0, errors = 0;
    const today = new Date().toISOString().slice(0, 10);

    // Auto-create destination boxes
    let sellBoxName = "SELL BOX";
    let gradeBoxName = "GRADE CHECK";
    const hasSellBox = boxes.some(b => b.name === sellBoxName);
    const hasGradeBox = boxes.some(b => b.name === gradeBoxName);

    if (!hasSellBox && sorted.some(pc => gotIds.has(pc.card.id) && getDestination(pc) === "sell")) {
      const { error } = await addBox(sellBoxName, 1, 50, "sell");
      if (error) { setMoveResults({ moved: 0, errors: 1, sellBoxName, gradeBoxName, renumbered: 0, movedToSell: 0, movedToGrade: 0 }); setCompleted(true); setCompleting(false); return; }
    }
    if (!hasGradeBox && sorted.some(pc => gotIds.has(pc.card.id) && getDestination(pc) === "grade")) {
      const { error } = await addBox(gradeBoxName, 1, 50, "grade_check");
      if (error) { setMoveResults({ moved: 0, errors: 1, sellBoxName, gradeBoxName, renumbered: 0, movedToSell: 0, movedToGrade: 0 }); setCompleted(true); setCompleting(false); return; }
    }

    // Move each GOT IT card — track positions manually for sequential assignment
    let sellPos = getNextPosition(sellBoxName);
    let gradePos = getNextPosition(gradeBoxName);
    let movedToSell = 0, movedToGrade = 0;

    for (const pc of sorted) {
      if (!gotIds.has(pc.card.id)) continue;
      const destType = getDestination(pc);
      const dest = destType === "grade" ? gradeBoxName : sellBoxName;
      const pos = destType === "grade" ? gradePos++ : sellPos++;
      const note = `Pulled from ${boxName} #${pc.card.storage_position} on ${today}`;
      const { error } = await updateCard(pc.card.id, {
        storage_box: dest,
        storage_row: 1,
        storage_position: pos,
        notes: pc.card.notes ? pc.card.notes + " · " + note : note,
      });
      if (error) errors++;
      else { moved++; if (destType === "sell") movedToSell++; else movedToGrade++; }
    }

    // Renumber source box if scanned type
    let renumbered = 0;
    if (box?.box_type === "scanned") {
      renumbered = await renumberBox(boxName);
    }

    await fetchCards();
    setMoveResults({ moved, errors, sellBoxName, gradeBoxName, renumbered, movedToSell, movedToGrade });
    setCompleted(true);
    setCompleting(false);
    setScreen("complete");
  }

  // ─── COMPLETE ───
  if (screen === "complete") {
    const gotCount = gotIds.size;
    const skipCount = skipIds.size;

    return (
      <Shell title="Pull Complete" back={() => onNavigate({ screen: "home" })}>
        <div style={{ paddingTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: green, marginBottom: 16 }}>Pull complete</div>

          <div style={{ background: surface, borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}><span style={{ color: muted }}>Found</span><span style={{ fontFamily: mono, fontWeight: 700, color: green }}>{gotCount}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}><span style={{ color: muted }}>Skipped</span><span style={{ fontFamily: mono, fontWeight: 700, color: skipCount > 0 ? amber : muted }}>{skipCount}</span></div>
            {moveResults.movedToSell > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}><span style={{ color: green }}>💰 Moved to {moveResults.sellBoxName}</span><span style={{ fontFamily: mono, fontWeight: 700 }}>{moveResults.movedToSell}</span></div>}
            {moveResults.movedToGrade > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}><span style={{ color: purple }}>💎 Moved to {moveResults.gradeBoxName}</span><span style={{ fontFamily: mono, fontWeight: 700 }}>{moveResults.movedToGrade}</span></div>}
            {moveResults.renumbered > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: cyan }}>{boxName} renumbered</span><span style={{ fontFamily: mono, fontWeight: 700 }}>{moveResults.renumbered} updated</span></div>}
            {moveResults.errors > 0 && <div style={{ fontSize: 12, color: red, marginTop: 8 }}>{moveResults.errors} card{moveResults.errors !== 1 ? "s" : ""} failed to move</div>}
          </div>

          {skipCount > 0 && <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>{skipCount} skipped card{skipCount !== 1 ? "s" : ""} remain{skipCount === 1 ? "s" : ""} in {boxName}{moveResults.renumbered > 0 ? " at new positions" : ""}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {moveResults.movedToGrade > 0 && <button onClick={() => onNavigate({ screen: "gradeCheck" })} style={{ ...btnStyle, background: purple + "15", border: "1px solid " + purple + "30", color: purple }}>💎 Go to Grade Check</button>}
            {moveResults.movedToSell > 0 && <button onClick={() => onNavigate({ screen: "myCards" })} style={{ ...btnStyle, background: green + "15", border: "1px solid " + green + "30", color: green }}>💰 View Sell Box</button>}
            <button onClick={() => onNavigate({ screen: "lotBuilder", boxName } as any)} style={{ ...btnStyle, background: amber + "15", border: "1px solid " + amber + "30", color: amber }}>📋 Lot Builder</button>
            <button onClick={() => onNavigate({ screen: "home" })} style={{ ...btnStyle, background: surface2, border: "1px solid " + border, color: muted }}>🏠 Home</button>
          </div>
        </div>
      </Shell>
    );
  }

  return null;
}
