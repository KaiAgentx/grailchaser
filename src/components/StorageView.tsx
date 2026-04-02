"use client";
import { useState } from "react";
import { Card } from "@/lib/types";
import { Box } from "@/hooks/useBoxes";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, muted, text, font, mono } from "./styles";

const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", minHeight: 44, color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box" as const, width: "100%" };
const labelStyle = { fontSize: 10, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 4 };
const btnStyle = { padding: "12px 16px", minHeight: 44, border: "none", borderRadius: 10, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" };

type Screen = "list" | "create" | "detail" | "edit";

interface Props {
  cards: Card[];
  boxes: Box[];
  onBack: () => void;
  addBox: (name: string, numRows: number, dividerSize: number) => Promise<any>;
  updateBox: (id: string, updates: Partial<Pick<Box, "name" | "num_rows" | "divider_size">>) => Promise<any>;
  deleteBox: (id: string) => Promise<any>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<any>;
  onCardTap: (card: Card) => void;
}

export function StorageView({ cards, boxes, onBack, addBox, updateBox, deleteBox, updateCard, onCardTap }: Props) {
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [newName, setNewName] = useState("");
  const [newRows, setNewRows] = useState(1);
  const [newDivider, setNewDivider] = useState(50);
  const [editName, setEditName] = useState("");
  const [editRows, setEditRows] = useState(1);
  const [editDivider, setEditDivider] = useState(50);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const unassigned = cards.filter(c => !c.storage_box || c.storage_box === "PENDING");
  const cardsInBox = (boxName: string) => cards.filter(c => c.storage_box === boxName);

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

        {boxes.map(box => {
          const count = cardsInBox(box.name).length;
          return (
            <button key={box.id} onClick={() => { setSelectedBox(box); setScreen("detail"); }} style={{ width: "100%", background: surface, border: "1px solid " + border, borderRadius: 14, padding: "16px 18px", cursor: "pointer", textAlign: "left", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: text }}>{box.name}</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{box.num_rows} row{box.num_rows > 1 ? "s" : ""} · dividers every {box.divider_size}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: count > 0 ? green : muted }}>{count}</div>
                <div style={{ fontSize: 10, color: muted }}>cards</div>
              </div>
            </button>
          );
        })}

        {boxes.length === 0 && <div style={{ textAlign: "center", color: muted, fontSize: 13, padding: "40px 0" }}>No boxes yet — create one to start organizing</div>}

        <button onClick={() => { setNewName(""); setNewRows(1); setNewDivider(50); setScreen("create"); }} style={{ width: "100%", ...btnStyle, background: green + "15", border: "1px solid " + green + "30", color: green, marginTop: 8 }}>+ Create New Box</button>
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
        {saving === false && createError && <div style={{ fontSize: 12, color: red, textAlign: "center", marginBottom: 8 }}>{createError}</div>}
        <button disabled={!newName.trim() || saving} onClick={async () => { setSaving(true); setCreateError(""); const { error } = await addBox(newName.trim(), newRows, newDivider); setSaving(false); if (error) { setCreateError(error.message || "Failed to create box — have you run the SQL migration?"); } else { setScreen("list"); } }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", opacity: newName.trim() ? 1 : 0.4 }}>{saving ? "Creating..." : "Create Box"}</button>
      </div>
    </Shell>
  );

  // ─── EDIT BOX ───
  if (screen === "edit" && selectedBox) return (
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
              <button key={n} onClick={() => setEditRows(n)} style={{ ...btnStyle, flex: 1, background: editRows === n ? cyan + "20" : surface2, border: "1px solid " + (editRows === n ? cyan + "50" : border), color: editRows === n ? cyan : muted }}>{n} Row{n > 1 ? "s" : ""}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={labelStyle}>Divider Every</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[25, 50, 100].map(n => (
              <button key={n} onClick={() => setEditDivider(n)} style={{ ...btnStyle, flex: 1, background: editDivider === n ? cyan + "20" : surface2, border: "1px solid " + (editDivider === n ? cyan + "50" : border), color: editDivider === n ? cyan : muted }}>{n} cards</button>
            ))}
          </div>
        </div>
        <button disabled={!editName.trim() || saving} onClick={async () => {
          setSaving(true);
          const oldName = selectedBox.name;
          await updateBox(selectedBox.id, { name: editName.trim(), num_rows: editRows, divider_size: editDivider });
          // If name changed, update all cards in this box
          if (editName.trim() !== oldName) {
            const boxCards = cardsInBox(oldName);
            for (const c of boxCards) { await updateCard(c.id, { storage_box: editName.trim() }); }
          }
          setSelectedBox({ ...selectedBox, name: editName.trim(), num_rows: editRows, divider_size: editDivider });
          setSaving(false);
          setScreen("detail");
        }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", marginBottom: 12 }}>{saving ? "Saving..." : "Save Changes"}</button>

        {cardsInBox(selectedBox.name).length === 0 && (
          <button onClick={async () => { await deleteBox(selectedBox.id); setScreen("list"); }} style={{ width: "100%", ...btnStyle, background: red + "15", border: "1px solid " + red + "30", color: red }}>Delete Box</button>
        )}
        {cardsInBox(selectedBox.name).length > 0 && (
          <div style={{ fontSize: 11, color: muted, textAlign: "center", marginTop: 4 }}>Remove all cards to delete this box</div>
        )}
      </div>
    </Shell>
  );

  // ─── BOX DETAIL ───
  if (screen === "detail" && selectedBox) {
    const boxCards = cardsInBox(selectedBox.name).sort((a, b) => a.storage_position - b.storage_position);
    const totalValue = boxCards.reduce((s, c) => s + (c.raw_value || 0), 0);

    // Calculate row boundaries: positions are continuous
    // Row 1: positions 1 to (total/numRows), Row 2: continues, etc.
    const rowCards: Card[][] = [];
    if (selectedBox.num_rows === 1) {
      rowCards.push(boxCards);
    } else {
      // Split by storage_row field
      for (let r = 1; r <= selectedBox.num_rows; r++) {
        rowCards.push(boxCards.filter(c => c.storage_row === r));
      }
      // If no cards have row set, put all in row 1
      if (rowCards.every(r => r.length === 0) && boxCards.length > 0) {
        rowCards[0] = boxCards;
      }
    }

    // Build sections with dividers
    const renderSection = (sectionCards: Card[], dividerSize: number) => {
      const sections: { label: string; cards: Card[] }[] = [];
      let currentSection: Card[] = [];
      let currentStart = 0;

      for (const card of sectionCards) {
        const sectionIdx = Math.floor((card.storage_position - 1) / dividerSize);
        const sectionStart = sectionIdx * dividerSize + 1;
        if (sectionStart !== currentStart) {
          if (currentSection.length > 0) sections.push({ label: `${currentStart}–${currentStart + dividerSize - 1}`, cards: currentSection });
          currentSection = [];
          currentStart = sectionStart;
        }
        currentSection.push(card);
      }
      if (currentSection.length > 0) sections.push({ label: `${currentStart}–${currentStart + dividerSize - 1}`, cards: currentSection });
      return sections;
    };

    return (
      <Shell title={selectedBox.name} back={() => setScreen("list")}>
        <div style={{ paddingTop: 16 }}>
          {/* Summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 700, color: green }}>{boxCards.length} cards</div>
              <div style={{ fontSize: 12, color: muted }}>${totalValue.toFixed(2)} total value</div>
            </div>
            <button onClick={() => { setEditName(selectedBox.name); setEditRows(selectedBox.num_rows); setEditDivider(selectedBox.divider_size); setScreen("edit"); }} style={{ ...btnStyle, padding: "8px 16px", background: surface2, border: "1px solid " + border, color: muted, fontSize: 12 }}>Edit Box</button>
          </div>

          {boxCards.length === 0 && <div style={{ textAlign: "center", color: muted, fontSize: 13, padding: "40px 0" }}>No cards in this box yet. Assign cards from Card Detail.</div>}

          {/* Rows */}
          {rowCards.map((rCards, rowIdx) => {
            if (rCards.length === 0 && selectedBox.num_rows === 1) return null;
            const sections = renderSection(rCards, selectedBox.divider_size);
            return (
              <div key={rowIdx}>
                {selectedBox.num_rows > 1 && (
                  <div style={{ fontSize: 11, color: accent, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, marginBottom: 8, marginTop: rowIdx > 0 ? 20 : 0 }}>Row {rowIdx + 1}</div>
                )}
                {sections.map(section => (
                  <div key={section.label}>
                    <div style={{ fontSize: 10, color: cyan, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, padding: "8px 0 4px", borderBottom: "1px solid " + border, marginBottom: 4 }}>{section.label}</div>
                    {section.cards.map(card => (
                      <button key={card.id} onClick={() => onCardTap(card)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid " + border, background: "none", border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: border, cursor: "pointer", textAlign: "left" }}>
                        <span style={{ fontFamily: mono, fontSize: 11, color: muted, width: 32, textAlign: "right" }}>#{card.storage_position}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.player}</div>
                          <div style={{ fontSize: 10, color: muted }}>{card.year} {card.brand} {card.parallel !== "Base" ? card.parallel : ""}</div>
                        </div>
                        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: green }}>${card.raw_value}</span>
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
