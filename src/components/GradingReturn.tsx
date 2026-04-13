"use client";
import { useState, useMemo } from "react";
import { Card } from "@/lib/types";
import { Box, BoxType } from "@/hooks/useBoxes";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, purple, muted, text, font, mono } from "./styles";

const btnStyle = { padding: "12px 16px", minHeight: 48, border: "none", borderRadius: 12, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" };

function calcProfit(gradedValue: number, gradingCost: number, costBasis: number) {
  return +(gradedValue - gradedValue * 0.1325 - 4.50 - gradingCost - costBasis).toFixed(2);
}

const GRADES = ["10", "9.5", "9", "8.5", "8", "7", "AUTH"];

interface GradeEntry { cardId: string; grade: string; dest: "sell" | "keep"; profit: number; gradedValue: number }

interface Props {
  cards: Card[];
  boxes: Box[];
  updateCard: (id: string, updates: Partial<Card>) => Promise<any>;
  returnFromGrading: (id: string, grade: string) => Promise<any>;
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType, mode?: "sports" | "tcg") => Promise<any>;
  getNextPosition: (boxName: string) => number;
  onNavigate: (target: { screen: string }) => void;
}

export function GradingReturn({ cards, boxes, updateCard, returnFromGrading, addBox, getNextPosition, onNavigate }: Props) {
  const gradingCards = useMemo(() => cards.filter(c => c.status === "grading"), [cards]);
  const companies = [...new Set(gradingCards.map(c => c.grading_company).filter(Boolean))];

  const [selectedCompany, setSelectedCompany] = useState(companies[0] || "");
  const [screen, setScreen] = useState<"select" | "grading" | "complete">(companies.length === 1 ? "grading" : "select");
  const [gradeIndex, setGradeIndex] = useState(0);
  const [entries, setEntries] = useState<Record<string, GradeEntry>>({});
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ moved: number; errors: number; sellCount: number; keepCount: number }>({ moved: 0, errors: 0, sellCount: 0, keepCount: 0 });

  const companyCards = useMemo(() => gradingCards.filter(c => c.grading_company === selectedCompany).sort((a, b) => (a.storage_position || 0) - (b.storage_position || 0)), [gradingCards, selectedCompany]);

  // ─── EMPTY ───
  if (gradingCards.length === 0) return (
    <Shell title="Grading Return" back={() => onNavigate({ screen: "home" })}>
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: muted }}>No cards at grading</div>
      </div>
    </Shell>
  );

  // ─── SELECT COMPANY ───
  if (screen === "select") return (
    <Shell title="Grading Return" back={() => onNavigate({ screen: "home" })}>
      <div style={{ paddingTop: 20 }}>
        <div style={{ fontSize: 14, color: muted, marginBottom: 16 }}>Which company returned cards?</div>
        {companies.map(co => {
          const count = gradingCards.filter(c => c.grading_company === co).length;
          return (
            <button key={co} onClick={() => { setSelectedCompany(co!); setGradeIndex(0); setScreen("grading"); }} style={{ width: "100%", ...btnStyle, background: surface, border: "1px solid " + border, marginBottom: 8, textAlign: "left", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: text }}>{co}</span>
              <span style={{ fontFamily: mono, color: purple }}>{count} card{count !== 1 ? "s" : ""}</span>
            </button>
          );
        })}
      </div>
    </Shell>
  );

  // ─── GRADING ───
  if (screen === "grading") {
    const card = companyCards[gradeIndex];

    if (!card) {
      // All done — process
      if (!processing && results.moved === 0) handleProcess();
      return (
        <Shell title="Processing...">
          <div style={{ paddingTop: 60, textAlign: "center" }}>
            <div style={{ display: "inline-block", width: 32, height: 32, border: "3px solid " + border, borderTopColor: purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 14, color: muted, marginTop: 12 }}>Moving cards...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </Shell>
      );
    }

    const entry = entries[card.id];
    const gv = card.graded_values || { "10": 0, "9": 0, "8": 0, "7": 0 };
    const gradingCost = card.grading_cost || 25;
    const cost = card.cost_basis || 0;

    return (
      <Shell title={`Return ${gradeIndex + 1}/${companyCards.length}`} back={() => setScreen("select")}>
        <div style={{ paddingTop: 16 }}>
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: text }}>{card.player}</div>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{card.year} {card.brand} {card.set}</div>
            <div style={{ fontSize: 12, color: purple, marginTop: 4 }}>Raw: ${card.raw_value} | Grading cost: ${gradingCost}</div>
          </div>

          {/* Grade buttons */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Grade Received</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {GRADES.map(g => {
                const sel = entry?.grade === g;
                return (
                  <button key={g} onClick={() => {
                    const gradeVal = g === "AUTH" ? 0 : g === "10" ? gv["10"] : g === "9.5" ? gv["9"] * 1.2 : g === "9" ? gv["9"] : g === "8.5" ? (gv["8"] + gv["9"]) / 2 : g === "8" ? gv["8"] : gv["7"];
                    const profit = calcProfit(gradeVal, gradingCost, cost);
                    setEntries(prev => ({ ...prev, [card.id]: { cardId: card.id, grade: g, dest: "sell", profit, gradedValue: +gradeVal.toFixed(2) } }));
                  }} style={{ ...btnStyle, padding: "10px 14px", background: sel ? purple + "20" : surface2, border: "1px solid " + (sel ? purple + "50" : border), color: sel ? purple : muted, fontSize: 13 }}>{g === "AUTH" ? "AUTH" : g}</button>
                );
              })}
            </div>
          </div>

          {/* Result display */}
          {entry && (
            <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: muted }}>Graded value</span>
                <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: entry.gradedValue > 0 ? green : red }}>${entry.gradedValue}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: muted }}>Profit</span>
                <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: entry.profit >= 0 ? green : red }}>{entry.profit >= 0 ? "+" : ""}${entry.profit}</span>
              </div>

              <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Destination</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEntries(prev => ({ ...prev, [card.id]: { ...prev[card.id], dest: "sell" } }))} style={{ flex: 1, ...btnStyle, background: entry.dest === "sell" ? green + "20" : surface2, border: "1px solid " + (entry.dest === "sell" ? green + "50" : border), color: entry.dest === "sell" ? green : muted }}>💰 Sell</button>
                <button onClick={() => setEntries(prev => ({ ...prev, [card.id]: { ...prev[card.id], dest: "keep" } }))} style={{ flex: 1, ...btnStyle, background: entry.dest === "keep" ? purple + "20" : surface2, border: "1px solid " + (entry.dest === "keep" ? purple + "50" : border), color: entry.dest === "keep" ? purple : muted }}>💎 Keep</button>
              </div>
            </div>
          )}

          {/* Next */}
          <button disabled={!entry} onClick={() => setGradeIndex(gradeIndex + 1)} style={{ width: "100%", ...btnStyle, background: entry ? green : surface2, color: entry ? "#fff" : muted, fontSize: 16, opacity: entry ? 1 : 0.4 }}>Next →</button>
          {gradeIndex > 0 && <button onClick={() => setGradeIndex(gradeIndex - 1)} style={{ width: "100%", ...btnStyle, background: surface2, border: "1px solid " + border, color: muted, marginTop: 8, fontSize: 12 }}>← Previous</button>}
        </div>
      </Shell>
    );
  }

  async function handleProcess() {
    setProcessing(true);
    const sellBoxName = "SLABS - SELL";
    const keepBoxName = "SLABS - PC";

    if (!boxes.some(b => b.name === sellBoxName)) await addBox(sellBoxName, 1, 100, "slabs_sell");
    if (!boxes.some(b => b.name === keepBoxName)) await addBox(keepBoxName, 1, 100, "slabs_pc");

    let moved = 0, errors = 0, sellCount = 0, keepCount = 0;

    for (const entry of Object.values(entries)) {
      const { error } = await returnFromGrading(entry.cardId, entry.grade);
      if (error) { errors++; continue; }

      const destBox = entry.dest === "sell" ? sellBoxName : keepBoxName;
      const pos = getNextPosition(destBox);
      await updateCard(entry.cardId, { storage_box: destBox, storage_row: 1, storage_position: pos, raw_value: entry.gradedValue });

      moved++;
      if (entry.dest === "sell") sellCount++;
      else keepCount++;
    }

    setResults({ moved, errors, sellCount, keepCount });
    setProcessing(false);
    setScreen("complete");
  }

  // ─── COMPLETE ───
  if (screen === "complete") {
    const allEntries = Object.values(entries);
    const totalGradingCost = companyCards.reduce((s, c) => s + (c.grading_cost || 25), 0);
    const totalGradedValue = allEntries.reduce((s, e) => s + e.gradedValue, 0);
    const totalProfit = allEntries.reduce((s, e) => s + e.profit, 0);
    const gradeCounts: Record<string, number> = {};
    allEntries.forEach(e => { gradeCounts[e.grade] = (gradeCounts[e.grade] || 0) + 1; });

    return (
      <Shell title="Return Complete" back={() => onNavigate({ screen: "home" })}>
        <div style={{ paddingTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>💎</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: green }}>{results.moved} card{results.moved !== 1 ? "s" : ""} returned</div>
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>from {selectedCompany}</div>

          <div style={{ background: surface, borderRadius: 14, padding: 16, marginTop: 16, marginBottom: 16, textAlign: "left" }}>
            <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Grades</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {Object.entries(gradeCounts).map(([g, c]) => <span key={g} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 8, background: g === "10" ? green + "15" : g === "AUTH" ? red + "15" : surface2, color: g === "10" ? green : g === "AUTH" ? red : text, fontWeight: 600 }}>{g === "AUTH" ? "AUTH" : "PSA " + g}: {c}</span>)}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + border }}><span style={{ color: muted }}>Grading cost</span><span style={{ fontFamily: mono, color: red }}>${totalGradingCost.toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid " + border }}><span style={{ color: muted }}>Graded value</span><span style={{ fontFamily: mono, color: green }}>${totalGradedValue.toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}><span style={{ fontWeight: 600 }}>Total profit</span><span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: totalProfit >= 0 ? green : red }}>{totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(2)}</span></div>
          </div>

          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
            {results.sellCount > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: green + "15", color: green, fontWeight: 600 }}>{results.sellCount} to SLABS - SELL</span>}
            {results.keepCount > 0 && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, background: purple + "15", color: purple, fontWeight: 600 }}>{results.keepCount} to SLABS - PC</span>}
          </div>

          <button onClick={() => onNavigate({ screen: "home" })} style={{ ...btnStyle, background: green, color: "#fff", padding: "14px 32px" }}>Done</button>
        </div>
      </Shell>
    );
  }

  return null;
}
