"use client";
import { useState, useMemo } from "react";
import { Card } from "@/lib/types";
import { GRADING_COMPANIES } from "@/lib/utils";
import { Box, BoxType } from "@/hooks/useBoxes";
import { Shell } from "./Shell";
import { bg, surface, surface2, border, accent, green, red, cyan, purple, amber, muted, secondary, text, font, mono } from "./styles";

const btnStyle = { padding: "12px 16px", minHeight: 48, border: "none", borderRadius: 12, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", minHeight: 44, color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" as const, width: "100%" };

type Rating = "good" | "fair" | "poor" | "";
interface ConditionRating { corners: Rating; centering: Rating; surface: Rating; edges: Rating; notes: string }
interface Decision { cardId: string; action: "grade" | "sell" | "hold"; condition: ConditionRating; gemProb: number }

function calcGradeProfit(gv: number, gradingCost: number, costBasis: number) {
  return +(gv - gv * 0.1325 - 4.50 - gradingCost - costBasis).toFixed(2);
}

function defaultGemProb(cond: ConditionRating): number {
  const ratings = [cond.corners, cond.centering, cond.surface, cond.edges].filter(Boolean);
  if (ratings.length === 0) return 15;
  if (ratings.every(r => r === "good")) return 25;
  if (ratings.some(r => r === "poor")) return 5;
  return 15;
}

type Screen = "list" | "inspecting" | "complete" | "submission" | "confirmed";

interface Props {
  cards: Card[];
  boxes: Box[];
  updateCard: (id: string, updates: Partial<Card>) => Promise<any>;
  submitForGrading: (id: string, company: string) => Promise<any>;
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType) => Promise<any>;
  getNextPosition: (boxName: string) => number;
  onNavigate: (target: { screen: string; boxName?: string }) => void;
}

