"use client";
import { useState } from "react";
import { NewCard } from "@/lib/types";
import { Box, BoxType, BOX_TYPE_LABELS } from "@/hooks/useBoxes";
import { surface, surface2, border, accent, green, red, cyan, muted, text, font, mono } from "./styles";

const labelStyle = { fontSize: 10, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 4 };
const btnStyle = { padding: "10px 14px", minHeight: 44, border: "none", borderRadius: 10, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer" };

const SOURCES = ["Card Show", "eBay", "LCS", "Facebook", "Private"];
const PURPOSES = [
  { key: "sell", label: "Sell", color: green },
  { key: "grade", label: "Grade", color: "#f0c040" },
  { key: "pc", label: "Keep for PC", color: "#a855f7" },
];

interface Props {
  cardData: Partial<NewCard>;
  boxes: Box[];
  getNextPosition: (boxName: string) => number;
  addCard: (card: Partial<NewCard>) => Promise<{ data: any; error: any }>;
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType) => Promise<any>;
  onDone: () => void;
  onCancel: () => void;
}

export function BuyFlow({ cardData, boxes, getNextPosition, addCard, addBox, onDone, onCancel }: Props) {
  const [source, setSource] = useState("");
  const [selectedBox, setSelectedBox] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showNewBox, setShowNewBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState("");

  const position = selectedBox ? getNextPosition(selectedBox) : 0;
  const ready = source && selectedBox && purpose;

  const handleSave = async () => {
    if (!ready) return;
    setSaving(true);
    const card: Partial<NewCard> = {
      ...cardData,
      storage_box: selectedBox,
      storage_row: 1,
      storage_position: position,
      purchase_source: source,
      purchase_intent: purpose as any,
      notes: [cardData.notes, `Source: ${source}`, `Purpose: ${purpose}`].filter(Boolean).join(" · "),
    };
    const { error } = await addCard(card);
    setSaving(false);
    if (error) {
      setResult("Error: " + error.message);
    } else {
      setResult(`Added to ${selectedBox} — Position ${position}`);
      setTimeout(onDone, 1500);
    }
  };

  const handleCreateBox = async () => {
    if (!newBoxName.trim()) return;
    setSaving(true);
    const { data, error } = await addBox(newBoxName.trim(), 1, 50, "singles");
    setSaving(false);
    if (!error && data) {
      setSelectedBox(newBoxName.trim());
      setShowNewBox(false);
      setNewBoxName("");
    }
  };

  return (
    <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      {result && <div style={{ background: result.startsWith("Error") ? red + "15" : green + "15", border: "1px solid " + (result.startsWith("Error") ? red : green) + "30", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: result.startsWith("Error") ? red : green, textAlign: "center", fontWeight: 600 }}>{result}</div>}

      {!result && (
        <>
          {/* Source */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Where did you buy it?</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SOURCES.map(s => (
                <button key={s} onClick={() => setSource(s)} style={{ ...btnStyle, background: source === s ? cyan + "20" : surface2, border: "1px solid " + (source === s ? cyan + "50" : border), color: source === s ? cyan : muted }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Box selection */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Which box?</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {boxes.map(b => (
                <button key={b.id} onClick={() => setSelectedBox(b.name)} style={{ ...btnStyle, background: selectedBox === b.name ? green + "20" : surface2, border: "1px solid " + (selectedBox === b.name ? green + "50" : border), color: selectedBox === b.name ? green : muted }}>
                  {b.name} <span style={{ fontSize: 10, opacity: 0.7 }}>({b.card_count})</span>
                </button>
              ))}
              <button onClick={() => setShowNewBox(!showNewBox)} style={{ ...btnStyle, background: surface2, border: "1px dashed " + border, color: muted }}>+ New</button>
            </div>
            {showNewBox && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input value={newBoxName} onChange={e => setNewBoxName(e.target.value)} placeholder="Box name" style={{ flex: 1, background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "8px 12px", color: text, fontFamily: font, fontSize: 14, outline: "none" }} />
                <button onClick={handleCreateBox} disabled={!newBoxName.trim() || saving} style={{ ...btnStyle, background: green, color: "#fff", padding: "8px 16px" }}>Add</button>
              </div>
            )}
            {selectedBox && <div style={{ fontSize: 12, color: green, marginTop: 6, fontFamily: mono }}>Position {position}</div>}
          </div>

          {/* Purpose */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Purpose?</div>
            <div style={{ display: "flex", gap: 6 }}>
              {PURPOSES.map(p => (
                <button key={p.key} onClick={() => setPurpose(p.key)} style={{ ...btnStyle, flex: 1, background: purpose === p.key ? p.color + "20" : surface2, border: "1px solid " + (purpose === p.key ? p.color + "50" : border), color: purpose === p.key ? p.color : muted }}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Save */}
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={!ready || saving} onClick={handleSave} style={{ flex: 1, padding: "16px", minHeight: 48, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: ready ? 1 : 0.4 }}>{saving ? "Saving..." : "Save Card"}</button>
            <button onClick={onCancel} style={{ padding: "16px 20px", minHeight: 48, background: surface2, border: "1px solid " + border, borderRadius: 12, color: muted, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
