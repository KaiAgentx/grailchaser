"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Card } from "@/lib/types";
import { Shell } from "./shell/Shell";
import { TierBadge } from "./TierBadge";
import { surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "./styles";

interface Props {
  cards: Card[];
  onBack: () => void;
  onCardTap: (card: Card) => void;
  updateCardPrice: (id: string, row: Card) => void;
}

export function WatchlistView({ cards, onBack, onCardTap, updateCardPrice }: Props) {
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const handleRefreshAll = async () => {
    if (bulkRefreshing || cards.length === 0) return;
    setBulkRefreshing(true);
    setBulkResult(null);

    const sb = createClient();
    const { data: session } = await sb.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) { setBulkResult("Not authenticated"); setBulkRefreshing(false); return; }

    let refreshed = 0, unchanged = 0, noPrice = 0, skipped = 0, errors = 0;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      setBulkProgress({ current: i + 1, total: cards.length, name: card.player });
      try {
        const r = await fetch(`/api/tcg/cards/${card.id}/refresh-price`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json().catch(() => ({}));
        if (r.status === 429 || data.outcome === "rate_limited") { skipped++; }
        else if (data.outcome === "refreshed") {
          updateCardPrice(card.id, data.card);
          if (data.before?.raw_value === data.after?.raw_value) { unchanged++; } else { refreshed++; }
        } else if (data.outcome === "not_found") { noPrice++; }
        else { errors++; }
      } catch { errors++; }
      if (i < cards.length - 1) await new Promise(res => setTimeout(res, 200));
    }

    setBulkProgress(null);
    setBulkResult(
      `Refreshed ${refreshed} · Unchanged ${unchanged}` +
      (noPrice > 0 ? ` · No price ${noPrice}` : "") +
      (skipped > 0 ? ` · Skipped ${skipped}` : "") +
      (errors > 0 ? ` · Errors ${errors}` : "")
    );
    setBulkRefreshing(false);
    setTimeout(() => setBulkResult(null), 10000);
  };

  return (
    <Shell title="Watchlist" back={onBack}>
      <div style={{ paddingTop: 16 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: muted }}>{cards.length}/10 watched</div>
          <button
            onClick={handleRefreshAll}
            disabled={bulkRefreshing || cards.length === 0}
            style={{ padding: "8px 14px", minHeight: 36, border: "none", borderRadius: 10, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: bulkRefreshing ? "wait" : "pointer", background: accent + "15", color: cards.length === 0 ? muted : accent, borderColor: accent + "30" }}
          >
            {bulkRefreshing ? "Refreshing…" : `Refresh all (${cards.length})`}
          </button>
        </div>

        {bulkProgress && <div style={{ fontSize: 11, color: muted, marginBottom: 8 }}>Refreshing {bulkProgress.current} of {bulkProgress.total}: {bulkProgress.name}</div>}
        {bulkResult && <div style={{ fontSize: 11, color: accent, marginBottom: 8 }}>{bulkResult}</div>}

        {/* Empty state */}
        {cards.length === 0 && (
          <div style={{ textAlign: "center", color: muted, padding: "60px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>☆</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 6 }}>No cards on your watchlist yet</div>
            <div style={{ fontSize: 13 }}>Tap the ☆ star on any card to add it.</div>
          </div>
        )}

        {/* Card list */}
        {cards.map(card => (
          <button key={card.id} onClick={() => onCardTap(card)} style={{ width: "100%", background: surface, borderLeft: "3px solid " + accent, borderTop: "none", borderRight: "none", borderBottom: "none", borderRadius: 12, padding: "14px 16px", marginBottom: 6, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: text }}>{card.player}</div>
              <div style={{ fontSize: 12, color: secondary, marginTop: 2 }}>{card.year} {card.brand} {card.card_number}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                <TierBadge tier={card.tier} size="sm" />
                {card.storage_box && card.storage_box !== "PENDING" && <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 9999, background: "rgba(255,255,255,0.06)", color: muted }}>{card.storage_box}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 600, color: green }}>${card.raw_value}</div>
              <div style={{ fontSize: 10, color: "#d4a017", marginTop: 2 }}>★</div>
            </div>
          </button>
        ))}
      </div>
    </Shell>
  );
}
