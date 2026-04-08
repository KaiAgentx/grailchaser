"use client";
import { useState, useEffect } from "react";
import { Shell } from "./Shell";
import { bg, surface, surface2, border, accent, green, red, amber, muted, secondary, text, font, mono } from "./styles";
import type { TcgCondition } from "@/lib/types";

const CONDITIONS: TcgCondition[] = ["NM", "LP", "MP", "HP", "DMG"];

const bandStyles: Record<string, { bg: string; border: string; color: string; label: string }> = {
  exact: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", color: "#34d399", label: "✓ Exact Match" },
  likely: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", color: "#fbbf24", label: "~ Good Match" },
  choose_version: { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.4)", color: "#f59e0b", label: "? Multiple Versions" },
  unclear: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", color: "#f87171", label: "! Low Confidence" },
};

const VARIANT_LABELS: Record<string, string> = {
  holofoil: "Holo", reverseHolofoil: "Reverse Holo", normal: "Non-Holo",
  "1stEditionHolofoil": "1st Edition", unlimitedHolofoil: "Unlimited Holo",
  "1stEditionNormal": "1st Ed Non-Holo", unlimitedNormal: "Non-Holo",
};

function autoSelectVariant(pricing: any, visionResult: any): string {
  const available = Object.keys(pricing?.allPrices || {});
  if (available.length === 0) return pricing?.priceType || "";
  if (available.length === 1) return available[0];
  if (visionResult?.edition === "1st") { const f = available.find(t => t.includes("1stEdition")); if (f) return f; }
  if (visionResult?.finish === "reverse_holo") { if (available.includes("reverseHolofoil")) return "reverseHolofoil"; }
  if (visionResult?.finish === "non_holo") { const f = available.find(t => t.includes("Normal") || t === "normal"); if (f) return f; }
  return pricing?.priceType || available[0];
}

interface Candidate {
  rank: number; catalogCardId: string; name: string; setName: string; setCode: string;
  cardNumber: string | null; rarity: string | null; imageSmallUrl: string | null; imageLargeUrl: string | null;
  weightedDistance: number;
}

interface Props {
  result: any; scanIntent: "check" | "collect"; onBack: () => void; onSaved: () => void; onScanAnother: () => void; userId: string;
}

