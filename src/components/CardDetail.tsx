"use client";
import { useState } from "react";
import { Card } from "@/lib/types";
import { Box } from "@/hooks/useBoxes";
import { PLATFORMS, calcNet, calcShipping } from "@/lib/utils";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, cyan, purple, muted, secondary, text, font, mono } from "./styles";

const inputStyle = { background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", minHeight: 44, color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box" as const, width: "100%" };
const labelStyle = { fontSize: 10, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 3 };
const btnSmall = { padding: "10px 14px", minHeight: 44, border: "none", borderRadius: 10, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer" };

interface Props {
  card: Card;
  boxes: Box[];
  onBack: () => void;
  updateCard: (id: string, updates: Partial<Card>) => Promise<any>;
  deleteCard: (id: string) => Promise<any>;
  markListed: (id: string, platform: string, price: number) => Promise<any>;
  markSold: (id: string, price: number, platform: string) => Promise<any>;
  markShipped: (id: string, tracking?: string) => Promise<any>;
  submitForGrading: (id: string, company: string) => Promise<any>;
  returnFromGrading: (id: string, grade: string) => Promise<any>;
  getNextPosition: (box: string) => number;
}

export function CardDetail({ card, boxes, onBack, updateCard, deleteCard, markListed, markSold, markShipped, submitForGrading, returnFromGrading, getNextPosition }: Props) {
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Partial<Card>>({});
  const [saving, setSaving] = useState(false);
  const [actionForm, setActionForm] = useState<string | null>(null);
  const [listPlatforms, setListPlatforms] = useState<Set<string>>(new Set());
  const [actionPlatform, setActionPlatform] = useState("");
  const [actionPrice, setActionPrice] = useState(0);
  const [actionTracking, setActionTracking] = useState("");
  const [actionGrade, setActionGrade] = useState("");
  const [actionCompany, setActionCompany] = useState("PSA");
  const [delistPlatforms, setDelistPlatforms] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [showMoveBox, setShowMoveBox] = useState(false);
  const [moveConfirm, setMoveConfirm] = useState("");
  const [sellOptExpanded, setSellOptExpanded] = useState(false);

  const val = (field: keyof Card) => (edits as any)[field] ?? (card as any)[field];

  const platformColors: Record<string, string> = { eBay: "#e53238", Shopify: "#96bf48", Mercari: "#4dc1e8", Whatnot: "#7b61ff", Facebook: "#1877f2", TCGPlayer: "#f4a100" };

  const getActivePlatforms = (c: Card): { name: string; price?: number }[] => {
    const active: { name: string; price?: number }[] = [];
    if (c.ebay_listing_id || c.ebay_listed_date) active.push({ name: "eBay", price: c.ebay_price || c.listed_price || undefined });
    if (c.shopify_product_id) active.push({ name: "Shopify", price: c.shopify_price || c.listed_price || undefined });
    if (c.mercari_listed) active.push({ name: "Mercari", price: c.listed_price || undefined });
    if (c.whatnot_listing_id) active.push({ name: "Whatnot", price: c.listed_price || undefined });
    if (c.facebook_listed) active.push({ name: "Facebook", price: c.listed_price || undefined });
    if (c.tcgplayer_listed) active.push({ name: "TCGPlayer", price: c.listed_price || undefined });
    if (active.length === 0 && c.listed_platform) active.push({ name: c.listed_platform, price: c.listed_price || undefined });
    return active;
  };

  const handleSave = async () => {
    setSaving(true);
    await updateCard(card.id, edits);
    setEdits({});
    setEditing(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const platforms = ["eBay", "Shopify", "Mercari", "Whatnot", "Facebook", "TCGPlayer"];
  const companies = ["PSA", "BGS", "CGC", "SGC"];
  const sports = ["Baseball", "Football", "Basketball", "Hockey", "Soccer"];
  const parallels = ["Base", "Silver", "Gold", "Holo", "Refractor", "Numbered"];
  const conditions = ["Mint", "NM", "EX", "VG", "Good", "Fair", "Poor"];

  return (
    <Shell title="Card Detail" back={onBack}>
      <div style={{ paddingTop: 16 }}>
        {saved && <div style={{ background: green + "15", border: "1px solid " + green + "30", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: green, textAlign: "center", fontWeight: 600 }}>Saved</div>}

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          {editing ? (
            <input value={val("player")} onChange={e => setEdits({ ...edits, player: e.target.value })} style={{ ...inputStyle, textAlign: "center", fontSize: 20, fontWeight: 700 }} />
          ) : (
            <div style={{ fontSize: 22, fontWeight: 700 }}>{card.player}</div>
          )}
          <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>{card.year} {card.brand} {card.set}</div>
          {card.parallel !== "Base" && <div style={{ fontSize: 13, color: cyan, marginTop: 2 }}>{card.parallel}</div>}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
            {card.is_rc && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: green + "15", border: "1px solid " + green + "30", color: green, fontWeight: 600 }}>ROOKIE</span>}
            {card.is_auto && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: purple + "15", border: "1px solid " + purple + "30", color: purple, fontWeight: 600 }}>AUTO</span>}
          </div>
        </div>

        {/* Values */}
        <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={labelStyle}>RAW VALUE</div>
              {editing ? <input type="text" inputMode="decimal" value={val("raw_value") || ""} onChange={e => setEdits({ ...edits, raw_value: +e.target.value || 0 })} style={{ ...inputStyle, fontFamily: mono, fontSize: 18, fontWeight: 700, color: green }} />
                : <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: green }}>${card.raw_value}</div>}
            </div>
            <div>
              <div style={labelStyle}>COST BASIS</div>
              {editing ? <input type="text" inputMode="decimal" value={val("cost_basis") || ""} onChange={e => setEdits({ ...edits, cost_basis: +e.target.value || 0 })} style={{ ...inputStyle, fontFamily: mono, fontSize: 18, fontWeight: 700 }} />
                : <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700 }}>${card.cost_basis}</div>}
            </div>
            <div>
              <div style={labelStyle}>TIER</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: card.tier === "Gem" ? accent : card.tier === "Star" ? green : text }}>{card.tier}</div>
            </div>
            <div>
              <div style={labelStyle}>STATUS</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{card.status}</div>
            </div>
          </div>
        </div>

        {/* Editable fields */}
        {editing && (
          <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Sport</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {sports.map(s => <button key={s} onClick={() => setEdits({ ...edits, sport: s as any })} style={{ ...btnSmall, background: val("sport") === s ? cyan + "20" : surface2, border: "1px solid " + (val("sport") === s ? cyan + "50" : border), color: val("sport") === s ? cyan : muted, fontSize: 11 }}>{s}</button>)}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Parallel</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {parallels.map(p => <button key={p} onClick={() => setEdits({ ...edits, parallel: p })} style={{ ...btnSmall, background: val("parallel") === p ? cyan + "20" : surface2, border: "1px solid " + (val("parallel") === p ? cyan + "50" : border), color: val("parallel") === p ? cyan : muted, fontSize: 11 }}>{p}</button>)}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Condition</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {conditions.map(c => <button key={c} onClick={() => setEdits({ ...edits, condition: c as any })} style={{ ...btnSmall, background: val("condition") === c ? cyan + "20" : surface2, border: "1px solid " + (val("condition") === c ? cyan + "50" : border), color: val("condition") === c ? cyan : muted, fontSize: 11 }}>{c}</button>)}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Storage Box</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {["PENDING", ...boxes.map(b => b.name)].map(b => <button key={b} onClick={() => {
                  if (b === "PENDING") { setEdits({ ...edits, storage_box: "PENDING", storage_row: 1, storage_position: 1 }); }
                  else { const pos = getNextPosition(b); setEdits({ ...edits, storage_box: b, storage_row: 1, storage_position: pos }); }
                }} style={{ ...btnSmall, padding: "8px 12px", background: val("storage_box") === b ? cyan + "20" : surface2, border: "1px solid " + (val("storage_box") === b ? cyan + "50" : border), color: val("storage_box") === b ? cyan : muted, fontSize: 11 }}>{b}</button>)}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Notes</div>
              <textarea value={val("notes") || ""} onChange={e => setEdits({ ...edits, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          </div>
        )}

        {/* Edit / Save buttons */}
        {editing ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnSmall, flex: 1, background: green, color: "#fff" }}>{saving ? "Saving..." : "Save Changes"}</button>
            <button onClick={() => { setEdits({}); setEditing(false); }} style={{ ...btnSmall, flex: 1, background: surface2, color: muted, border: "1px solid " + border }}> Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} style={{ width: "100%", ...btnSmall, background: cyan + "15", border: "1px solid " + cyan + "30", color: cyan, marginBottom: 12 }}>Edit Card</button>
        )}

        {/* Storage / Move to Box */}
        {!editing && (
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Storage</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showMoveBox ? 10 : 0 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: text }}>{card.storage_box || "PENDING"}</span>
                {card.storage_box && card.storage_box !== "PENDING" && <span style={{ fontSize: 12, color: muted, marginLeft: 8 }}>#{card.storage_position}</span>}
              </div>
              <button onClick={() => setShowMoveBox(!showMoveBox)} style={{ ...btnSmall, padding: "6px 12px", background: cyan + "15", border: "1px solid " + cyan + "30", color: cyan, fontSize: 11 }}>{showMoveBox ? "Cancel" : "Move"}</button>
            </div>
            {showMoveBox && (
              <div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {boxes.map(b => (
                    <button key={b.id} onClick={async () => {
                      const pos = getNextPosition(b.name);
                      await updateCard(card.id, { storage_box: b.name, storage_row: 1, storage_position: pos });
                      setMoveConfirm(`Moved to ${b.name} — Position ${pos}`);
                      setShowMoveBox(false);
                      setTimeout(() => setMoveConfirm(""), 2500);
                    }} style={{ ...btnSmall, padding: "8px 10px", background: surface2, border: "1px solid " + border, color: text, fontSize: 11 }}>{b.name}</button>
                  ))}
                </div>
              </div>
            )}
            {moveConfirm && <div style={{ fontSize: 12, color: green, marginTop: 8, fontWeight: 600 }}>{moveConfirm}</div>}
          </div>
        )}

        {/* Sale Breakdown (sold/shipped) or Sell Optimizer (raw/listed/graded) */}
        {card.status === "sold" || card.status === "shipped" ? (() => {
          const soldPrice = card.sold_price || 0;
          const costBasis = card.cost_basis || 0;
          const platform = PLATFORMS.find(p => p.name === card.sold_platform) || PLATFORMS.find(p => card.sold_platform && p.name.toLowerCase().includes(card.sold_platform.toLowerCase()));
          const platformFee = platform ? +(soldPrice * platform.feeRate + platform.fixedFee).toFixed(2) : 0;
          const paymentFee = platform ? +(soldPrice * platform.paymentFee + platform.paymentFixed).toFixed(2) : 0;
          const totalFees = +(platformFee + paymentFee).toFixed(2);
          const shipCost = soldPrice >= 500 ? 12.00 : soldPrice >= 100 ? 7.00 : soldPrice >= 20 ? 4.50 : 1.05;
          const shipLabel = soldPrice >= 500 ? "Box + Insurance" : soldPrice >= 100 ? "BMWT + Insurance" : soldPrice >= 20 ? "BMWT" : "PWE";
          const netProfit = +(soldPrice - costBasis - totalFees - shipCost).toFixed(2);
          const roi = costBasis > 0 ? +((netProfit / costBasis) * 100).toFixed(0) : 0;
          const daysHeld = card.date_added && card.sold_date ? Math.max(0, Math.floor((new Date(card.sold_date).getTime() - new Date(card.date_added).getTime()) / 86400000)) : null;
          const feeLabel = platform ? `${platform.name} fees` : "Platform fees";

          return (
            <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Sale Breakdown</div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ fontSize: 13, color: muted }}>Purchased</span>
                <span style={{ fontFamily: mono, fontSize: 13, color: text }}>${costBasis.toFixed(2)}{card.purchase_source ? ` (${card.purchase_source})` : ""}</span>
              </div>
              {card.date_added && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 11, color: muted }}>Added</span><span style={{ fontSize: 11, color: muted }}>{card.date_added}</span></div>}

              <div style={{ borderTop: "1px solid " + border, marginTop: 8, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <span style={{ fontSize: 13, color: muted }}>Sold</span>
                  <span style={{ fontFamily: mono, fontSize: 13, color: green, fontWeight: 600 }}>${soldPrice.toFixed(2)} ({card.sold_platform || "?"})</span>
                </div>
                {card.sold_date && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 11, color: muted }}>Date</span><span style={{ fontSize: 11, color: muted }}>{card.sold_date}{daysHeld !== null ? ` (${daysHeld}d held)` : ""}</span></div>}
              </div>

              <div style={{ borderTop: "1px solid " + border, marginTop: 8, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: muted }}>{feeLabel}</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: red }}>-${platformFee.toFixed(2)}</span>
                </div>
                {paymentFee > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 12, color: muted }}>Payment processing</span><span style={{ fontFamily: mono, fontSize: 12, color: red }}>-${paymentFee.toFixed(2)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: muted }}>Shipping ({shipLabel})</span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: red }}>-${shipCost.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ borderTop: "2px solid " + (netProfit >= 0 ? green : red) + "40", marginTop: 10, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: text }}>NET PROFIT</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: mono, fontSize: 24, fontWeight: 800, color: netProfit >= 0 ? green : red }}>{netProfit >= 0 ? "+" : ""}${netProfit.toFixed(2)}</div>
                  {costBasis > 0 && <div style={{ fontSize: 11, color: netProfit >= 0 ? green : red, fontWeight: 600 }}>{roi}% ROI</div>}
                </div>
              </div>
            </div>
          );
        })() : (
          <div style={{ background: surface, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => setSellOptExpanded(!sellOptExpanded)} style={{ width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Sell Optimizer {sellOptExpanded ? "▲" : "▼"}</span>
              {!sellOptExpanded && (() => { const best = PLATFORMS.slice(0, 6).map(p => ({ name: p.name, net: calcNet(card.raw_value, p) - calcShipping(card.raw_value) })).sort((a, b) => b.net - a.net)[0]; return <span style={{ fontSize: 11, color: secondary }}>Best: {best.name} <span style={{ fontFamily: mono, color: green, fontWeight: 600 }}>${best.net.toFixed(2)}</span></span>; })()}
            </button>
            {sellOptExpanded && (
              <div style={{ padding: "0 20px 14px" }}>
                {PLATFORMS.slice(0, 6).map(p => { const net = calcNet(card.raw_value, p); const ship = calcShipping(card.raw_value); return (<div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + border }}><span style={{ fontSize: 13, color: text }}>{p.name}</span><span style={{ fontFamily: mono, fontSize: 13, color: green, fontWeight: 600 }}>${(net - ship).toFixed(2)}</span></div>); })}
              </div>
            )}
          </div>
        )}

        {/* Tracking info for shipped cards */}
        {card.status === "shipped" && (
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Shipping</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {card.tracking_number ? <div style={{ fontSize: 13, fontFamily: mono, color: cyan, wordBreak: "break-all" }}>{card.tracking_number}</div> : <div style={{ fontSize: 12, color: muted }}>No tracking (PWE)</div>}
                {card.shipped_date && <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Shipped {card.shipped_date}</div>}
              </div>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, background: green + "15", border: "1px solid " + green + "30", color: green, fontWeight: 600 }}>Shipped ✓</span>
            </div>
          </div>
        )}

        {/* Active Listings Display */}
        {card.status === "listed" && getActivePlatforms(card).length > 0 && (
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Listed On</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {getActivePlatforms(card).map(p => (
                <span key={p.name} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: (platformColors[p.name] || muted) + "15", border: "1px solid " + (platformColors[p.name] || muted) + "30", color: platformColors[p.name] || muted, fontWeight: 600 }}>{p.name}{p.price ? ` $${p.price}` : ""}</span>
              ))}
            </div>
          </div>
        )}

        {/* Delist Reminders */}
        {delistPlatforms.length > 0 && (
          <div style={{ background: "#f59e0b" + "10", border: "1px solid #f59e0b30", borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 8 }}>Delist from other platforms</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {delistPlatforms.map(p => (
                <a key={p} href={p === "Mercari" ? "https://mercari.com" : p === "Facebook" ? "https://facebook.com/marketplace" : p === "TCGPlayer" ? "https://tcgplayer.com" : "#"} target="_blank" rel="noopener noreferrer" style={{ ...btnSmall, padding: "8px 12px", background: (platformColors[p] || muted) + "20", border: "1px solid " + (platformColors[p] || muted) + "40", color: platformColors[p] || muted, fontSize: 11, textDecoration: "none" }}>Open {p}</a>
              ))}
            </div>
            <button onClick={async () => {
              const updates: Partial<Card> = {};
              for (const p of delistPlatforms) {
                if (p === "eBay") { updates.ebay_listing_id = null; updates.ebay_listed_date = null; }
                if (p === "Shopify") { updates.shopify_product_id = null; }
                if (p === "Mercari") { updates.mercari_listed = false; }
                if (p === "Facebook") { updates.facebook_listed = false; }
                if (p === "TCGPlayer") { updates.tcgplayer_listed = false; }
              }
              await updateCard(card.id, updates);
              setDelistPlatforms([]);
              setSaved(true); setTimeout(() => setSaved(false), 2000);
            }} style={{ width: "100%", ...btnSmall, background: "#f59e0b15", border: "1px solid #f59e0b30", color: "#f59e0b", fontSize: 12 }}>Mark All Delisted</button>
          </div>
        )}

        {/* Status Action Buttons */}
        <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Actions</div>

          {card.status === "raw" && (
            <>
              <button onClick={() => { setActionForm(actionForm === "list" ? null : "list"); setListPlatforms(new Set()); setActionPrice(0); }} style={{ width: "100%", ...btnSmall, background: green + "15", border: "1px solid " + green + "30", color: green, marginBottom: 8 }}>Mark Listed</button>
              {actionForm === "list" && (
                <div style={{ background: surface2, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                  <div style={labelStyle}>Platforms (select all that apply)</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {platforms.map(p => { const sel = listPlatforms.has(p); return (
                      <button key={p} onClick={() => setListPlatforms(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; })} style={{ ...btnSmall, padding: "8px 12px", background: sel ? (platformColors[p] || green) + "20" : surface, border: "1px solid " + (sel ? (platformColors[p] || green) + "50" : border), color: sel ? (platformColors[p] || green) : muted, fontSize: 11 }}>{sel ? "✓ " : ""}{p}</button>
                    ); })}
                  </div>
                  <div style={labelStyle}>List Price ($)</div>
                  <input type="text" inputMode="decimal" value={actionPrice || ""} onChange={e => setActionPrice(+e.target.value || 0)} style={{ ...inputStyle, marginBottom: 10 }} />
                  <button disabled={listPlatforms.size === 0 || !actionPrice} onClick={async () => {
                    const updates: Partial<Card> = { status: "listed" as any, listed_date: new Date().toISOString().slice(0, 10), listed_price: actionPrice, listed_platform: Array.from(listPlatforms).join(", ") };
                    if (listPlatforms.has("eBay")) { updates.ebay_listed_date = new Date().toISOString().slice(0, 10); updates.ebay_price = actionPrice; }
                    if (listPlatforms.has("Shopify")) { updates.shopify_price = actionPrice; }
                    if (listPlatforms.has("Mercari")) updates.mercari_listed = true;
                    if (listPlatforms.has("Facebook")) updates.facebook_listed = true;
                    if (listPlatforms.has("TCGPlayer")) updates.tcgplayer_listed = true;
                    await updateCard(card.id, updates);
                    setActionForm(null); setSaved(true); setTimeout(() => setSaved(false), 2000);
                  }} style={{ width: "100%", ...btnSmall, background: green, color: "#fff", opacity: listPlatforms.size > 0 && actionPrice ? 1 : 0.4 }}>List on {listPlatforms.size} Platform{listPlatforms.size !== 1 ? "s" : ""}</button>
                </div>
              )}

              <button onClick={() => setActionForm(actionForm === "grade" ? null : "grade")} style={{ width: "100%", ...btnSmall, background: purple + "15", border: "1px solid " + purple + "30", color: purple }}>Submit for Grading</button>
              {actionForm === "grade" && (
                <div style={{ background: surface2, borderRadius: 10, padding: 14, marginTop: 8 }}>
                  <div style={labelStyle}>Grading Company</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {companies.map(c => <button key={c} onClick={() => setActionCompany(c)} style={{ ...btnSmall, padding: "8px 12px", background: actionCompany === c ? purple + "20" : surface, border: "1px solid " + (actionCompany === c ? purple + "50" : border), color: actionCompany === c ? purple : muted, fontSize: 11 }}>{c}</button>)}
                  </div>
                  <button onClick={async () => { await submitForGrading(card.id, actionCompany); setActionForm(null); setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ width: "100%", ...btnSmall, background: purple, color: "#fff" }}>Confirm Submission</button>
                </div>
              )}
            </>
          )}

          {card.status === "listed" && (
            <>
              <button onClick={() => { setActionForm(actionForm === "sold" ? null : "sold"); setActionPlatform(""); setActionPrice(0); }} style={{ width: "100%", ...btnSmall, background: green + "15", border: "1px solid " + green + "30", color: green }}>Mark Sold</button>
              {actionForm === "sold" && (() => {
                const activePlats = getActivePlatforms(card).map(p => p.name);
                const soldPlats = activePlats.length > 0 ? activePlats : platforms;
                return (
                  <div style={{ background: surface2, borderRadius: 10, padding: 14, marginTop: 8 }}>
                    <div style={labelStyle}>Sold On</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                      {soldPlats.map(p => <button key={p} onClick={() => setActionPlatform(p)} style={{ ...btnSmall, padding: "8px 12px", background: actionPlatform === p ? green + "20" : surface, border: "1px solid " + (actionPlatform === p ? green + "50" : border), color: actionPlatform === p ? green : muted, fontSize: 11 }}>{p}</button>)}
                    </div>
                    <div style={labelStyle}>Sold Price ($)</div>
                    <input type="text" inputMode="decimal" value={actionPrice || ""} onChange={e => setActionPrice(+e.target.value || 0)} style={{ ...inputStyle, marginBottom: 10 }} />
                    <button disabled={!actionPlatform || !actionPrice} onClick={async () => {
                      await markSold(card.id, actionPrice, actionPlatform);
                      // Find platforms to delist (all active except the one it sold on)
                      const toDelistList = activePlats.filter(p => p !== actionPlatform);
                      setActionForm(null);
                      if (toDelistList.length > 0) { setDelistPlatforms(toDelistList); }
                      else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
                    }} style={{ width: "100%", ...btnSmall, background: green, color: "#fff", opacity: actionPlatform && actionPrice ? 1 : 0.4 }}>Confirm Sold</button>
                  </div>
                );
              })()}
            </>
          )}

          {card.status === "sold" && (
            <>
              <button onClick={() => setActionForm(actionForm === "ship" ? null : "ship")} style={{ width: "100%", ...btnSmall, background: cyan + "15", border: "1px solid " + cyan + "30", color: cyan }}>Mark Shipped</button>
              {actionForm === "ship" && (
                <div style={{ background: surface2, borderRadius: 10, padding: 14, marginTop: 8 }}>
                  <div style={labelStyle}>Tracking Number</div>
                  <input value={actionTracking} onChange={e => setActionTracking(e.target.value)} placeholder="Optional" style={{ ...inputStyle, marginBottom: 10 }} />
                  <button onClick={async () => { await markShipped(card.id, actionTracking || undefined); setActionForm(null); setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ width: "100%", ...btnSmall, background: cyan, color: "#fff" }}>Confirm Shipped</button>
                </div>
              )}
            </>
          )}

          {card.status === "grading" && (
            <>
              <button onClick={() => setActionForm(actionForm === "return" ? null : "return")} style={{ width: "100%", ...btnSmall, background: accent + "15", border: "1px solid " + accent + "30", color: accent }}>Returned from Grading</button>
              {actionForm === "return" && (
                <div style={{ background: surface2, borderRadius: 10, padding: 14, marginTop: 8 }}>
                  <div style={labelStyle}>Grade Received</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {["10", "9.5", "9", "8.5", "8", "7", "6", "AUTH"].map(g => <button key={g} onClick={() => setActionGrade(g)} style={{ ...btnSmall, padding: "8px 12px", background: actionGrade === g ? accent + "20" : surface, border: "1px solid " + (actionGrade === g ? accent + "50" : border), color: actionGrade === g ? accent : muted, fontSize: 11 }}>{g}</button>)}
                  </div>
                  <button disabled={!actionGrade} onClick={async () => { await returnFromGrading(card.id, actionGrade); setActionForm(null); setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ width: "100%", ...btnSmall, background: accent, color: "#000", opacity: actionGrade ? 1 : 0.4 }}>Confirm Grade</button>
                </div>
              )}
            </>
          )}
        </div>

        {(card.sold || card.status === "sold" || card.status === "shipped") && <div style={{ fontSize: 11, color: red, textAlign: "center", marginTop: 12, marginBottom: 4 }}>This card has sale history. Deleting will remove all records.</div>}
        <button onClick={async () => { await deleteCard(card.id); onBack(); }} style={{ width: "100%", padding: "14px", background: red + "15", border: "1px solid " + red + "30", borderRadius: 12, color: red, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: card.sold ? 0 : 8 }}>Delete Card</button>
      </div>
    </Shell>
  );
}
