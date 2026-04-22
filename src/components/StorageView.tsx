"use client";
import { useState } from "react";
import { Card } from "@/lib/types";
import { isTcgGame } from "@/lib/games";
import { Box, BoxType, BOX_TYPE_LABELS } from "@/hooks/useBoxes";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, muted, text, font, mono } from "./styles";

const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", minHeight: 44, color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box" as const, width: "100%" };
const labelStyle = { fontSize: 10, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 4 };
const btnStyle = { padding: "12px 16px", minHeight: 44, border: "none", borderRadius: 10, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" };

const typeColors: Record<BoxType, string> = { scanned: cyan, singles: text, sell: green, slabs_sell: green, slabs_pc: "#a855f7", pc: "#a855f7", grade_check: "#f0c040", sorted: text };

type Screen = "list" | "create" | "detail" | "edit";

interface Props {
  cards: Card[];
  boxes: Box[];
  ecosystemMode?: "sports" | "tcg" | null;
  onBack: () => void;
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType, mode?: "sports" | "tcg") => Promise<any>;
  updateBox: (id: string, updates: Partial<Pick<Box, "name" | "num_rows" | "divider_size" | "box_type">>) => Promise<any>;
  deleteBox: (id: string) => Promise<any>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<any>;
  onCardTap: (card: Card, boxName?: string) => void;
  onNavigate?: (target: { screen: string; boxName?: string }) => void;
  initialBoxName?: string;
  getNextPosition: (boxName: string) => number;
  getBoxCards: (boxName: string) => Card[];
}