export function TcgResultScreen({ result, scanIntent, onBack, onSaved, onScanAnother, userId }: Props) {
  const candidates: Candidate[] = result.result?.candidates || [];
  const band: string = result.result?.confidenceBand || "unclear";
  const topDistance: number = result.result?.topDistance || 64;
  const visionResult = result.visionResult || null;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [condition, setCondition] = useState<TcgCondition>("NM");
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [imgError, setImgError] = useState(false);

  const selected = candidates[selectedIdx] || candidates[0];
  const showCandidates = band === "choose_version" || band === "unclear" || topDistance > 20;

  // Fetch pricing
  useEffect(() => {
    if (!selected?.catalogCardId) return;
    setPricingLoading(true); setPricing(null); setSelectedVariant("");
    fetch(`/api/tcg/price?cardId=${encodeURIComponent(selected.catalogCardId)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.error) {
          setPricing(d);
          setSelectedVariant(autoSelectVariant(d, visionResult));
        }
        setPricingLoading(false);
      })
      .catch(() => setPricingLoading(false));
  }, [selected?.catalogCardId]);

  useEffect(() => { setImgError(false); }, [selectedIdx]);
  useEffect(() => { if (band === "exact") navigator.vibrate?.(50); else if (band === "unclear") navigator.vibrate?.([30, 50, 30]); }, []);
  useEffect(() => {
    if (!saved || scanIntent !== "collect") return;
    const iv = setInterval(() => { setCountdown(c => { if (c <= 1) { clearInterval(iv); onScanAnother(); return 0; } return c - 1; }); }, 1000);
    return () => clearInterval(iv);
  }, [saved, scanIntent]);

  // Computed prices from selected variant
  const activePrice = pricing?.allPrices?.[selectedVariant];
  const displayMarket = activePrice?.market ?? pricing?.market ?? null;
  const displayLow = activePrice?.low ?? pricing?.low ?? null;
  const displayMid = activePrice?.mid ?? pricing?.mid ?? null;
  const displayHigh = activePrice?.high ?? pricing?.high ?? null;
  const isReverseHolo = selectedVariant === "reverseHolofoil";
  const displayAvg7 = isReverseHolo ? pricing?.reverseHoloCardmarket?.avg7 : pricing?.avg7;
  const displayAvg30 = isReverseHolo ? pricing?.reverseHoloCardmarket?.avg30 : pricing?.avg30;
  const trendDir = displayAvg7 && displayAvg30 ? (displayAvg7 > displayAvg30 * 1.1 ? "up" : displayAvg7 < displayAvg30 * 0.9 ? "down" : "stable") : null;
  const hasPrice = displayMarket || displayAvg7 || displayAvg30;

  const variantKeys = Object.keys(pricing?.allPrices || {});
  const showVariantPicker = variantKeys.length > 1;
  const autoDetected = visionResult && ((visionResult.edition === "1st" && selectedVariant.includes("1stEdition")) || (visionResult.finish === "reverse_holo" && selectedVariant === "reverseHolofoil") || (visionResult.finish === "non_holo" && (selectedVariant.includes("Normal") || selectedVariant === "normal")));

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tcg/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId, game: "pokemon", player: selected.name, brand: "Pokémon TCG",
          set: selected.setName, card_number: selected.cardNumber, rarity: selected.rarity,
          condition, tcg_card_id: selected.catalogCardId, raw_value: displayMarket ?? 0,
          scan_image_url: selected.imageLargeUrl || selected.imageSmallUrl,
        }),
      });
      const data = await res.json();
      if (data.success) { setSaved(true); navigator.vibrate?.(80); if (scanIntent !== "collect") setTimeout(onSaved, 1500); }
    } catch {}
    setSaving(false);
  };

  const imgSrc = imgError ? null : (selected?.imageLargeUrl || selected?.imageSmallUrl);
  const bStyle = bandStyles[band] || bandStyles.unclear;

  return (
    <Shell title="Result" back={onBack}>
      <div style={{ paddingTop: 16, paddingBottom: 140 }}>

        {showCandidates && candidates.length > 1 && (
          <div style={{ fontSize: 12, color: muted, textAlign: "center", marginBottom: 8 }}>Which version is this?</div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
          {showCandidates && candidates.length > 1 && (
            <button onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))} disabled={selectedIdx === 0} style={{ width: 44, height: 44, background: "none", border: "none", color: selectedIdx === 0 ? surface2 : secondary, fontSize: 24, cursor: "pointer" }}>←</button>
          )}
          <div style={{ textAlign: "center" }}>
            {imgSrc ? <img src={imgSrc} alt={selected?.name} loading="eager" onError={() => setImgError(true)} style={{ width: 180, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }} /> : <div style={{ width: 180, height: 252, background: surface2, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: muted }}>🎴</div>}
          </div>
          {showCandidates && candidates.length > 1 && (
            <button onClick={() => setSelectedIdx(Math.min(candidates.length - 1, selectedIdx + 1))} disabled={selectedIdx >= candidates.length - 1} style={{ width: 44, height: 44, background: "none", border: "none", color: selectedIdx >= candidates.length - 1 ? surface2 : secondary, fontSize: 24, cursor: "pointer" }}>→</button>
          )}
        </div>

        {showCandidates && candidates.length > 1 && (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
            {candidates.slice(0, 5).map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i === selectedIdx ? accent : surface2 }} />)}
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 9999, background: bStyle.bg, border: "1px solid " + bStyle.border, color: bStyle.color, fontSize: 12, fontWeight: 600 }}>{bStyle.label}</span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: text }}>{selected?.name}</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{selected?.setName} · #{selected?.cardNumber} · {selected?.rarity}</div>
          {result.method === "vision" && visionResult?.name && (
            <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>Read: {visionResult.name}{visionResult.number ? ` · #${visionResult.number}` : ""}</div>
          )}
        </div>

        {/* Variant picker */}
        {!pricingLoading && showVariantPicker && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              Variant{autoDetected && <span style={{ marginLeft: 8, color: green, fontSize: 10, textTransform: "none", letterSpacing: 0 }}>· Auto-detected</span>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {variantKeys.map(key => {
                const isSel = key === selectedVariant;
                const vm = pricing?.allPrices?.[key]?.market;
                return (
                  <button key={key} onClick={() => setSelectedVariant(key)} style={{ padding: "8px 14px", borderRadius: 20, border: isSel ? "1px solid " + accent : "1px solid " + border, background: isSel ? accent : surface2, color: isSel ? "#000" : text, fontSize: 13, fontWeight: isSel ? 600 : 400, cursor: "pointer", minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span>{VARIANT_LABELS[key] || key}</span>
                    {vm != null && <span style={{ fontSize: 11, color: isSel ? "#000" : muted, fontWeight: 400 }}>${vm.toLocaleString()}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing */}
        <div style={{ background: surface, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Pricing</span>
            {!pricingLoading && trendDir && (
              <span style={{ fontSize: 11, fontWeight: 600, color: trendDir === "up" ? green : trendDir === "down" ? red : muted }}>
                {trendDir === "up" ? "↑ Rising" : trendDir === "down" ? "↓ Falling" : "→ Stable"}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[
              { label: "TCGPlayer", val: displayMarket, pre: "$" },
              { label: "7-Day Avg", val: displayAvg7, pre: "€" },
              { label: "30-Day Avg", val: displayAvg30, pre: "€" },
            ].map(p => (
              <div key={p.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: muted, marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: pricingLoading ? muted : (p.val ? green : muted) }}>
                  {pricingLoading ? "—" : p.val ? `${p.pre}${p.val.toLocaleString()}` : "—"}
                </div>
              </div>
            ))}
          </div>

          {!pricingLoading && (displayLow || displayMid || displayHigh) && (
            <div style={{ fontSize: 11, color: muted, textAlign: "center", marginBottom: 6 }}>
              {displayLow != null && `Low: $${displayLow}`}{displayMid != null && ` · Mid: $${displayMid}`}{displayHigh != null && ` · High: $${displayHigh}`}
            </div>
          )}

          {!pricingLoading && !hasPrice && <div style={{ fontSize: 12, color: muted, textAlign: "center" }}>No pricing data available</div>}

          {!pricingLoading && hasPrice && pricing?.tcgplayerUrl && (
            <a href={pricing.tcgplayerUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 10, color: muted, textAlign: "center", textDecoration: "none", marginTop: 4 }}>TCGPlayer & CardMarket · Updated daily →</a>
          )}
        </div>
      </div>

      {/* Sticky bottom */}
      <div style={{ position: "sticky", bottom: 64, zIndex: 50 }}>
        <div style={{ background: `linear-gradient(transparent, ${bg})`, height: 20 }} />
        <div style={{ background: bg, padding: "0 0 8px" }}>
          {saved && scanIntent === "collect" ? (
            <>
              <div style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 12, padding: "12px", textAlign: "center", fontSize: 14, color: green, fontWeight: 600, marginBottom: 8 }}>✓ {selected?.name} added</div>
              <button onClick={onScanAnother} style={{ width: "100%", padding: "14px", minHeight: 52, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>Scan Next Card ({countdown}...)</button>
            </>
          ) : saved ? (
            <div style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 12, padding: "12px", textAlign: "center", fontSize: 14, color: green, fontWeight: 600 }}>✓ {selected?.name} added to collection</div>
          ) : (
            <>
              {scanIntent === "collect" && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: muted, marginBottom: 4, fontWeight: 600 }}>Condition</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {CONDITIONS.map(c => (
                      <button key={c} onClick={() => setCondition(c)} style={{ flex: 1, padding: "8px 4px", minHeight: 44, background: condition === c ? green + "20" : surface2, border: "1px solid " + (condition === c ? green + "50" : border), borderRadius: 8, color: condition === c ? green : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleSave} disabled={saving || !selected} style={{ width: "100%", padding: "14px", minHeight: 52, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Add to Collection"}</button>
              {scanIntent === "check" && <button onClick={onBack} style={{ width: "100%", padding: "12px", minHeight: 44, background: surface, border: "1px solid " + border, borderRadius: 12, color: secondary, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Skip</button>}
              <button onClick={onScanAnother} style={{ width: "100%", background: "none", border: "none", color: muted, fontFamily: font, fontSize: 13, cursor: "pointer", padding: "10px 0", marginTop: 4 }}>Scan Another</button>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
