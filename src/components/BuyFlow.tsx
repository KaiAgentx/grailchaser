"use client";
import { useState } from "react";
import { NewCard } from "@/lib/types";
import { Box, BoxType } from "@/hooks/useBoxes";
import { surface, surface2, border, green, red, cyan, muted, text, font, mono } from "./styles";

const labelStyle = { fontSize: 10, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 4 };
const btnStyle = { padding: "10px 14px", minHeight: 44, border: "none", borderRadius: 10, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", minHeight: 44, color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" as const, width: "100%" };

const SOURCES = ["Card Show", "eBay", "LCS", "Facebook", "Private"];
const PURPOSES = [
  { key: "sell", label: "Sell", color: green },
  { key: "grade", label: "Grade", color: "#f0c040" },
  { key: "pc", label: "Keep for PC", color: "#a855f7" },
];
const SPORTS = ["Baseball", "Football", "Basketball", "Hockey", "Soccer"];
const BRANDS = ["Topps", "Panini", "Bowman", "Donruss", "Upper Deck", "Fleer", "Score"];

// Known brand keywords in card names
const BRAND_KEYWORDS: [RegExp, string][] = [
  [/\b(Topps)\b/i, "Topps"],
  [/\b(Bowman)\b/i, "Bowman"],
  [/\b(Upper\s*Deck)\b/i, "Upper Deck"],
  [/\b(Fleer)\b/i, "Fleer"],
  [/\b(Score)\b/i, "Score"],
  [/\b(Panini)\b/i, "Panini"],
  [/\b(Donruss)\b/i, "Donruss"],
];

// Set keywords — these are set names that also indicate brand
const SET_KEYWORDS: [RegExp, string, string][] = [
  [/\b(Prizm)\b/i, "Prizm", "Panini"],
  [/\b(Select)\b/i, "Select", "Panini"],
  [/\b(Mosaic)\b/i, "Mosaic", "Panini"],
  [/\b(Optic)\b/i, "Optic", "Panini"],
  [/\b(Hoops)\b/i, "Hoops", "Panini"],
  [/\b(Chrome)\b/i, "Chrome", "Topps"],
  [/\b(Heritage)\b/i, "Heritage", "Topps"],
  [/\b(Stadium\s*Club)\b/i, "Stadium Club", "Topps"],
  [/\b(Finest)\b/i, "Finest", "Topps"],
];

function parseCardName(name: string) {
  let remaining = name;

  // Extract year
  const yearMatch = remaining.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? +yearMatch[0] : 0;
  if (yearMatch) remaining = remaining.replace(yearMatch[0], "");

  // Extract brand
  let brand = "";
  for (const [re, b] of BRAND_KEYWORDS) {
    if (re.test(remaining)) { brand = b; remaining = remaining.replace(re, ""); break; }
  }

  // Extract set (also infers brand if not found)
  let set = "";
  for (const [re, s, inferredBrand] of SET_KEYWORDS) {
    if (re.test(remaining)) {
      set = s;
      remaining = remaining.replace(re, "");
      if (!brand) brand = inferredBrand;
      break;
    }
  }

  // Clean remaining text as player name
  const player = remaining
    .replace(/#\S+/g, "")
    .replace(/\b(RC|Base|Card|Rookie|Silver|Gold|Holo|Refractor|Numbered)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { player, year, brand, set };
}

interface Props {
  cardData: Partial<NewCard>;
  isManual: boolean;
  boxes: Box[];
  getNextPosition: (boxName: string) => number;
  addCard: (card: Partial<NewCard>) => Promise<{ data: any; error: any }>;
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType, mode?: "sports" | "tcg") => Promise<any>;
  onDone: () => void;
  onCancel: () => void;
}

export function BuyFlow({ cardData, isManual, boxes, getNextPosition, addCard, addBox, onDone, onCancel }: Props) {
  // Editable card fields (for manual entry)
  const [editPlayer, setEditPlayer] = useState(cardData.player || "");
  const [editSport, setEditSport] = useState(cardData.sport || "");
  const [editBrand, setEditBrand] = useState(cardData.brand || "");
  const [editYear, setEditYear] = useState(cardData.year || 0);
  const [editSet, setEditSet] = useState(cardData.set || "");

  const [source, setSource] = useState("");
  const [selectedBox, setSelectedBox] = useState("");
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showNewBox, setShowNewBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState("");

  const position = selectedBox ? getNextPosition(selectedBox) : 0;
  const ready = source && selectedBox && purpose && editPlayer && (isManual ? editSport : true);

  const handleSave = async () => {
    if (!ready) return;
    setSaving(true);
    const card: Partial<NewCard> = {
      ...cardData,
      player: editPlayer,
      sport: (editSport || cardData.sport || "Baseball") as any,
      brand: editBrand || cardData.brand || "",
      year: editYear || cardData.year || new Date().getFullYear(),
      set: editSet || cardData.set || "",
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
          {/* Card details — editable for manual entry */}
          {isManual && (
            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid " + border }}>
              <div style={{ ...labelStyle, marginBottom: 8, fontSize: 11, color: cyan }}>Card Details</div>
              <div style={{ marginBottom: 10 }}>
                <div style={labelStyle}>Player</div>
                <input value={editPlayer} onChange={e => setEditPlayer(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={labelStyle}>Sport (required)</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {SPORTS.map(s => (
                    <button key={s} onClick={() => setEditSport(s)} style={{ ...btnStyle, padding: "8px 12px", background: editSport === s ? cyan + "20" : surface2, border: "1px solid " + (editSport === s ? cyan + "50" : border), color: editSport === s ? cyan : muted, fontSize: 12 }}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={labelStyle}>Brand</div>
                  <input value={editBrand} onChange={e => setEditBrand(e.target.value)} placeholder="Panini, Topps..." style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Year</div>
                  <input type="text" inputMode="numeric" value={editYear || ""} onChange={e => setEditYear(+e.target.value || 0)} style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={labelStyle}>Set</div>
                <input value={editSet} onChange={e => setEditSet(e.target.value)} placeholder="Prizm, Chrome..." style={inputStyle} />
              </div>
            </div>
          )}

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

export { parseCardName };