export function StorageView({ cards, boxes, ecosystemMode, initialBoxName, onBack, addBox, updateBox, deleteBox, updateCard, onCardTap, onNavigate, getNextPosition, getBoxCards }: Props) {
  const initBox = initialBoxName ? boxes.find(b => b.name === initialBoxName) || null : null;
  const [screen, setScreen] = useState<Screen>(initBox ? "detail" : "list");
  const [selectedBox, setSelectedBox] = useState<Box | null>(initBox);
  const [newName, setNewName] = useState("");
  const [newRows, setNewRows] = useState(1);
  const [newDivider, setNewDivider] = useState(50);
  const [newType, setNewType] = useState<BoxType>("singles");
  const [editName, setEditName] = useState("");
  const [editRows, setEditRows] = useState(1);
  const [editDivider, setEditDivider] = useState(50);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // Filter boxes by mode column, cards by game column.
  const isTcgCard = (c: any) => c.game && isTcgGame(c.game);
  const ecoBoxes = ecosystemMode === "tcg" ? boxes.filter(b => b.mode === "tcg") : ecosystemMode === "sports" ? boxes.filter(b => b.mode !== "tcg") : boxes;
  const ecoCards = ecosystemMode === "tcg" ? cards.filter(isTcgCard) : ecosystemMode === "sports" ? cards.filter(c => !isTcgCard(c)) : cards;
  const unassigned = ecoCards.filter(c => !c.storage_box || c.storage_box === "PENDING");

  // ─── BOX LIST ───
  if (screen === "list") return (
    <Shell title="My Boxes" back={onBack}>
      <div style={{ paddingTop: 16 }}>
        {unassigned.length > 0 && (
          <div style={{ background: accent + "10", border: "1px solid " + accent + "30", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: accent }}>Unassigned Cards</div><div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Need a box assignment</div></div>
            <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: accent }}>{unassigned.length}</div>
          </div>
        )}

        {ecoBoxes.map(box => {
          const count = box.card_count || 0;
          const typeLabel = BOX_TYPE_LABELS[box.box_type || "singles"]?.label || box.box_type;
          const typeColor = typeColors[box.box_type || "singles"] || text;
          return (
            <button key={box.id} onClick={() => { setSelectedBox(box); setScreen("detail"); }} style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 14, padding: "16px 18px", cursor: "pointer", textAlign: "left", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: text }}>{box.name}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: typeColor + "15", border: "1px solid " + typeColor + "30", color: typeColor, fontWeight: 600 }}>{typeLabel}</span>
                  <span style={{ fontSize: 11, color: muted }}>{box.num_rows} row{box.num_rows > 1 ? "s" : ""}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: count > 0 ? green : muted }}>{count}</div>
                <div style={{ fontSize: 10, color: muted }}>cards</div>
              </div>
            </button>
          );
        })}

        {ecoBoxes.length === 0 && <div style={{ textAlign: "center", color: muted, fontSize: 13, padding: "40px 0" }}>{ecosystemMode === "tcg" ? "No TCG boxes yet. Create one to get started." : "No boxes yet — create one to start organizing"}</div>}

        <button onClick={() => { setNewName(""); setNewRows(1); setNewDivider(50); setNewType("singles"); setScreen("create"); }} style={{ width: "100%", ...btnStyle, background: green + "15", border: "1px solid " + green + "30", color: green, marginTop: 8 }}>+ Create New Box</button>
      </div>
    </Shell>
  );

  // ─── CREATE BOX ───
  if (screen === "create") return (
    <Shell title="Create Box" back={() => setScreen("list")}>
      <div style={{ paddingTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Box Name</div>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="BOX A, SELL BOX, GRAILS..." style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Box Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(Object.entries(BOX_TYPE_LABELS) as [BoxType, { label: string; desc: string }][]).map(([key, { label, desc }]) => (
              <button key={key} onClick={() => setNewType(key)} style={{ ...btnStyle, padding: "10px 14px", textAlign: "left", background: newType === key ? typeColors[key] + "15" : surface2, border: "1px solid " + (newType === key ? typeColors[key] + "50" : border), color: newType === key ? typeColors[key] : muted }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>Number of Rows</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 4].map(n => (
              <button key={n} onClick={() => setNewRows(n)} style={{ ...btnStyle, flex: 1, background: newRows === n ? cyan + "20" : surface2, border: "1px solid " + (newRows === n ? cyan + "50" : border), color: newRows === n ? cyan : muted }}>{n} Row{n > 1 ? "s" : ""}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={labelStyle}>Divider Every</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[25, 50, 100].map(n => (
              <button key={n} onClick={() => setNewDivider(n)} style={{ ...btnStyle, flex: 1, background: newDivider === n ? cyan + "20" : surface2, border: "1px solid " + (newDivider === n ? cyan + "50" : border), color: newDivider === n ? cyan : muted }}>{n} cards</button>
            ))}
          </div>
        </div>
        {createError && <div style={{ fontSize: 12, color: red, textAlign: "center", marginBottom: 8 }}>{createError}</div>}
        <button disabled={!newName.trim() || saving} onClick={async () => { setSaving(true); setCreateError(""); const { error } = await addBox(newName.trim(), newRows, newDivider, newType, ecosystemMode === "tcg" ? "tcg" : "sports"); setSaving(false); if (error) setCreateError(error.message || "Failed to create box"); else setScreen("list"); }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", opacity: newName.trim() ? 1 : 0.4 }}>{saving ? "Creating..." : "Create Box"}</button>
      </div>
    </Shell>
  );

  // ─── EDIT BOX ───
  if (screen === "edit" && selectedBox) {
    const count = selectedBox.card_count || 0;
    return (
      <Shell title="Edit Box" back={() => setScreen("detail")}>
        <div style={{ paddingTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Box Name</div>
            <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Number of Rows</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 4].map(n => (
                <button key={n} onClick={() => setEditRows(n)} style={{ ...btnStyle, flex: 1, background: editRows === n ? cyan + "20" : surface2, border: "1px solid " + (editRows === n ? cyan + "50" : border), color: editRows === n ? cyan : muted }}>{n}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={labelStyle}>Divider Every</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[25, 50, 100].map(n => (
                <button key={n} onClick={() => setEditDivider(n)} style={{ ...btnStyle, flex: 1, background: editDivider === n ? cyan + "20" : surface2, border: "1px solid " + (editDivider === n ? cyan + "50" : border), color: editDivider === n ? cyan : muted }}>{n}</button>
              ))}
            </div>
          </div>
          <button disabled={!editName.trim() || saving} onClick={async () => {
            setSaving(true);
            const oldName = selectedBox.name;
            await updateBox(selectedBox.id, { name: editName.trim(), num_rows: editRows, divider_size: editDivider });
            if (editName.trim() !== oldName) {
              const boxCards = getBoxCards(oldName);
              for (const c of boxCards) await updateCard(c.id, { storage_box: editName.trim() });
            }
            setSelectedBox({ ...selectedBox, name: editName.trim(), num_rows: editRows, divider_size: editDivider });
            setSaving(false);
            setScreen("detail");
          }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", marginBottom: 12 }}>{saving ? "Saving..." : "Save Changes"}</button>

          {count === 0 ? (
            <button onClick={async () => { await deleteBox(selectedBox.id); setScreen("list"); }} style={{ width: "100%", ...btnStyle, background: red + "15", border: "1px solid " + red + "30", color: red }}>Delete Box</button>
          ) : (
            <div style={{ fontSize: 11, color: muted, textAlign: "center", marginTop: 4 }}>{count === 1 ? "Remove the 1 card to delete this box" : `Remove all ${count} cards to delete this box`}</div>
          )}
        </div>
      </Shell>
    );
  }

  // ─── BOX DETAIL ───
  if (screen === "detail" && selectedBox) {
    const boxCards = getBoxCards(selectedBox.name);
    const totalValue = boxCards.reduce((s, c) => s + (c.raw_value || 0), 0);
    const typeLabel = BOX_TYPE_LABELS[selectedBox.box_type || "singles"]?.label || selectedBox.box_type;
    const typeColor = typeColors[selectedBox.box_type || "singles"] || text;

    // Split by rows
    const rowCards: Card[][] = [];
    if (selectedBox.num_rows === 1) {
      rowCards.push(boxCards);
    } else {
      for (let r = 1; r <= selectedBox.num_rows; r++) rowCards.push(boxCards.filter(c => c.storage_row === r));
      if (rowCards.every(r => r.length === 0) && boxCards.length > 0) rowCards[0] = boxCards;
    }

    // Build divider sections
    const buildSections = (sectionCards: Card[], dividerSize: number) => {
      const sections: { label: string; cards: Card[] }[] = [];
      let current: Card[] = [];
      let start = 0;
      for (const card of sectionCards) {
        const idx = Math.floor((card.storage_position - 1) / dividerSize);
        const s = idx * dividerSize + 1;
        if (s !== start) {
          if (current.length > 0) sections.push({ label: `${start}–${start + dividerSize - 1}`, cards: current });
          current = [];
          start = s;
        }
        current.push(card);
      }
      if (current.length > 0) sections.push({ label: `${start}–${start + dividerSize - 1}`, cards: current });
      return sections;
    };

    return (
      <Shell title={selectedBox.name} back={() => setScreen("list")}>
        <div style={{ paddingTop: 16 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: typeColor + "15", border: "1px solid " + typeColor + "30", color: typeColor, fontWeight: 600 }}>{typeLabel}</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: green }}>{boxCards.length} cards</div>
              <div style={{ fontSize: 12, color: muted }}>${totalValue.toFixed(2)} total value</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {selectedBox.box_type === "scanned" && onNavigate && <button onClick={() => onNavigate({ screen: "smartPull", boxName: selectedBox.name })} style={{ ...btnStyle, padding: "8px 12px", background: "#a855f715", border: "1px solid #a855f730", color: "#a855f7", fontSize: 11 }}>Smart Pull</button>}
              {selectedBox.box_type === "grade_check" && !selectedBox.name.startsWith("AT ") && onNavigate && <button onClick={() => onNavigate({ screen: "gradeCheck" })} style={{ ...btnStyle, padding: "8px 12px", background: "#a855f715", border: "1px solid #a855f730", color: "#a855f7", fontSize: 11 }}>Inspect</button>}
              {selectedBox.name.startsWith("AT ") && onNavigate && <button onClick={() => onNavigate({ screen: "gradingReturn" })} style={{ ...btnStyle, padding: "8px 12px", background: "#a855f715", border: "1px solid #a855f730", color: "#a855f7", fontSize: 11 }}>Process Return</button>}
              {onNavigate && <button onClick={() => onNavigate({ screen: "lotBuilder", boxName: selectedBox.name })} style={{ ...btnStyle, padding: "8px 12px", background: "#f59e0b15", border: "1px solid #f59e0b30", color: "#f59e0b", fontSize: 11 }}>Create Lot</button>}
              <button onClick={() => { setEditName(selectedBox.name); setEditRows(selectedBox.num_rows); setEditDivider(selectedBox.divider_size); setScreen("edit"); }} style={{ ...btnStyle, padding: "8px 16px", background: surface2, border: "1px solid " + border, color: muted, fontSize: 12 }}>Edit</button>
            </div>
          </div>

          {boxCards.length === 0 && <div style={{ textAlign: "center", color: muted, fontSize: 13, padding: "40px 0" }}>No cards in this box yet</div>}

          {rowCards.map((rCards, rowIdx) => {
            if (rCards.length === 0 && selectedBox.num_rows === 1) return null;
            const sections = buildSections(rCards, selectedBox.divider_size);
            return (
              <div key={rowIdx}>
                {selectedBox.num_rows > 1 && (
                  <div style={{ fontSize: 11, color: accent, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, marginBottom: 8, marginTop: rowIdx > 0 ? 20 : 0 }}>Row {rowIdx + 1}</div>
                )}
                {sections.map(section => (
                  <div key={section.label}>
                    <div style={{ fontSize: 10, color: cyan, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, padding: "8px 0 4px", borderBottom: "1px solid " + border, marginBottom: 4 }}>{section.label}</div>
                    {section.cards.map(card => (
                      <button key={card.id} onClick={() => onCardTap(card, selectedBox?.name)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", background: "none", border: "none", borderBottom: "1px solid " + border, cursor: "pointer", textAlign: "left" }}>
                        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: cyan, width: 36, textAlign: "right" }}>{card.storage_position}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.player}</div>
                          <div style={{ fontSize: 11, color: muted }}>{card.year} {card.brand} {card.set}{card.parallel !== "Base" ? " " + card.parallel : ""}</div>
                        </div>
                        <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: green }}>${card.raw_value}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {rCards.length === 0 && selectedBox.num_rows > 1 && <div style={{ fontSize: 11, color: muted, padding: "12px 0" }}>Empty</div>}
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  return null;
}
