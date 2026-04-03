"use client";
import { useState, useMemo } from "react";
import { Card } from "@/lib/types";
import { Box } from "@/hooks/useBoxes";
import { Lot } from "@/hooks/useLots";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, purple, muted, text, font, mono } from "./styles";

const amber = "#f59e0b";
const btnStyle = { padding: "12px 16px", minHeight: 48, border: "none", borderRadius: 12, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", minHeight: 44, color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" as const, width: "100%" };
const labelStyle = { fontSize: 10, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 4 };
const pl = (n: number) => n === 1 ? "card" : "cards";

function shipCost(count: number) { return count > 400 ? 22 : count > 200 ? 19 : count > 100 ? 14 : count > 50 ? 9 : 5; }

function generateTitle(selected: Card[]): string {
  const sports = [...new Set(selected.map(c => c.sport))];
  const brands = [...new Set(selected.map(c => c.brand).filter(Boolean))].slice(0, 3);
  const years = selected.map(c => c.year).filter(Boolean);
  const minY = years.length ? Math.min(...years) : 0;
  const maxY = years.length ? Math.max(...years) : 0;
  const sportLabel = sports.length === 1 ? sports[0] : "Sports Card";
  const yearRange = minY && maxY ? (minY === maxY ? `${minY}` : `${minY}-${maxY}`) : "";
  const title = `${selected.length} Card ${sportLabel} Lot — ${brands.join(" ")} ${yearRange}`.trim();
  return title.length > 80 ? title.substring(0, 77) + "..." : title;
}

function generateDesc(selected: Card[]): string {
  const sports = [...new Set(selected.map(c => c.sport))];
  const brands = [...new Set(selected.map(c => c.brand).filter(Boolean))].slice(0, 5);
  const years = selected.map(c => c.year).filter(Boolean);
  const minY = years.length ? Math.min(...years) : 0;
  const maxY = years.length ? Math.max(...years) : 0;
  const top5 = [...selected].sort((a, b) => b.raw_value - a.raw_value).slice(0, 5).map(c => c.player + (c.is_rc ? " RC" : ""));
  const lines = [
    `${selected.length} ${sports.length === 1 ? sports[0].toLowerCase() : "sports"} cards${minY && maxY ? ` from ${minY}-${maxY}` : ""}.`,
    brands.length ? `Brands include ${brands.join(", ")}.` : "",
    top5.length ? `Notable cards: ${top5.join(", ")}.` : "",
    "All cards are raw/ungraded. Ships in a secure box with padding.",
  ];
  return lines.filter(Boolean).join(" ");
}

type Screen = "manager" | "create" | "pricing" | "saved";

interface Props {
  cards: Card[];
  boxes: Box[];
  lots: Lot[];
  boxName?: string;
  createLot: (title: string, description: string, sourceBox: string, cardIds: string[], askingPrice: number, totalRawValue: number, totalCostBasis: number) => Promise<any>;
  updateLot: (id: string, updates: Partial<Lot>) => Promise<any>;
  deleteLot: (id: string) => Promise<any>;
  markLotListed: (id: string, platform: string, askingPrice: number) => Promise<any>;
  markLotSold: (id: string, soldPrice: number, platform: string) => Promise<any>;
  markLotShipped: (id: string, shippingCost: number, trackingNumber: string) => Promise<any>;
  fetchLots: () => Promise<void>;
  fetchCards: () => Promise<void>;
  onNavigate: (target: { screen: string }) => void;
}

