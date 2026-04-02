"use client";
import { useState } from "react";
import { Card } from "@/lib/types";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, purple, muted, text, font, mono } from "./styles";

const amber = "#f59e0b";
const btnStyle = { padding: "12px 16px", minHeight: 48, border: "none", borderRadius: 12, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", minHeight: 44, color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" as const, width: "100%" };

function shippingMethod(price: number): { label: string; cost: number; instructions: string } {
  if (price >= 500) return { label: "Box + Insurance", cost: 12.00, instructions: "Cardboard box, bubble wrap, fragile sticker. Add insurance." };
  if (price >= 100) return { label: "BMWT + Insurance", cost: 7.00, instructions: "Bubble mailer with tracking and insurance. Top loader + team bag." };
  if (price >= 20) return { label: "BMWT", cost: 4.50, instructions: "Bubble mailer with tracking. Top loader + team bag + cardboard sandwich." };
  return { label: "PWE", cost: 1.05, instructions: "Plain white envelope. Top loader + team bag + painter's tape." };
}

type Screen = "list" | "picking" | "pack" | "done";

interface Props {
  cards: Card[];
  markShipped: (id: string, tracking?: string) => Promise<any>;
  updateCard: (id: string, updates: Partial<Card>) => Promise<any>;
  onBack: () => void;
}

