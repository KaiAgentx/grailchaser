"use client";
import { useState } from "react";
import { Card } from "@/lib/types";
import { Box } from "@/hooks/useBoxes";
import { TierBadge } from "./atoms/TierBadge";
import { Shell } from "./shell/Shell";
import { TIER_RANK, TIER_COLORS, type Tier } from "@/lib/utils";
import { surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "./styles";

const TIER_ORDER: Tier[] = ["High", "Mid", "Low", "Bulk", "Unpriced"];

interface Props {
  cards: Card[];
  boxes: Box[];
  scopeLabel: string;
  onBack: () => void;
  onCardTap: (card: Card) => void;
  updateCard: (id: string, updates: Partial<Card>) => Promise<any>;
}

export function TierBreakdownView({ cards, boxes, scopeLabel, onBack, onCardTap, updateCard }: Props) {
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState(boxes[0]?.name || "PENDING");
  const [moving, setMoving] = useState(false);
  const [moveProgress, setMoveProgress] = useState<{ done: number; total: number } | null>(null);
  const [moveResult, setMoveResult] = useState<string | null>(null);

  // Count per tier
  const tierCounts: Record<Tier, number> = { High: 0, Mid: 0, Low: 0, Bulk: 0, Unpriced: 0 };
  cards.forEach(c => {
    const t = (c.tier && c.tier in tierCounts ? c.tier : "Unpriced") as Tier;
    tierCounts[t]++;
  });

  // Filter
  const filteredCards = selectedTier
    ? cards.filter(c => (c.tier || "Unpriced") === selectedTier)
    : cards;

  // Group by tier for "show all" mode
  const grouped = selectedTier ? null : TIER_ORDER
    .map(t => ({ tier: t, cards: cards.filter(c => (c.tier || "Unpriced") === t) }))
    .filter(g => g.cards.length > 0);

  const toggleCard = (id: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const ids = new Set(selectedCardIds);
    filteredCards.forEach(c => ids.add(c.id));
    setSelectedCardIds(ids);
  };

  const deselectAll = () => setSelectedCardIds(new Set());

  const handleMove = async () => {
    if (selectedCardIds.size === 0 || !moveTarget || moving) return;
    setMoving(true);
    setMoveProgress({ done: 0, total: selectedCardIds.size });
    setMoveResult(null);

    let succeeded = 0, failed = 0;
    const ids = Array.from(selectedCardIds);
    for (let i = 0; i < ids.length; i++) {
      try {
        await updateCard(ids[i], { storage_box: moveTarget } as any);
        succeeded++;
      } catch { failed++; }
      setMoveProgress({ done: i + 1, total: ids.length });
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 100));
    }

    setMoveProgress(null);
    setSelectedCardIds(new Set());
    setMoveResult(
      failed > 0
        ? `Moved ${succeeded} · Failed ${failed}`
        : `Moved ${succeeded} cards to ${moveTarget}`
    );
    setMoving(false);
    setTimeout(() => setMoveResult(null), 8000);
  };

  const renderCardTile = (card: Card) => {
    const isSelected = selectedCardIds.has(card.id);
    return (
      <div key={card.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid " + border }}>
        {/* Checkbox */}
        <button onClick={() => toggleCard(card.id)} style={{ width: 28, height: 28, flexShrink: 0, background: isSelected ? accent : "transparent", border: isSelected ? "2px solid " + accent : "2px solid " + border, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: isSelected ? "#0a0a12" : "transparent", fontSize: 14, fontWeight: 700 }}>
          {isSelected ? "✓" : ""}
        </button>
        {/* Card info (tappable → detail) */}
        <button onClick={() => onCardTap(card)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.player}</div>
          <div style={{ fontSize: 11, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.year} {card.brand} {card.card_number}</div>
        </button>
        {/* Price */}
        <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: green, flexShrink: 0 }}>${card.raw_value}</div>
      </div>
    );
  };

  return (
    <Shell title={`Tier Breakdown`} back={onBack}>
      <div style={{ paddingTop: 16, paddingBottom: selectedCardIds.size > 0 ? 120 : 20 }}>
        {/* Scope label */}
        <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>{scopeLabel}</div>

        {/* Tier pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {TIER_ORDER.map(t => {
            const count = tierCounts[t];
            const isActive = selectedTier === t;
            const color = TIER_COLORS[t];
            return (
              <button key={t} onClick={() => setSelectedTier(isActive ? null : t)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 20,
                background: isActive ? color + "20" : surface2,
                border: "1px solid " + (isActive ? color + "50" : border),
                color: isActive ? color : muted,
                fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
                <TierBadge tier={t} size="sm" />
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Select controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: muted }}>{filteredCards.length} cards{selectedTier ? ` in ${selectedTier}` : ""}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={selectAllVisible} style={{ background: "none", border: "none", color: accent, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>Select all</button>
            {selectedCardIds.size > 0 && <button onClick={deselectAll} style={{ background: "none", border: "none", color: muted, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>Clear</button>}
          </div>
        </div>

        {moveResult && <div style={{ fontSize: 11, color: accent, marginBottom: 8 }}>{moveResult}</div>}

        {/* Card list */}
        {grouped ? (
          // Show all mode — grouped by tier
          grouped.map(g => (
            <div key={g.tier} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <TierBadge tier={g.tier} size="sm" />
                <span style={{ fontSize: 11, color: muted }}>{g.cards.length} cards</span>
              </div>
              {g.cards.map(renderCardTile)}
            </div>
          ))
        ) : (
          // Filtered mode
          filteredCards.map(renderCardTile)
        )}

        {filteredCards.length === 0 && (
          <div style={{ textAlign: "center", color: muted, padding: "40px 0", fontSize: 13 }}>No cards in this tier</div>
        )}
      </div>

      {/* Bottom action bar */}
      {selectedCardIds.size > 0 && (
        <div style={{ position: "fixed", bottom: 56, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: 500, width: "100%", background: "rgba(8,9,13,0.95)", backdropFilter: "blur(16px)", borderTop: "1px solid " + border, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: text, fontWeight: 600, flexShrink: 0 }}>{selectedCardIds.size} selected</span>
            <select value={moveTarget} onChange={e => setMoveTarget(e.target.value)} style={{ flex: 1, background: surface2, border: "1px solid " + border, borderRadius: 8, padding: "8px", color: text, fontFamily: font, fontSize: 12, outline: "none" }}>
              {boxes.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              <option value="PENDING">PENDING</option>
            </select>
            <button onClick={handleMove} disabled={moving} style={{ padding: "8px 16px", minHeight: 40, background: green, border: "none", borderRadius: 10, color: "#0a0a12", fontFamily: font, fontSize: 13, fontWeight: 700, cursor: moving ? "wait" : "pointer", flexShrink: 0 }}>
              {moving && moveProgress ? `${moveProgress.done}/${moveProgress.total}` : "Move"}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
