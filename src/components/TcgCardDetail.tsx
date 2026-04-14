"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Card } from "@/lib/types";
import type { TcgCondition } from "@/lib/types";
import type { VisionResult } from "@/types/tcg";
import { isTcgGame, GAME_DISPLAY_NAME } from "@/lib/games";
import { Box } from "@/hooks/useBoxes";
import { PLATFORMS, calcNet, calcShipping } from "@/lib/utils";
import { VARIANT_LABELS, autoSelectVariant, fmtPrice, fmtDate } from "@/lib/tcg/variants";
import { getFreshNextPosition } from "@/lib/boxPosition";
import { Shell } from "./Shell";
import { surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "./styles";

const CONDITIONS: TcgCondition[] = ["NM", "LP", "MP", "HP", "DMG"];
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
  getNextPosition: (box: string) => number;
}

export function TcgCardDetail({ card, boxes, onBack, updateCard, deleteCard, markListed, markSold, markShipped, getNextPosition }: Props) {
  const c = card as any; // access TCG-specific fields not in Card interface

  // ─── State ───
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Partial<Card>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMoveBox, setShowMoveBox] = useState(false);
  const [moveConfirm, setMoveConfirm] = useState("");
  const [sellOptExpanded, setSellOptExpanded] = useState(false);
  const [actionForm, setActionForm] = useState<string | null>(null);
  const [listPlatforms, setListPlatforms] = useState<Set<string>>(new Set());
  const [actionPlatform, setActionPlatform] = useState("");
  const [actionPrice, setActionPrice] = useState(0);
  const [actionTracking, setActionTracking] = useState("");
  const [delistPlatforms, setDelistPlatforms] = useState<string[]>([]);

  // ─── Pricing state ───
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [imgError, setImgError] = useState(false);
  const fetchGen = useRef(0);

  // ─── Derived ───
  const cardMode = c.game && isTcgGame(c.game) ? "tcg" : "sports";
  const modeBoxes = boxes.filter(b => b.mode === cardMode);
  const catalogCardId: string | null = c.catalog_card_id || null;
  const gameName = c.game ? (GAME_DISPLAY_NAME[c.game as keyof typeof GAME_DISPLAY_NAME] || c.game) : "TCG";
  const val = (field: keyof Card) => (edits as any)[field] ?? (card as any)[field];

  // Build fake VisionResult from saved card fields for autoSelectVariant
  const savedVision: VisionResult | null = c.finish ? { name: null, number: null, set: null, edition: c.edition || "unlimited", finish: c.finish, confidence: "high" } : null;

  // ─── Card image ───
  let imgSrc: string | null = null;
  if (!imgError) {
    if (c.scan_image_url) {
      imgSrc = c.scan_image_url;
    } else if (catalogCardId) {
      const [setCode, ...numParts] = catalogCardId.split("-");
      const cardNumber = numParts.join("-");
      if (setCode && cardNumber) imgSrc = `https://images.pokemontcg.io/${setCode}/${cardNumber}_hires.png`;
    }
  }

  // ─── Fetch live pricing on mount ───
  useEffect(() => {
    if (!catalogCardId) { setPricingLoading(false); return; }
    setPricingLoading(true);
    setPricing(null);
    setPriceError(null);
    setSelectedVariant("");
    const gen = ++fetchGen.current;

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: sd }) => {
      const jwt = sd?.session?.access_token;
      if (!jwt) { if (gen === fetchGen.current) setPricingLoading(false); return; }
      fetch(`/api/tcg/price?cardId=${encodeURIComponent(catalogCardId)}`, { headers: { "Authorization": `Bearer ${jwt}` } })
        .then(r => r.json())
        .then(d => {
          if (gen !== fetchGen.current) return;
          if (d.error === "price_fetch_failed") { setPriceError("fetch_failed"); }
          else if (d.ok === true && d.pricing === null && d.reason === "not_found") { setPriceError("not_found"); }
          else if (!d.error) { setPricing(d); setSelectedVariant(autoSelectVariant(d, savedVision)); }
          setPricingLoading(false);
        })
        .catch(() => { if (gen === fetchGen.current) { setPriceError("fetch_failed"); setPricingLoading(false); } });
    });
  }, [catalogCardId]);

  const retryPriceFetch = () => {
    if (!catalogCardId) return;
    setPriceError(null);
    setPricingLoading(true);
    setPricing(null);
    setSelectedVariant("");
    const gen = ++fetchGen.current;
    const sb = createClient();
    sb.auth.getSession().then(({ data: sd }) => {
      const jwt = sd?.session?.access_token;
      if (!jwt) { if (gen === fetchGen.current) setPricingLoading(false); return; }
      fetch(`/api/tcg/price?cardId=${encodeURIComponent(catalogCardId)}`, { headers: { "Authorization": `Bearer ${jwt}` } })
        .then(r => r.json())
        .then(d => {
          if (gen !== fetchGen.current) return;
          if (d.error === "price_fetch_failed") { setPriceError("fetch_failed"); }
          else if (d.ok === true && d.pricing === null && d.reason === "not_found") { setPriceError("not_found"); }
          else if (!d.error) { setPricing(d); setSelectedVariant(autoSelectVariant(d, savedVision)); }
          setPricingLoading(false);
        })
        .catch(() => { if (gen === fetchGen.current) { setPriceError("fetch_failed"); setPricingLoading(false); } });
    });
  };

  // ─── Computed prices ───
  const activePrice = pricing?.allPrices?.[selectedVariant];
  const displayMarket = activePrice?.market ?? pricing?.market ?? null;
  const displayLow = activePrice?.low ?? pricing?.low ?? null;
  const displayMid = activePrice?.mid ?? pricing?.mid ?? null;
  const hasPrice = displayMarket != null;
  const updatedDate = pricing?.updatedAt ? fmtDate(pricing.updatedAt) : null;
  const variantKeys = Object.keys(pricing?.allPrices || {});

  // ─── Handlers ───
  const handleSave = async () => {
    setSaving(true);
    await updateCard(card.id, edits);
    setEdits({});
    setEditing(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const refreshRawValue = async () => {
    if (displayMarket == null) return;
    await updateCard(card.id, { raw_value: displayMarket });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const platformColors: Record<string, string> = { eBay: "#e53238", Shopify: "#96bf48", Mercari: "#4dc1e8", Whatnot: "#7b61ff", Facebook: "#1877f2", TCGPlayer: "#f4a100" };
  const platforms = ["eBay", "Shopify", "Mercari", "Whatnot", "Facebook", "TCGPlayer"];

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

  const isSold = card.sold || card.status === "sold" || card.status === "shipped";

  return (
    <Shell title="Card Detail" back={onBack}>
      <style>{`@keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }`}</style>
      <div style={{ paddingTop: 16 }}>
        {saved && <div style={{ background: green + "15", border: "1px solid " + green + "30", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: green, textAlign: "center", fontWeight: 600 }}>Saved</div>}

        {/* ─── Card Image ─── */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          {imgSrc ? (
            <img src={imgSrc} alt={card.player} loading="eager" onError={() => setImgError(true)} style={{ width: 200, height: 280, objectFit: "contain", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }} />
          ) : (
            <div style={{ width: 200, height: 280, background: surface2, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, color: muted }}>🎴</div>
          )}
        </div>

        {/* ─── Identity ─── */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: text }}>{card.player}</div>
          <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>{c.set_name || card.set} · #{card.card_number}</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
            {c.rarity && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.2)", color: "#D4A843", fontWeight: 600 }}>{c.rarity}</span>}
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)", color: "#D4A843", fontWeight: 600 }}>{gameName}</span>
          </div>
        </div>

        {/* ─── Live Pricing ─── */}
        <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#D4A843", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>Market</div>
              {pricingLoading ? (
                <div style={{ fontSize: 28, fontWeight: 700, color: muted }}>—</div>
              ) : priceError === "fetch_failed" ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: red }}>Lookup failed</div>
              ) : priceError === "not_found" ? (
                <div style={{ fontSize: 14, fontWeight: 500, color: muted }}>No data</div>
              ) : hasPrice ? (
                <div style={{ fontSize: 28, fontWeight: 700, color: "#D4A843", background: "linear-gradient(105deg, #B8860B 0%, #D4A843 20%, #FFD700 35%, #FFF8DC 42%, #FFD700 48%, #D4A843 60%, #B8860B 80%, #D4A843 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s ease-in-out infinite" }}>{fmtPrice(displayMarket)}</div>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 500, color: muted }}>No data</div>
              )}
              {!pricingLoading && !priceError && (displayLow != null || displayMid != null) && (
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>Low {fmtPrice(displayLow)} · Mid {fmtPrice(displayMid)}</div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              {pricing?.tcgplayerUrl && <a href={pricing.tcgplayerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#5B8DEF", fontWeight: 600, textDecoration: "none" }}>TCGPlayer →</a>}
              {updatedDate && <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>Updated {updatedDate}</div>}
            </div>
          </div>

          {priceError === "fetch_failed" && (
            <button onClick={retryPriceFetch} style={{ ...btnSmall, padding: "8px 18px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: red, fontSize: 12 }}>Retry</button>
          )}

          {/* Variant picker */}
          {!pricingLoading && !priceError && variantKeys.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Variant</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {variantKeys.map(key => {
                  const isSel = key === selectedVariant;
                  const vm = pricing?.allPrices?.[key]?.market;
                  return (
                    <button key={key} onClick={() => setSelectedVariant(key)} style={{ padding: "6px 12px", borderRadius: 16, border: isSel ? "1px solid #D4A843" : "1px solid " + border, background: isSel ? "rgba(212,168,67,0.12)" : surface2, color: isSel ? "#D4A843" : muted, fontSize: 12, fontWeight: isSel ? 600 : 400, fontFamily: font, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <span>{VARIANT_LABELS[key] || key}</span>
                      {vm != null && <span style={{ fontSize: 10, color: isSel ? "#D4A843" : muted }}>${vm.toFixed(2)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Values Grid ─── */}
        <div style={{ background: surface, borderRadius: 14, padding: 20, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={labelStyle}>RAW VALUE</div>
              <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: green }}>${card.raw_value}</div>
              {hasPrice && displayMarket !== card.raw_value && (
                <button onClick={refreshRawValue} style={{ background: "none", border: "none", color: "#5B8DEF", fontSize: 10, fontFamily: font, cursor: "pointer", padding: 0, marginTop: 4 }}>Refresh from market</button>
              )}
            </div>
            <div>
              <div style={labelStyle}>COST BASIS</div>
              <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700 }}>${card.cost_basis}</div>
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

        {/* ─── Edit Form (collapsible) ─── */}
        <div style={{ background: surface, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
          <button onClick={() => setEditing(!editing)} style={{ width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Edit Card</span>
            <span style={{ fontSize: 14, color: muted, transform: editing ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease", display: "inline-block" }}>▼</span>
          </button>
          {editing && (
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>Condition</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {CONDITIONS.map(cond => {
                    const isSel = val("condition") === cond;
                    return <button key={cond} onClick={() => setEdits({ ...edits, condition: cond as any })} style={{ ...btnSmall, padding: "8px 12px", background: isSel ? accent + "20" : surface2, border: "1px solid " + (isSel ? accent + "50" : border), color: isSel ? accent : muted, fontSize: 11 }}>{cond}</button>;
                  })}
                </div>
              </div>
              {c.finish && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelStyle}>Finish</div>
                  <div style={{ fontSize: 13, color: secondary }}>{VARIANT_LABELS[c.finish] || c.finish}</div>
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>Notes</div>
                <textarea value={val("notes") || ""} onChange={e => setEdits({ ...edits, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btnSmall, flex: 1, background: green, color: "#fff" }}>{saving ? "Saving..." : "Save Changes"}</button>
                <button onClick={() => { setEdits({}); setEditing(false); }} style={{ ...btnSmall, flex: 1, background: surface2, color: muted, border: "1px solid " + border }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Storage / Move ─── */}
        <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Storage</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showMoveBox ? 10 : 0 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: text }}>{card.storage_box || "PENDING"}</span>
              {card.storage_box && card.storage_box !== "PENDING" && <span style={{ fontSize: 12, color: muted, marginLeft: 8 }}>#{card.storage_position}</span>}
            </div>
            <button onClick={() => setShowMoveBox(!showMoveBox)} style={{ ...btnSmall, padding: "6px 12px", background: accent + "15", border: "1px solid " + accent + "30", color: accent, fontSize: 11 }}>{showMoveBox ? "Cancel" : "Move"}</button>
          </div>
          {showMoveBox && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {modeBoxes.map(b => (
                <button key={b.id} onClick={async () => {
                  try {
                    const pos = await getFreshNextPosition(b.name);
                    await updateCard(card.id, { storage_box: b.name, storage_row: 1, storage_position: pos });
                    setMoveConfirm(`Moved to ${b.name} — Position ${pos}`);
                    setShowMoveBox(false);
                  } catch (err: any) {
                    setMoveConfirm(`Move failed: ${err.message}`);
                  }
                  setTimeout(() => setMoveConfirm(""), 2500);
                }} style={{ ...btnSmall, padding: "8px 10px", background: surface2, border: "1px solid " + border, color: text, fontSize: 11 }}>{b.name}</button>
              ))}
            </div>
          )}
          {moveConfirm && <div style={{ fontSize: 12, color: green, marginTop: 8, fontWeight: 600 }}>{moveConfirm}</div>}
        </div>

        {/* ─── Sell Optimizer (not sold) ─── */}
        {isSold ? (() => {
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
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ fontSize: 13, color: muted }}>Purchased</span><span style={{ fontFamily: mono, fontSize: 13, color: text }}>${costBasis.toFixed(2)}</span></div>
              <div style={{ borderTop: "1px solid " + border, marginTop: 8, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ fontSize: 13, color: muted }}>Sold</span><span style={{ fontFamily: mono, fontSize: 13, color: green, fontWeight: 600 }}>${soldPrice.toFixed(2)} ({card.sold_platform || "?"})</span></div>
                {card.sold_date && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 11, color: muted }}>Date</span><span style={{ fontSize: 11, color: muted }}>{card.sold_date}{daysHeld !== null ? ` (${daysHeld}d held)` : ""}</span></div>}
              </div>
              <div style={{ borderTop: "1px solid " + border, marginTop: 8, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 12, color: muted }}>{feeLabel}</span><span style={{ fontFamily: mono, fontSize: 12, color: red }}>-${platformFee.toFixed(2)}</span></div>
                {paymentFee > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 12, color: muted }}>Payment processing</span><span style={{ fontFamily: mono, fontSize: 12, color: red }}>-${paymentFee.toFixed(2)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 12, color: muted }}>Shipping ({shipLabel})</span><span style={{ fontFamily: mono, fontSize: 12, color: red }}>-${shipCost.toFixed(2)}</span></div>
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

        {/* ─── Tracking (shipped) ─── */}
        {card.status === "shipped" && (
          <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Shipping</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {card.tracking_number ? <div style={{ fontSize: 13, fontFamily: mono, color: accent, wordBreak: "break-all" }}>{card.tracking_number}</div> : <div style={{ fontSize: 12, color: muted }}>No tracking (PWE)</div>}
                {card.shipped_date && <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Shipped {card.shipped_date}</div>}
              </div>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, background: green + "15", border: "1px solid " + green + "30", color: green, fontWeight: 600 }}>Shipped ✓</span>
            </div>
          </div>
        )}

        {/* ─── Active Listings ─── */}
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

        {/* ─── Delist Reminders ─── */}
        {delistPlatforms.length > 0 && (
          <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 14, padding: 16, marginBottom: 12 }}>
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

        {/* ─── Status Actions (no grading) ─── */}
        <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Actions</div>

          {card.status === "raw" && (
            <>
              <button onClick={() => { setActionForm(actionForm === "list" ? null : "list"); setListPlatforms(new Set()); setActionPrice(0); }} style={{ width: "100%", ...btnSmall, background: green + "15", border: "1px solid " + green + "30", color: green, marginBottom: 8 }}>Mark Listed</button>
              {actionForm === "list" && (
                <div style={{ background: surface2, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                  <div style={labelStyle}>Platforms</div>
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
              <button onClick={() => setActionForm(actionForm === "ship" ? null : "ship")} style={{ width: "100%", ...btnSmall, background: accent + "15", border: "1px solid " + accent + "30", color: accent }}>Mark Shipped</button>
              {actionForm === "ship" && (
                <div style={{ background: surface2, borderRadius: 10, padding: 14, marginTop: 8 }}>
                  <div style={labelStyle}>Tracking Number</div>
                  <input value={actionTracking} onChange={e => setActionTracking(e.target.value)} placeholder="Optional" style={{ ...inputStyle, marginBottom: 10 }} />
                  <button onClick={async () => { await markShipped(card.id, actionTracking || undefined); setActionForm(null); setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ width: "100%", ...btnSmall, background: accent, color: "#000" }}>Confirm Shipped</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Delete ─── */}
        {isSold && <div style={{ fontSize: 11, color: red, textAlign: "center", marginTop: 12, marginBottom: 4 }}>This card is marked sold. Delete anyway?</div>}
        <button onClick={async () => { await deleteCard(card.id); onBack(); }} style={{ width: "100%", padding: "14px", background: red + "15", border: "1px solid " + red + "30", borderRadius: 12, color: red, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: isSold ? 0 : 8 }}>Delete Card</button>
      </div>
    </Shell>
  );
}