export function GradeCheck({ cards, boxes, updateCard, submitForGrading, addBox, getNextPosition, onNavigate }: Props) {
  // Cards in grade_check boxes
  const gradeCheckBoxes = boxes.filter(b => b.box_type === "grade_check" && !b.name.startsWith("AT "));
  const gcCards = useMemo(() => cards.filter(c => gradeCheckBoxes.some(b => b.name === c.storage_box)).sort((a, b) => (a.storage_position || 0) - (b.storage_position || 0)), [cards, boxes]);

  const [screen, setScreen] = useState<Screen>("list");
  const [inspectIndex, setInspectIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const [detailExpanded, setDetailExpanded] = useState(false);

  // Current inspection state
  const [corners, setCorners] = useState<Rating>("");
  const [centering, setCentering] = useState<Rating>("");
  const [surfaceR, setSurfaceR] = useState<Rating>("");
  const [edges, setEdges] = useState<Rating>("");
  const [condNotes, setCondNotes] = useState("");
  const [gemProb, setGemProb] = useState(15);

  // Submission state
  const [selectedCompany, setSelectedCompany] = useState("PSA");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ graded: number; sold: number; errors: number }>({ graded: 0, sold: 0, errors: 0 });

  const gradeCards = Object.values(decisions).filter(d => d.action === "grade");
  const sellCards = Object.values(decisions).filter(d => d.action === "sell");
  const holdCards = Object.values(decisions).filter(d => d.action === "hold");
  const uninspected = gcCards.filter(c => !decisions[c.id]);

  const loadDecision = (card: Card) => {
    const d = decisions[card.id];
    if (d) {
      setCorners(d.condition.corners); setCentering(d.condition.centering);
      setSurfaceR(d.condition.surface); setEdges(d.condition.edges);
      setCondNotes(d.condition.notes); setGemProb(d.gemProb);
    } else {
      setCorners(""); setCentering(""); setSurfaceR(""); setEdges(""); setCondNotes(""); setGemProb(15);
    }
  };

  const saveDecision = (action: "grade" | "sell" | "hold") => {
    const card = gcCards[inspectIndex];
    if (!card) return;
    setDecisions(prev => ({
      ...prev,
      [card.id]: { cardId: card.id, action, condition: { corners, centering, surface: surfaceR, edges, notes: condNotes }, gemProb },
    }));
    // Auto advance
    if (inspectIndex < gcCards.length - 1) {
      const next = inspectIndex + 1;
      setInspectIndex(next);
      loadDecision(gcCards[next]);
    } else {
      setScreen("complete");
    }
  };

  const RatingBtn = ({ label, value, set }: { label: string; value: Rating; set: (v: Rating) => void }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: muted, marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", gap: 4 }}>
        {(["good", "fair", "poor"] as Rating[]).map(r => (
          <button key={r} onClick={() => { set(r); const cond = { corners: label === "Corners" ? r : corners, centering: label === "Centering" ? r : centering, surface: label === "Surface" ? r : surfaceR, edges: label === "Edges" ? r : edges, notes: condNotes }; setGemProb(defaultGemProb(cond)); }} style={{ flex: 1, padding: "8px", background: value === r ? (r === "good" ? green : r === "fair" ? amber : red) + "20" : surface2, border: "1px solid " + (value === r ? (r === "good" ? green : r === "fair" ? amber : red) + "50" : border), borderRadius: 8, color: value === r ? (r === "good" ? green : r === "fair" ? amber : red) : muted, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{r}</button>
        ))}
      </div>
    </div>
  );

  // ─── EMPTY STATE ───
  if (gcCards.length === 0) return (
    <Shell title="Grade Check" back={() => onNavigate({ screen: "home" })}>
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>💎</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: muted }}>No cards to inspect</div>
        <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>Run Smart Pull on a scanned box to find grade candidates</div>
      </div>
    </Shell>
  );

  // ─── LIST ───
  if (screen === "list") return (
    <Shell title="Grade Check" back={() => onNavigate({ screen: "home" })}>
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: purple }}>{gcCards.length} card{gcCards.length !== 1 ? "s" : ""}</div>
          <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
            <span style={{ color: muted }}>{uninspected.length} new</span>
            <span style={{ color: green }}>{gradeCards.length} grade</span>
            <span style={{ color: amber }}>{sellCards.length} sell</span>
            <span style={{ color: muted }}>{holdCards.length} hold</span>
          </div>
        </div>

        {gcCards.map(card => {
          const d = decisions[card.id];
          const gv = card.graded_values || { "10": 0, "9": 0, "8": 0, "7": 0 };
          const ratio = card.raw_value ? +(gv["10"] / card.raw_value).toFixed(1) : 0;
          const badge = d ? d.action === "grade" ? { label: "✓ Grade", color: green } : d.action === "sell" ? { label: "✓ Sell", color: amber } : { label: "? Hold", color: muted } : null;
          return (
            <div key={card.id} style={{ background: surface, borderRadius: 10, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: accent, width: 32, textAlign: "center" }}>{card.storage_position}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.player}</div>
                <div style={{ fontSize: 10, color: muted }}>${card.raw_value} → PSA 10: ${gv["10"]} ({ratio}x)</div>
              </div>
              {badge && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: badge.color + "15", color: badge.color, fontWeight: 600 }}>{badge.label}</span>}
            </div>
          );
        })}

        <button onClick={() => { setInspectIndex(0); loadDecision(gcCards[0]); setScreen("inspecting"); }} style={{ width: "100%", ...btnStyle, background: purple, color: "#fff", marginTop: 12, fontSize: 16 }}>{uninspected.length > 0 ? "Start Inspecting" : "Re-inspect Cards"}</button>

        {uninspected.length === 0 && gradeCards.length > 0 && (
          <button onClick={() => setScreen("complete")} style={{ width: "100%", ...btnStyle, background: green + "15", border: "1px solid " + green + "30", color: green, marginTop: 8 }}>Submit for Grading ({gradeCards.length})</button>
        )}
      </div>
    </Shell>
  );

  // ─── INSPECTING ───
  if (screen === "inspecting") {
    const card = gcCards[inspectIndex];
    if (!card) { setScreen("complete"); return null; }

    const gv = card.graded_values || { "10": 0, "9": 0, "8": 0, "7": 0 };
    const ratio = card.raw_value ? +(gv["10"] / card.raw_value).toFixed(1) : 0;
    const cost = card.cost_basis || 0;
    const gradingCost = 25;

    // Probabilities based on gemProb
    const p10 = gemProb / 100;
    const p9 = Math.min(0.35, (1 - p10) * 0.45);
    const p8 = Math.min(0.30, (1 - p10 - p9) * 0.55);
    const p7 = 1 - p10 - p9 - p8;
    const expectedVal = gv["10"] * p10 + gv["9"] * p9 + gv["8"] * p8 + gv["7"] * p7;
    const expectedProfit = calcGradeProfit(expectedVal, gradingCost, cost);

    const grades = [
      { label: "PSA 10", val: gv["10"], prob: p10, color: green },
      { label: "PSA 9", val: gv["9"], prob: p9, color: cyan },
      { label: "PSA 8", val: gv["8"], prob: p8, color: text },
      { label: "PSA 7", val: gv["7"], prob: p7, color: muted },
    ];

    return (
      <Shell title={`Inspect ${inspectIndex + 1}/${gcCards.length}`} back={() => setScreen("list")}>
        <div style={{ paddingTop: 12, paddingBottom: 80 }}>
          {/* Card info — always visible */}
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            {card.scan_image_url ? <img src={card.scan_image_url} style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, marginBottom: 10 }} /> : null}
            <div style={{ fontSize: 18, fontWeight: 700, color: text }}>{card.player}</div>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{card.year} {card.brand} {card.set} {card.parallel !== "Base" ? card.parallel : ""}</div>
            <div style={{ fontSize: 13, color: purple, fontWeight: 600, marginTop: 6 }}>Raw: ${card.raw_value} → PSA 10: ${gv["10"]} ({ratio}x)</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid " + border }}>
              <span style={{ fontSize: 12, color: secondary }}>Expected at {gemProb}% gem rate</span>
              <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: expectedProfit >= 0 ? green : red }}>{expectedProfit >= 0 ? "+" : ""}${expectedProfit.toFixed(2)}</span>
            </div>
          </div>

          {/* Expandable detailed inspection */}
          <button onClick={() => setDetailExpanded(!detailExpanded)} style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 12, padding: "10px 14px", cursor: "pointer", textAlign: "left", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: secondary }}>{detailExpanded ? "▲" : "▼"} Detailed Inspection</span>
            {corners && <span style={{ fontSize: 10, color: muted }}>Corners: {corners} · Gem: {gemProb}%</span>}
          </button>

          {detailExpanded && (
            <div style={{ animation: "fadeIn 0.2s ease" }}>
              {/* Condition rating */}
              <div style={{ background: surface, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Condition Check</div>
                <RatingBtn label="Corners" value={corners} set={setCorners} />
                <RatingBtn label="Centering" value={centering} set={setCentering} />
                <RatingBtn label="Surface" value={surfaceR} set={setSurfaceR} />
                <RatingBtn label="Edges" value={edges} set={setEdges} />
                <input value={condNotes} onChange={e => setCondNotes(e.target.value)} placeholder="Condition notes..." style={{ ...inputStyle, fontSize: 12, marginTop: 4 }} />
              </div>

              {/* Gem probability */}
              <div style={{ background: surface, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Gem Probability</span>
                  <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: accent }}>{gemProb}%</span>
                </div>
                <input type="range" min={0} max={50} step={5} value={gemProb} onChange={e => setGemProb(+e.target.value)} style={{ width: "100%", accentColor: accent }} />
              </div>

              {/* Per-grade profit */}
              <div style={{ background: surface, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Grade Breakdown</div>
                {grades.map(g => {
                  const profit = calcGradeProfit(g.val, gradingCost, cost);
                  return (
                    <div key={g.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + border }}>
                      <span style={{ fontSize: 12, color: g.color }}>{g.label} <span style={{ color: muted }}>({(g.prob * 100).toFixed(0)}%)</span></span>
                      <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: profit >= 0 ? green : red }}>{profit >= 0 ? "+" : ""}${profit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky decision buttons */}
        <div style={{ position: "sticky", bottom: 64, zIndex: 50 }}>
          <div style={{ background: `linear-gradient(transparent, ${bg})`, height: 24 }} />
          <div style={{ background: bg, padding: "0 0 8px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={() => { saveDecision("grade"); setDetailExpanded(false); }} style={{ flex: 2, ...btnStyle, background: green, color: "#fff", fontSize: 16 }}>GRADE IT ✓</button>
              <button onClick={() => { saveDecision("sell"); setDetailExpanded(false); }} style={{ flex: 1, ...btnStyle, background: amber + "20", border: "1px solid " + amber + "40", color: amber }}>SELL RAW</button>
              <button onClick={() => { saveDecision("hold"); setDetailExpanded(false); }} style={{ flex: 1, ...btnStyle, background: surface2, border: "1px solid " + border, color: muted }}>NOT SURE</button>
            </div>
            {inspectIndex > 0 && (
              <button onClick={() => { const prev = inspectIndex - 1; setInspectIndex(prev); loadDecision(gcCards[prev]); setDetailExpanded(false); }} style={{ width: "100%", background: "none", border: "none", color: muted, fontFamily: font, fontSize: 12, cursor: "pointer", padding: "4px 0" }}>← Previous Card</button>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ─── COMPLETE ───
  if (screen === "complete") {
    const gradeCardData = gradeCards.map(d => gcCards.find(c => c.id === d.cardId)!).filter(Boolean);
    const sellCardData = sellCards.map(d => gcCards.find(c => c.id === d.cardId)!).filter(Boolean);

    return (
      <Shell title="Inspection Complete" back={() => setScreen("list")}>
        <div style={{ paddingTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div style={{ background: surface, borderRadius: 10, padding: 12, textAlign: "center" }}><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: green }}>{gradeCards.length}</div><div style={{ fontSize: 10, color: muted }}>Grade</div></div>
            <div style={{ background: surface, borderRadius: 10, padding: 12, textAlign: "center" }}><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: amber }}>{sellCards.length}</div><div style={{ fontSize: 10, color: muted }}>Sell Raw</div></div>
            <div style={{ background: surface, borderRadius: 10, padding: 12, textAlign: "center" }}><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: muted }}>{holdCards.length}</div><div style={{ fontSize: 10, color: muted }}>Hold</div></div>
          </div>

          {/* Sell section */}
          {sellCardData.length > 0 && (
            <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: amber, marginBottom: 8 }}>{sellCardData.length} card{sellCardData.length !== 1 ? "s" : ""} → SELL BOX</div>
              {sellCardData.slice(0, 5).map(c => <div key={c.id} style={{ fontSize: 11, color: muted, padding: "2px 0" }}>{c.player} — ${c.raw_value}</div>)}
              <button onClick={async () => {
                setSubmitting(true);
                if (!boxes.some(b => b.name === "SELL BOX")) await addBox("SELL BOX", 1, 50, "sell");
                let moved = 0;
                for (const c of sellCardData) {
                  const pos = getNextPosition("SELL BOX");
                  const d = decisions[c.id];
                  const { error } = await updateCard(c.id, { storage_box: "SELL BOX", storage_row: 1, storage_position: pos, notes: c.notes ? c.notes + " · " + (d?.condition.notes || "") : d?.condition.notes || "" });
                  if (!error) moved++;
                }
                setSubmitResult(prev => ({ ...prev, sold: moved }));
                setSubmitting(false);
              }} disabled={submitting} style={{ width: "100%", ...btnStyle, background: amber + "15", border: "1px solid " + amber + "30", color: amber, marginTop: 8, fontSize: 13 }}>{submitting ? "Moving..." : `Move ${sellCardData.length} to Sell Box`}</button>
            </div>
          )}

          {/* Grade section */}
          {gradeCardData.length > 0 && (
            <button onClick={() => { setSelectedCompany(""); setScreen("submission"); }} style={{ width: "100%", ...btnStyle, background: purple, color: "#fff", fontSize: 16, marginBottom: 12 }}>Submit {gradeCards.length} for Grading →</button>
          )}

          {holdCards.length > 0 && <div style={{ fontSize: 12, color: muted, textAlign: "center" }}>{holdCards.length} card{holdCards.length !== 1 ? "s" : ""} stay{holdCards.length === 1 ? "s" : ""} in Grade Check</div>}
        </div>
      </Shell>
    );
  }

  // ─── SUBMISSION ───
  if (screen === "submission") {
    const gradeCardData = gradeCards.map(d => gcCards.find(c => c.id === d.cardId)!).filter(Boolean);
    const totalCost = (n: number) => +(gradeCardData.length * n).toFixed(2);

    const companyData = GRADING_COMPANIES.map(co => {
      const total = totalCost(co.fee);
      const expectedReturn = gradeCardData.reduce((s, c) => {
        const d = decisions[c.id];
        const prob = (d?.gemProb || 15) / 100;
        const gv = c.graded_values || { "10": 0, "9": 0, "8": 0, "7": 0 };
        const p9 = Math.min(0.35, (1 - prob) * 0.45);
        const p8 = Math.min(0.30, (1 - prob - p9) * 0.55);
        const p7 = 1 - prob - p9 - p8;
        return s + (gv["10"] * prob + gv["9"] * p9 + gv["8"] * p8 + gv["7"] * p7) * co.premium;
      }, 0);
      const totalCostBasis = gradeCardData.reduce((s, c) => s + (c.cost_basis || 0), 0);
      const fees = expectedReturn * 0.1325;
      const shipping = gradeCardData.length * 4.50;
      const profit = +(expectedReturn - fees - shipping - total - totalCostBasis).toFixed(2);
      return { ...co, total, expectedReturn: +expectedReturn.toFixed(0), profit, totalCostBasis };
    });

    const bestValue = companyData.reduce((best, co) => co.profit > best.profit ? co : best, companyData[0]);
    if (!selectedCompany && bestValue) setSelectedCompany(bestValue.name);
    const selected = companyData.find(co => co.name === selectedCompany) || bestValue;
    const insuranceVal = Math.ceil(selected.expectedReturn / 500) * 500;

    return (
      <Shell title="Submit for Grading" back={() => setScreen("complete")}>
        <div style={{ paddingTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: text, marginBottom: 16 }}>{gradeCardData.length} cards ready</div>

          {/* Company comparison */}
          {companyData.map(co => (
            <button key={co.name} onClick={() => setSelectedCompany(co.name)} style={{ width: "100%", background: selectedCompany === co.name ? purple + "10" : surface, border: "1px solid " + (selectedCompany === co.name ? purple + "50" : border), borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{co.name}{co.name === bestValue.name ? " ⭐" : ""}</div>
                  <div style={{ fontSize: 11, color: muted }}>${co.fee}/card · {co.turnaround} · Total: ${co.total}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: co.profit >= 0 ? green : red }}>${co.profit}</div>
                  <div style={{ fontSize: 9, color: muted }}>est. profit</div>
                </div>
              </div>
            </button>
          ))}

          {/* Submission details */}
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginTop: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: purple, marginBottom: 8 }}>Submit {gradeCardData.length} cards to {selectedCompany}</div>
            <div style={{ fontSize: 12, color: muted }}><div>Grading cost: ${selected.total}</div><div>Expected return: ${selected.expectedReturn}</div><div>Turnaround: {selected.turnaround}</div><div style={{ marginTop: 4 }}>Ship insurance: ${insuranceVal}+ recommended</div></div>
          </div>

          <button disabled={submitting} onClick={async () => {
            setSubmitting(true);
            const boxName = "AT " + selectedCompany;
            if (!boxes.some(b => b.name === boxName)) await addBox(boxName, 1, 100, "grade_check");
            let graded = 0, errors = 0;
            for (const c of gradeCardData) {
              const { error } = await submitForGrading(c.id, selectedCompany);
              if (error) { errors++; continue; }
              const pos = getNextPosition(boxName);
              const d = decisions[c.id];
              await updateCard(c.id, { storage_box: boxName, storage_row: 1, storage_position: pos, gem_probability: (d?.gemProb || 15) / 100, notes: c.notes ? c.notes + " · Condition: " + (d?.condition.notes || "OK") : "Condition: " + (d?.condition.notes || "OK") });
              graded++;
            }
            setSubmitResult(prev => ({ ...prev, graded, errors }));
            setSubmitting(false);
            setScreen("confirmed");
          }} style={{ width: "100%", ...btnStyle, background: purple, color: "#fff", fontSize: 16 }}>{submitting ? "Submitting..." : "Confirm Submission"}</button>
        </div>
      </Shell>
    );
  }

  // ─── CONFIRMED ───
  if (screen === "confirmed") return (
    <Shell title="Submitted!" back={() => onNavigate({ screen: "home" })}>
      <div style={{ paddingTop: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>💎</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: green }}>{submitResult.graded} card{submitResult.graded !== 1 ? "s" : ""} submitted</div>
        <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>to {selectedCompany}</div>
        {submitResult.sold > 0 && <div style={{ fontSize: 13, color: amber, marginTop: 8 }}>{submitResult.sold} card{submitResult.sold !== 1 ? "s" : ""} moved to SELL BOX</div>}
        {submitResult.errors > 0 && <div style={{ fontSize: 13, color: red, marginTop: 4 }}>{submitResult.errors} errors</div>}
        <button onClick={() => onNavigate({ screen: "home" })} style={{ marginTop: 24, ...btnStyle, background: green, color: "#fff", padding: "14px 32px" }}>Done</button>
      </div>
    </Shell>
  );

  return null;
}