export function PickList({ cards, markShipped, updateCard, onBack }: Props) {
  const needShipping = cards
    .filter(c => c.status === "sold" && !c.shipped_date)
    .sort((a, b) => (a.storage_box || "ZZZ").localeCompare(b.storage_box || "ZZZ") || (a.storage_row || 1) - (b.storage_row || 1) || (a.storage_position || 0) - (b.storage_position || 0));

  const [screen, setScreen] = useState<Screen>("list");
  const [pickIndex, setPickIndex] = useState(0);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [noPwe, setNoPwe] = useState<Set<string>>(new Set());
  const [shippedIds, setShippedIds] = useState<Set<string>>(new Set());

  const totalRevenue = needShipping.reduce((s, c) => s + (c.sold_price || 0), 0);
  const totalShipCost = needShipping.reduce((s, c) => s + shippingMethod(c.sold_price || 0).cost, 0);

  // Group by box
  const boxGroups: { box: string; cards: Card[] }[] = [];
  for (const card of needShipping) {
    const box = card.storage_box || "UNASSIGNED";
    const existing = boxGroups.find(g => g.box === box);
    if (existing) existing.cards.push(card);
    else boxGroups.push({ box, cards: [card] });
  }

  // ─── EMPTY STATE ───
  if (needShipping.length === 0) return (
    <Shell title="Pick & Ship" back={onBack}>
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: green }}>No cards to ship</div>
        <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>You're all caught up!</div>
      </div>
    </Shell>
  );

  // ─── LIST VIEW ───
  if (screen === "list") return (
    <Shell title="Pick & Ship" back={onBack}>
      <div style={{ paddingTop: 16 }}>
        {/* Summary */}
        <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
            <div><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: amber }}>{needShipping.length}</div><div style={{ fontSize: 9, color: muted }}>To Ship</div></div>
            <div><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: green }}>${totalRevenue.toFixed(0)}</div><div style={{ fontSize: 9, color: muted }}>Revenue</div></div>
            <div><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: red }}>${totalShipCost.toFixed(0)}</div><div style={{ fontSize: 9, color: muted }}>Ship Cost</div></div>
          </div>
        </div>

        <button onClick={() => { setPickIndex(0); setPickedIds(new Set()); setSkippedIds(new Set()); setScreen("picking"); }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", marginBottom: 16, fontSize: 16 }}>Start Picking</button>

        {/* Grouped by box */}
        {boxGroups.map(group => (
          <div key={group.box} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: accent, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>📦</span> {group.box}
            </div>
            {group.cards.map(card => {
              const ship = shippingMethod(card.sold_price || 0);
              return (
                <div key={card.id} style={{ background: surface, borderRadius: 10, padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: cyan, width: 36, textAlign: "center" }}>{card.storage_position || "?"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.player}</div>
                    <div style={{ fontSize: 11, color: muted }}>Sold: ${card.sold_price} on {card.sold_platform || "?"} · {card.sold_date}</div>
                    <div style={{ fontSize: 10, color: cyan, marginTop: 2 }}>{ship.label} (${ship.cost.toFixed(2)})</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Shell>
  );

  // ─── PICK MODE ───
  if (screen === "picking") {
    const current = needShipping[pickIndex];
    const prevBox = pickIndex > 0 ? needShipping[pickIndex - 1]?.storage_box : null;
    const boxChanged = current && prevBox && current.storage_box !== prevBox;
    const section = current ? Math.floor(((current.storage_position || 1) - 1) / 50) * 50 + 1 : 0;
    const sectionEnd = section + 49;

    if (!current) {
      // Done picking
      setScreen("pack");
      return null;
    }

    return (
      <Shell title="Picking" back={() => setScreen("list")}>
        <div style={{ paddingTop: 20, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>Pick {pickIndex + 1} of {needShipping.length}</div>

          {boxChanged && (
            <div style={{ background: amber + "15", border: "1px solid " + amber + "30", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: amber }}>Switch to box: {current.storage_box || "UNASSIGNED"}</div>
            </div>
          )}

          <div style={{ background: surface, borderRadius: 16, padding: "28px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: cyan, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>{current.storage_box || "UNASSIGNED"}</div>
            <div style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Section {section}–{sectionEnd}</div>
            <div style={{ fontFamily: mono, fontSize: 64, fontWeight: 700, color: accent, lineHeight: 1 }}>#{current.storage_position || "?"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: text, marginTop: 12 }}>{current.player}</div>
            <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{current.year} {current.brand} {current.set}</div>
            <div style={{ fontSize: 14, color: green, fontWeight: 600, marginTop: 8 }}>Sold: ${current.sold_price} on {current.sold_platform || "?"}</div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setPickedIds(prev => new Set(prev).add(current.id)); setPickIndex(pickIndex + 1); }} style={{ flex: 2, ...btnStyle, background: green, color: "#fff", fontSize: 18, padding: "20px" }}>GOT IT</button>
            <button onClick={() => { setSkippedIds(prev => new Set(prev).add(current.id)); setPickIndex(pickIndex + 1); }} style={{ flex: 1, ...btnStyle, background: surface2, border: "1px solid " + border, color: muted, fontSize: 14 }}>SKIP</button>
          </div>
        </div>
      </Shell>
    );
  }

  // ─── PACK & SHIP ───
  if (screen === "pack") {
    const picked = needShipping.filter(c => pickedIds.has(c.id));
    const skipped = needShipping.filter(c => skippedIds.has(c.id));
    const allShipped = picked.every(c => shippedIds.has(c.id));

    const handleMarkShipped = async (card: Card) => {
      const t = tracking[card.id] || "";
      const isPwe = noPwe.has(card.id);
      await markShipped(card.id, isPwe ? undefined : t || undefined);
      setShippedIds(prev => new Set(prev).add(card.id));
    };

    const handleMarkAllShipped = async () => {
      for (const card of picked) {
        if (shippedIds.has(card.id)) continue;
        const t = tracking[card.id] || "";
        const isPwe = noPwe.has(card.id);
        await markShipped(card.id, isPwe ? undefined : t || undefined);
        setShippedIds(prev => new Set(prev).add(card.id));
      }
    };

    const handleMarkLost = async (card: Card) => {
      await updateCard(card.id, { notes: (card.notes ? card.notes + " · " : "") + "LOST — not found during pick " + new Date().toISOString().slice(0, 10), status: "raw" as any });
    };

    // Delist platforms for a card
    const delistPlatforms = (card: Card): string[] => {
      const platforms: string[] = [];
      if (card.mercari_listed) platforms.push("Mercari");
      if (card.facebook_listed) platforms.push("Facebook");
      if (card.tcgplayer_listed) platforms.push("TCGPlayer");
      if (card.ebay_listing_id && card.sold_platform !== "eBay") platforms.push("eBay");
      if (card.shopify_product_id && card.sold_platform !== "Shopify") platforms.push("Shopify");
      return platforms;
    };

    if (allShipped && picked.length > 0) {
      return (
        <Shell title="All Shipped!" back={onBack}>
          <div style={{ paddingTop: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: green }}>{picked.length} cards shipped</div>
            <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>${picked.reduce((s, c) => s + (c.sold_price || 0), 0).toFixed(2)} total revenue</div>
            <button onClick={onBack} style={{ marginTop: 24, ...btnStyle, background: green, color: "#fff", padding: "14px 32px" }}>Done</button>
          </div>
        </Shell>
      );
    }

    return (
      <Shell title="Pack & Ship" back={() => setScreen("list")}>
        <div style={{ paddingTop: 16 }}>
          {/* Picked cards */}
          {picked.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Found ({picked.length})</div>
              {picked.map(card => {
                const ship = shippingMethod(card.sold_price || 0);
                const shipped = shippedIds.has(card.id);
                const delist = !shipped ? [] : delistPlatforms(card);
                return (
                  <div key={card.id} style={{ background: shipped ? green + "08" : surface, border: "1px solid " + (shipped ? green + "30" : border), borderRadius: 12, padding: "14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{card.player}</div>
                        <div style={{ fontSize: 11, color: muted }}>${card.sold_price} on {card.sold_platform} · {card.sold_date}</div>
                      </div>
                      {shipped && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: green + "15", color: green, fontWeight: 600 }}>SHIPPED</span>}
                    </div>

                    {!shipped && (
                      <>
                        <div style={{ background: surface2, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: cyan }}>{ship.label} (${ship.cost.toFixed(2)})</div>
                          <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>{ship.instructions}</div>
                        </div>

                        {ship.label !== "PWE" ? (
                          <input value={tracking[card.id] || ""} onChange={e => setTracking(prev => ({ ...prev, [card.id]: e.target.value }))} placeholder="Tracking number" style={{ ...inputStyle, marginBottom: 8, fontSize: 13 }} />
                        ) : (
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: muted, marginBottom: 8, cursor: "pointer" }}>
                            <input type="checkbox" checked={noPwe.has(card.id)} onChange={() => setNoPwe(prev => { const n = new Set(prev); n.has(card.id) ? n.delete(card.id) : n.add(card.id); return n; })} />
                            No tracking (PWE)
                          </label>
                        )}

                        <button onClick={() => handleMarkShipped(card)} disabled={ship.label !== "PWE" && !tracking[card.id] && !noPwe.has(card.id)} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", fontSize: 13, padding: "10px", opacity: (ship.label === "PWE" || tracking[card.id] || noPwe.has(card.id)) ? 1 : 0.4 }}>Mark Shipped</button>
                      </>
                    )}

                    {shipped && delist.length > 0 && (
                      <div style={{ background: amber + "10", borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: amber }}>Also listed on: {delist.join(", ")}</div>
                        <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Delist from these platforms</div>
                      </div>
                    )}
                  </div>
                );
              })}

              {picked.some(c => !shippedIds.has(c.id)) && (
                <button onClick={handleMarkAllShipped} style={{ width: "100%", ...btnStyle, background: green + "15", border: "1px solid " + green + "30", color: green, marginTop: 8 }}>Mark All Shipped</button>
              )}
            </div>
          )}

          {/* Skipped cards */}
          {skipped.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: red, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{skipped.length} card{skipped.length > 1 ? "s" : ""} not found</div>
              {skipped.map(card => (
                <div key={card.id} style={{ background: red + "08", border: "1px solid " + red + "20", borderRadius: 12, padding: "12px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{card.player}</div>
                    <div style={{ fontSize: 11, color: muted }}>{card.storage_box} #{card.storage_position} · ${card.sold_price}</div>
                  </div>
                  <button onClick={() => handleMarkLost(card)} style={{ padding: "6px 12px", background: red + "15", border: "1px solid " + red + "30", borderRadius: 8, color: red, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Mark Lost</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  return null;
}