export function LotBuilder({ cards, boxes, lots, boxName, createLot, updateLot, deleteLot, markLotListed, markLotSold, markLotShipped, fetchLots, fetchCards, onNavigate }: Props) {
  const [screen, setScreen] = useState<Screen>(boxName ? "create" : "manager");
  const [sourceBox, setSourceBox] = useState(boxName || "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"range" | "filter" | "sport">("range");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(100);
  const [filterSports, setFilterSports] = useState<Set<string>>(new Set());
  const [filterTiers, setFilterTiers] = useState<Set<string>>(new Set());
  const [lotTitle, setLotTitle] = useState("");
  const [lotDesc, setLotDesc] = useState("");
  const [askingPrice, setAskingPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedLot, setSavedLot] = useState<Lot | null>(null);

  // Manager action state
  const [actionLotId, setActionLotId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<string | null>(null);
  const [actionPlatform, setActionPlatform] = useState("eBay");
  const [actionPrice, setActionPrice] = useState(0);
  const [actionTracking, setActionTracking] = useState("");
  const [actionShipCost, setActionShipCost] = useState(0);

  // Available cards in selected box
  const available = useMemo(() => sourceBox ? cards.filter(c => c.storage_box === sourceBox && !c.lot_id && ["raw", "listed"].includes(c.status)).sort((a, b) => (a.storage_position || 0) - (b.storage_position || 0)) : [], [cards, sourceBox]);
  const inLots = useMemo(() => sourceBox ? cards.filter(c => c.storage_box === sourceBox && c.lot_id).length : 0, [cards, sourceBox]);

  // Computed selections
  const rangeCards = useMemo(() => available.filter(c => (c.storage_position || 0) >= rangeStart && (c.storage_position || 0) <= rangeEnd), [available, rangeStart, rangeEnd]);

  const filterCards = useMemo(() => available.filter(c => {
    if (filterSports.size > 0 && !filterSports.has(c.sport)) return false;
    if (filterTiers.size > 0 && !filterTiers.has(c.tier)) return false;
    return true;
  }), [available, filterSports, filterTiers]);

  const sportGroups = useMemo(() => {
    const groups: Record<string, Card[]> = {};
    available.forEach(c => { if (!groups[c.sport]) groups[c.sport] = []; groups[c.sport].push(c); });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [available]);

  const selected = useMemo(() => cards.filter(c => selectedIds.includes(c.id)), [cards, selectedIds]);
  const totalRaw = selected.reduce((s, c) => s + (c.raw_value || 0), 0);
  const totalCost = selected.reduce((s, c) => s + (c.cost_basis || 0), 0);

  // Pricing tiers
  const calcTier = (multiplier: number) => {
    const price = +(totalRaw * multiplier).toFixed(2);
    const fees = +(price * 0.1325).toFixed(2);
    const ship = shipCost(selected.length);
    const profit = +(price - fees - ship - totalCost).toFixed(2);
    const roi = totalCost > 0 ? +((profit / totalCost) * 100).toFixed(0) : 0;
    return { price, fees, ship, profit, roi, perCard: +(price / (selected.length || 1)).toFixed(2) };
  };

  // ─── LOT MANAGER ───
  if (screen === "manager") {
    const drafts = lots.filter(l => l.status === "draft");
    const listed = lots.filter(l => l.status === "listed");
    const sold = lots.filter(l => l.status === "sold");
    const shipped = lots.filter(l => l.status === "shipped");
    const platforms = ["eBay", "Mercari", "Facebook", "Whatnot"];

    const LotAction = ({ lot }: { lot: Lot }) => {
      const isActive = actionLotId === lot.id;
      return (
        <div>
          {isActive && actionType === "list" && (
            <div style={{ background: surface2, borderRadius: 10, padding: 12, marginTop: 8 }}>
              <div style={labelStyle}>Platform</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                {platforms.map(p => <button key={p} onClick={() => setActionPlatform(p)} style={{ padding: "6px 10px", background: actionPlatform === p ? green + "20" : surface, border: "1px solid " + (actionPlatform === p ? green + "50" : border), borderRadius: 8, color: actionPlatform === p ? green : muted, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{p}</button>)}
              </div>
              <div style={labelStyle}>Asking Price ($)</div>
              <input type="text" inputMode="decimal" value={actionPrice || ""} onChange={e => setActionPrice(+e.target.value || 0)} style={{ ...inputStyle, marginBottom: 8 }} />
              <button onClick={async () => { await markLotListed(lot.id, actionPlatform, actionPrice); await fetchLots(); setActionLotId(null); }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", fontSize: 13, padding: "10px" }}>Confirm Listing</button>
            </div>
          )}
          {isActive && actionType === "sold" && (
            <div style={{ background: surface2, borderRadius: 10, padding: 12, marginTop: 8 }}>
              <div style={labelStyle}>Sold Price ($)</div>
              <input type="text" inputMode="decimal" value={actionPrice || ""} onChange={e => setActionPrice(+e.target.value || 0)} style={{ ...inputStyle, marginBottom: 8 }} />
              <button onClick={async () => { await markLotSold(lot.id, actionPrice, lot.platform || "eBay"); await fetchLots(); await fetchCards(); setActionLotId(null); }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", fontSize: 13, padding: "10px" }}>Confirm Sale</button>
            </div>
          )}
          {isActive && actionType === "ship" && (
            <div style={{ background: surface2, borderRadius: 10, padding: 12, marginTop: 8 }}>
              <div style={labelStyle}>Shipping Cost ($)</div>
              <input type="text" inputMode="decimal" value={actionShipCost || ""} onChange={e => setActionShipCost(+e.target.value || 0)} style={{ ...inputStyle, marginBottom: 8 }} />
              <div style={labelStyle}>Tracking Number</div>
              <input value={actionTracking} onChange={e => setActionTracking(e.target.value)} placeholder="Optional" style={{ ...inputStyle, marginBottom: 8 }} />
              <button onClick={async () => { await markLotShipped(lot.id, actionShipCost, actionTracking); await fetchLots(); await fetchCards(); setActionLotId(null); }} style={{ width: "100%", ...btnStyle, background: cyan, color: "#fff", fontSize: 13, padding: "10px" }}>Confirm Shipped</button>
            </div>
          )}
        </div>
      );
    };

    return (
      <Shell title="Lot Builder" back={() => onNavigate({ screen: "home" })}>
        <div style={{ paddingTop: 16 }}>
          {lots.length === 0 && <div style={{ textAlign: "center", color: muted, fontSize: 13, padding: "40px 0" }}>No lots yet. Create your first lot from a box of cards.</div>}

          {[{ label: "Drafts", items: drafts, color: muted }, { label: "Listed", items: listed, color: cyan }, { label: "Sold", items: sold, color: amber }, { label: "Shipped", items: shipped, color: green }].map(group => group.items.length === 0 ? null : (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: group.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{group.label} ({group.items.length})</div>
              {group.items.map(lot => {
                const profit = lot.status === "shipped" ? +((lot.sold_price || 0) - (lot.sold_price || 0) * 0.1325 - (lot.shipping_cost || 0) - lot.total_cost_basis).toFixed(2) : 0;
                return (
                  <div key={lot.id} style={{ background: surface, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{lot.title}</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                      {lot.card_count} {pl(lot.card_count)} · ${lot.total_raw_value.toFixed(0)} value
                      {lot.asking_price ? ` · $${lot.asking_price} asking` : ""}
                      {lot.platform ? ` · ${lot.platform}` : ""}
                      {lot.sold_price ? ` · Sold $${lot.sold_price}` : ""}
                    </div>
                    {lot.status === "shipped" && <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: profit >= 0 ? green : red, marginTop: 4 }}>Profit: {profit >= 0 ? "+" : ""}${profit}</div>}

                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {lot.status === "draft" && <>
                        <button onClick={() => { setActionLotId(lot.id); setActionType("list"); setActionPrice(lot.asking_price || 0); }} style={{ ...btnStyle, flex: 1, padding: "8px", background: green + "15", border: "1px solid " + green + "30", color: green, fontSize: 11 }}>List</button>
                        <button onClick={async () => { await deleteLot(lot.id); await fetchLots(); await fetchCards(); }} style={{ ...btnStyle, padding: "8px 10px", background: red + "15", border: "1px solid " + red + "30", color: red, fontSize: 11 }}>Delete</button>
                      </>}
                      {lot.status === "listed" && <>
                        <button onClick={() => { setActionLotId(lot.id); setActionType("sold"); setActionPrice(lot.asking_price || 0); }} style={{ ...btnStyle, flex: 1, padding: "8px", background: green + "15", border: "1px solid " + green + "30", color: green, fontSize: 11 }}>Mark Sold</button>
                        <button onClick={async () => { await updateLot(lot.id, { status: "draft", platform: null, listed_date: null } as any); await fetchLots(); }} style={{ ...btnStyle, padding: "8px 10px", background: surface2, border: "1px solid " + border, color: muted, fontSize: 11 }}>Delist</button>
                      </>}
                      {lot.status === "sold" && <button onClick={() => { setActionLotId(lot.id); setActionType("ship"); setActionShipCost(shipCost(lot.card_count)); }} style={{ ...btnStyle, flex: 1, padding: "8px", background: cyan + "15", border: "1px solid " + cyan + "30", color: cyan, fontSize: 11 }}>Mark Shipped</button>}
                    </div>
                    <LotAction lot={lot} />
                  </div>
                );
              })}
            </div>
          ))}

          <button onClick={() => { setSourceBox(boxName || ""); setSelectedIds([]); setScreen("create"); }} style={{ width: "100%", ...btnStyle, background: green + "15", border: "1px solid " + green + "30", color: green, marginTop: 8 }}>+ Create New Lot</button>
        </div>
      </Shell>
    );
  }

  // ─── CREATE LOT ───
  if (screen === "create") {
    return (
      <Shell title="Create Lot" back={() => setScreen("manager")}>
        <div style={{ paddingTop: 16 }}>
          {/* Source box */}
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Source Box</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {boxes.map(b => <button key={b.id} onClick={() => setSourceBox(b.name)} style={{ ...btnStyle, padding: "8px 12px", background: sourceBox === b.name ? cyan + "20" : surface2, border: "1px solid " + (sourceBox === b.name ? cyan + "50" : border), color: sourceBox === b.name ? cyan : muted, fontSize: 12 }}>{b.name} ({b.card_count})</button>)}
            </div>
            {sourceBox && <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>{available.length} available · {inLots} already in lots</div>}
          </div>

          {sourceBox && available.length > 0 && (
            <>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {([["range", "By Range"], ["filter", "By Filter"], ["sport", "Sport Split"]] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setTab(key)} style={{ flex: 1, ...btnStyle, padding: "8px", background: tab === key ? cyan + "20" : surface2, border: "1px solid " + (tab === key ? cyan + "50" : border), color: tab === key ? cyan : muted, fontSize: 12 }}>{label}</button>
                ))}
              </div>

              {/* Tab A: Range */}
              {tab === "range" && (
                <div style={{ background: surface, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}><div style={labelStyle}>Start</div><input type="text" inputMode="numeric" value={rangeStart} onChange={e => setRangeStart(+e.target.value || 1)} style={inputStyle} /></div>
                    <div style={{ flex: 1 }}><div style={labelStyle}>End</div><input type="text" inputMode="numeric" value={rangeEnd} onChange={e => setRangeEnd(+e.target.value || 100)} style={inputStyle} /></div>
                  </div>
                  <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Positions {rangeStart}-{rangeEnd}: {rangeCards.length} {pl(rangeCards.length)}, ${rangeCards.reduce((s, c) => s + (c.raw_value || 0), 0).toFixed(0)} value</div>
                  <button onClick={() => { setRangeStart(1); setRangeEnd(Math.max(...available.map(c => c.storage_position || 0))); }} style={{ fontSize: 11, color: cyan, background: "none", border: "none", cursor: "pointer", fontFamily: font, padding: 0, marginBottom: 8 }}>Select All Available</button>
                  <button disabled={rangeCards.length === 0} onClick={() => { setSelectedIds(rangeCards.map(c => c.id)); setLotTitle(generateTitle(rangeCards)); setLotDesc(generateDesc(rangeCards)); setAskingPrice(+(rangeCards.reduce((s, c) => s + (c.raw_value || 0), 0) * 0.6).toFixed(0)); setScreen("pricing"); }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", opacity: rangeCards.length > 0 ? 1 : 0.4 }}>Create Lot ({rangeCards.length} {pl(rangeCards.length)})</button>
                </div>
              )}

              {/* Tab B: Filter */}
              {tab === "filter" && (
                <div style={{ background: surface, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <div style={labelStyle}>Sport</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {sportGroups.map(([sport, cards]) => { const sel = filterSports.has(sport); return <button key={sport} onClick={() => setFilterSports(prev => { const n = new Set(prev); n.has(sport) ? n.delete(sport) : n.add(sport); return n; })} style={{ ...btnStyle, padding: "6px 10px", background: sel ? cyan + "20" : surface2, border: "1px solid " + (sel ? cyan + "50" : border), color: sel ? cyan : muted, fontSize: 11 }}>{sport} ({cards.length})</button>; })}
                  </div>
                  <div style={labelStyle}>Tier</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {["Gem", "Star", "Core", "Bulk"].map(t => { const sel = filterTiers.has(t); return <button key={t} onClick={() => setFilterTiers(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; })} style={{ ...btnStyle, padding: "6px 10px", background: sel ? accent + "20" : surface2, border: "1px solid " + (sel ? accent + "50" : border), color: sel ? accent : muted, fontSize: 11 }}>{t}</button>; })}
                  </div>
                  <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>{filterCards.length} {pl(filterCards.length)} match — ${filterCards.reduce((s, c) => s + (c.raw_value || 0), 0).toFixed(0)} value</div>
                  <button disabled={filterCards.length === 0} onClick={() => { setSelectedIds(filterCards.map(c => c.id)); setLotTitle(generateTitle(filterCards)); setLotDesc(generateDesc(filterCards)); setAskingPrice(+(filterCards.reduce((s, c) => s + (c.raw_value || 0), 0) * 0.6).toFixed(0)); setScreen("pricing"); }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", opacity: filterCards.length > 0 ? 1 : 0.4 }}>Create Lot ({filterCards.length} {pl(filterCards.length)})</button>
                </div>
              )}

              {/* Tab C: Sport Split */}
              {tab === "sport" && (
                <div style={{ background: surface, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  {sportGroups.map(([sport, sportCards]) => (
                    <div key={sport} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + border }}>
                      <div><span style={{ fontSize: 13, fontWeight: 600, color: text }}>{sport}</span><span style={{ fontSize: 11, color: muted, marginLeft: 6 }}>{sportCards.length} {pl(sportCards.length)}, ${sportCards.reduce((s, c) => s + (c.raw_value || 0), 0).toFixed(0)}</span></div>
                      <button onClick={() => { setSelectedIds(sportCards.map(c => c.id)); setLotTitle(generateTitle(sportCards)); setLotDesc(generateDesc(sportCards)); setAskingPrice(+(sportCards.reduce((s, c) => s + (c.raw_value || 0), 0) * 0.6).toFixed(0)); setScreen("pricing"); }} style={{ ...btnStyle, padding: "6px 12px", background: green + "15", border: "1px solid " + green + "30", color: green, fontSize: 11 }}>Create Lot</button>
                    </div>
                  ))}
                  {sportGroups.length > 1 && (
                    <button onClick={async () => {
                      setSaving(true);
                      for (const [, sportCards] of sportGroups) {
                        const title = generateTitle(sportCards);
                        const desc = generateDesc(sportCards);
                        const rv = sportCards.reduce((s, c) => s + (c.raw_value || 0), 0);
                        const cb = sportCards.reduce((s, c) => s + (c.cost_basis || 0), 0);
                        await createLot(title, desc, sourceBox, sportCards.map(c => c.id), +(rv * 0.6).toFixed(0), rv, cb);
                      }
                      await fetchLots(); await fetchCards(); setSaving(false); setScreen("manager");
                    }} disabled={saving} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", marginTop: 10 }}>{saving ? "Creating..." : `Create All ${sportGroups.length} Lots`}</button>
                  )}
                </div>
              )}
            </>
          )}
          {sourceBox && available.length === 0 && <div style={{ textAlign: "center", color: muted, fontSize: 13, padding: "20px 0" }}>No available cards in {sourceBox}</div>}
        </div>
      </Shell>
    );
  }

  // ─── PRICING ───
  if (screen === "pricing") {
    const tiers = [
      { label: "Conservative", mult: 0.40, color: green, desc: "Quick sale" },
      { label: "Moderate", mult: 0.60, color: cyan, desc: "Fair value" },
      { label: "Aggressive", mult: 0.80, color: accent, desc: "Hold for value" },
    ];
    const customTier = (() => {
      const price = askingPrice;
      const fees = +(price * 0.1325).toFixed(2);
      const ship = shipCost(selected.length);
      const profit = +(price - fees - ship - totalCost).toFixed(2);
      const roi = totalCost > 0 ? +((profit / totalCost) * 100).toFixed(0) : 0;
      return { price, fees, ship, profit, roi };
    })();

    return (
      <Shell title="Lot Pricing" back={() => setScreen("create")}>
        <div style={{ paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div><div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: green }}>{selected.length} {pl(selected.length)}</div><div style={{ fontSize: 11, color: muted }}>${totalRaw.toFixed(0)} raw value · ${totalCost.toFixed(0)} cost</div></div>
          </div>

          {/* Title & Description */}
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Title (max 80 chars)</div>
            <input value={lotTitle} onChange={e => setLotTitle(e.target.value.substring(0, 80))} style={inputStyle} />
            <div style={{ fontSize: 10, color: muted, textAlign: "right" }}>{lotTitle.length}/80</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Description</div>
            <textarea value={lotDesc} onChange={e => setLotDesc(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {/* Pricing tiers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            {tiers.map(t => {
              const tier = calcTier(t.mult);
              return (
                <button key={t.label} onClick={() => setAskingPrice(tier.price)} style={{ background: surface, border: "1px solid " + (askingPrice === tier.price ? t.color + "50" : border), borderRadius: 10, padding: 10, cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: t.color, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: text, marginTop: 2 }}>${tier.price}</div>
                  <div style={{ fontSize: 9, color: muted }}>${tier.perCard}/card</div>
                  <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: tier.profit >= 0 ? green : red, marginTop: 4 }}>{tier.profit >= 0 ? "+" : ""}${tier.profit}</div>
                </button>
              );
            })}
          </div>

          {/* Custom price */}
          <div style={{ background: surface, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={labelStyle}>Your Price ($)</div>
            <input type="text" inputMode="decimal" value={askingPrice || ""} onChange={e => setAskingPrice(+e.target.value || 0)} style={{ ...inputStyle, fontFamily: mono, fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 8 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: muted }}>
              <span>Fees: ${customTier.fees}</span>
              <span>Ship: ${customTier.ship}</span>
              <span>Cost: ${totalCost.toFixed(0)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Net Profit</span>
              <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: customTier.profit >= 0 ? green : red }}>{customTier.profit >= 0 ? "+" : ""}${customTier.profit}{customTier.roi ? ` (${customTier.roi}%)` : ""}</span>
            </div>
          </div>

          <button disabled={saving || !lotTitle || !askingPrice} onClick={async () => {
            setSaving(true);
            const { data, error } = await createLot(lotTitle, lotDesc, sourceBox, selectedIds, askingPrice, totalRaw, totalCost);
            await fetchLots(); await fetchCards(); setSaving(false);
            if (!error && data) { setSavedLot(data); setScreen("saved"); }
          }} style={{ width: "100%", ...btnStyle, background: green, color: "#fff", fontSize: 16, opacity: lotTitle && askingPrice ? 1 : 0.4 }}>{saving ? "Saving..." : "Save as Draft"}</button>
        </div>
      </Shell>
    );
  }

  // ─── SAVED ───
  if (screen === "saved" && savedLot) {
    const profit = +(savedLot.asking_price! - savedLot.asking_price! * 0.1325 - shipCost(savedLot.card_count) - savedLot.total_cost_basis).toFixed(2);
    return (
      <Shell title="Lot Created!" back={() => setScreen("manager")}>
        <div style={{ paddingTop: 24, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: green }}>{savedLot.card_count} {pl(savedLot.card_count)} lot created</div>
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>{savedLot.title}</div>
          <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>${savedLot.asking_price} asking · est. profit ${profit >= 0 ? "+" : ""}${profit}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
            <button onClick={() => setScreen("manager")} style={{ ...btnStyle, background: green + "15", border: "1px solid " + green + "30", color: green }}>View All Lots</button>
            <button onClick={() => { setSelectedIds([]); setScreen("create"); }} style={{ ...btnStyle, background: cyan + "15", border: "1px solid " + cyan + "30", color: cyan }}>Create Another Lot</button>
            <button onClick={() => onNavigate({ screen: "home" })} style={{ ...btnStyle, background: surface2, border: "1px solid " + border, color: muted }}>Home</button>
          </div>
        </div>
      </Shell>
    );
  }

  return null;
}
