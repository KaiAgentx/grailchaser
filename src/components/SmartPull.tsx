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
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType) => Promise<any>;
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
  const [moveResults, setMoveResults] = useState({ moved: 0, errors: 0, sellBoxName: "", gradeBoxName: "", renumbered: 0 });

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
          <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>{boxCards.length} cards in box</div>

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
                  <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{items.length} cards · ${totalValue.toFixed(0)}</div>
                </div>
                <span style={{ fontSize: 12, color: muted }}>View →</span>
              </button>
            );
          })}

          {pullCards.length === 0 && <div style={{ textAlign: "center", color: muted, fontSize: 13, padding: "20px 0" }}>Nothing to pull at these thresholds</div>}

          {pullCards.length > 0 && (
            <button onClick={() => setScreen("confirm")} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", marginTop: 12, fontSize: 16 }}>Start Pull ({pullCards.length} cards)</button>
          )}
        </div>
      </Shell>
    );
  }

  // ─── CATEGORY DETAIL ───
  if (screen === "detail") {
    const info = catInfo[detailCat];
    const items = detailCat === "sellRaw" ? result.sellRaw : detailCat === "gradeCandidate" ? result.gradeCandidates : detailCat === "both" ? result.both : detailCat === "borderline" ? result.borderline : detailCat === "noPricing" ? result.noPricing : result.bulk;

    return (
      <Shell title={`${info.icon} ${info.label}`} back={() => setScreen("analysis")}>
        <div style={{ paddingTop: 16 }}>
          {items.map(pc => {
            const c = pc.card;
            const dest = getDestination(pc);
            const included = isIncluded(pc);
            return (
              <div key={c.id} style={{ background: surface, borderRadius: 12, padding: 14, marginBottom: 8, opacity: included || pc.category !== "borderline" ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: 24, fontWeight: 800, color: accent }}>{c.storage_position}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{c.player}</div>
                    <div style={{ fontSize: 11, color: muted }}>{c.year} {c.brand} {c.set}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: green }}>${c.raw_value}</div>
                    <div style={{ fontSize: 10, color: muted }}>PSA 10: ${c.graded_values?.["10"] || 0}</div>
                  </div>
                </div>

                {/* Ratio */}
                <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>Ratio: {pc.ratio}x · Sell profit: ${pc.sellProfit} · Grade profit: ${pc.gradeExpectedProfit}</div>

                {/* Both: toggle destination */}
                {pc.category === "both" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button onClick={() => setDestOverrides(prev => ({ ...prev, [c.id]: "sell" }))} style={{ flex: 1, padding: "6px", background: dest === "sell" ? green + "20" : surface2, border: "1px solid " + (dest === "sell" ? green + "50" : border), borderRadius: 8, color: dest === "sell" ? green : muted, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>💰 Sell (${pc.sellProfit})</button>
                    <button onClick={() => setDestOverrides(prev => ({ ...prev, [c.id]: "grade" }))} style={{ flex: 1, padding: "6px", background: dest === "grade" ? purple + "20" : surface2, border: "1px solid " + (dest === "grade" ? purple + "50" : border), borderRadius: 8, color: dest === "grade" ? purple : muted, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>💎 Grade (${pc.gradeExpectedProfit})</button>
                  </div>
                )}

                {/* Borderline: include toggle */}
                {pc.category === "borderline" && (
                  <button onClick={() => setBorderlineIncludes(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} style={{ marginTop: 6, padding: "6px 12px", background: included ? green + "20" : surface2, border: "1px solid " + (included ? green + "50" : border), borderRadius: 8, color: included ? green : muted, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{included ? "✓ Included" : "Include in pull"}</button>
                )}

                {pc.category === "noPricing" && <div style={{ fontSize: 11, color: red, marginTop: 4 }}>Needs pricing lookup</div>}
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
          <div style={{ fontSize: 20, fontWeight: 700, color: text, marginBottom: 16 }}>Pull {pullCards.length} cards from {boxName}?</div>
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
      if (error) { setMoveResults({ moved: 0, errors: 1, sellBoxName, gradeBoxName, renumbered: 0 }); setCompleted(true); setCompleting(false); return; }
    }
    if (!hasGradeBox && sorted.some(pc => gotIds.has(pc.card.id) && getDestination(pc) === "grade")) {
      const { error } = await addBox(gradeBoxName, 1, 50, "grade_check");
      if (error) { setMoveResults({ moved: 0, errors: 1, sellBoxName, gradeBoxName, renumbered: 0 }); setCompleted(true); setCompleting(false); return; }
    }

    // Move each GOT IT card
    for (const pc of sorted) {
      if (!gotIds.has(pc.card.id)) continue;
      const dest = getDestination(pc) === "grade" ? gradeBoxName : sellBoxName;
      const pos = getNextPosition(dest);
      const note = `Pulled from ${boxName} #${pc.card.storage_position} on ${today}`;
      const { error } = await updateCard(pc.card.id, {
        storage_box: dest,
        storage_row: 1,
        storage_position: pos,
        notes: pc.card.notes ? pc.card.notes + " · " + note : note,
      });
      if (error) errors++;
      else moved++;
    }

    // Renumber source box if scanned type
    let renumbered = 0;
    if (box?.box_type === "scanned") {
      renumbered = await renumberBox(boxName);
    }

    await fetchCards();
    setMoveResults({ moved, errors, sellBoxName, gradeBoxName, renumbered });
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
            {pullSellCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}><span style={{ color: green }}>💰 Moved to {moveResults.sellBoxName}</span><span style={{ fontFamily: mono, fontWeight: 700 }}>{pullCards.filter(pc => gotIds.has(pc.card.id) && getDestination(pc) === "sell").length}</span></div>}
            {pullGradeCount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}><span style={{ color: purple }}>💎 Moved to {moveResults.gradeBoxName}</span><span style={{ fontFamily: mono, fontWeight: 700 }}>{pullCards.filter(pc => gotIds.has(pc.card.id) && getDestination(pc) === "grade").length}</span></div>}
            {moveResults.renumbered > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: cyan }}>{boxName} renumbered</span><span style={{ fontFamily: mono, fontWeight: 700 }}>{boxCards.length - gotCount} cards → 1-{boxCards.length - gotCount}</span></div>}
            {moveResults.errors > 0 && <div style={{ fontSize: 12, color: red, marginTop: 8 }}>{moveResults.errors} cards failed to move</div>}
          </div>

          {skipCount > 0 && <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>{skipCount} skipped cards remain in {boxName}{moveResults.renumbered > 0 ? " at new positions" : ""}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pullGradeCount > 0 && <button onClick={() => onNavigate({ screen: "home" })} style={{ ...btnStyle, background: purple + "15", border: "1px solid " + purple + "30", color: purple }}>💎 Go to Grade Check</button>}
            {pullSellCount > 0 && <button onClick={() => onNavigate({ screen: "myCards" })} style={{ ...btnStyle, background: green + "15", border: "1px solid " + green + "30", color: green }}>💰 View Sell Box</button>}
            <button onClick={() => onNavigate({ screen: "home" })} style={{ ...btnStyle, background: surface2, border: "1px solid " + border, color: muted }}>🏠 Home</button>
          </div>
        </div>
      </Shell>
    );
  }

  return null;
}
