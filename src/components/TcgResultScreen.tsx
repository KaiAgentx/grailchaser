"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Shell } from "./Shell";
import { bg, surface, surface2, border, accent, green, red, amber, muted, secondary, text, font, mono } from "./styles";
import type { TcgCondition } from "@/lib/types";

const CONDITIONS: TcgCondition[] = ["NM", "LP", "MP", "HP", "DMG"];

const bandStyles: Record<string, { bg: string; border: string; color: string; label: string }> = {
  exact: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", color: "#34d399", label: "✓ Exact Match" },
  likely: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", color: "#fbbf24", label: "~ Good Match" },
  choose_version: { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.4)", color: "#f59e0b", label: "~ Close Match" },
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
  if (visionResult?.edition === "1st") { const f = available.find((t: string) => t.includes("1stEdition")); if (f) return f; }
  if (visionResult?.finish === "reverse_holo") { if (available.includes("reverseHolofoil")) return "reverseHolofoil"; }
  if (visionResult?.finish === "non_holo") { const f = available.find((t: string) => t.includes("Normal") || t === "normal"); if (f) return f; }
  return pricing?.priceType || available[0];
}

interface Candidate {
  rank: number; catalogCardId: string; name: string; setName: string; setCode: string;
  cardNumber: string | null; rarity: string | null; imageSmallUrl: string | null; imageLargeUrl: string | null;
  weightedDistance: number;
}

interface Props {
  result: any; scanIntent: "check" | "collect"; onBack: () => void; onSaved: () => void; onScanAnother: () => void; userId: string;
  scanResultId?: string | null;
  rank1CatalogCardId?: string | null;
}

export function TcgResultScreen({ result, scanIntent, onBack, onSaved, onScanAnother, userId, scanResultId, rank1CatalogCardId }: Props) {
  const candidates: Candidate[] = result.result?.candidates || [];
  const band: string = result.result?.confidenceBand || "unclear";
  const visionResult = result.visionResult || null;

  // Selection by catalogCardId instead of index
  const [selectedCardId, setSelectedCardId] = useState(candidates[0]?.catalogCardId || "");
  const [condition, setCondition] = useState<TcgCondition>("NM");
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [imgError, setImgError] = useState(false);

  // Price cache to avoid re-fetching
  const priceCache = useRef(new Map<string, any>());
  // Generation counter to discard stale fetches
  const fetchGen = useRef(0);

  const selected = candidates.find(c => c.catalogCardId === selectedCardId) || candidates[0];

  // Fetch pricing — with cache and stale-discard
  useEffect(() => {
    if (!selected?.catalogCardId) return;
    setImgError(false);

    const cached = priceCache.current.get(selected.catalogCardId);
    if (cached) {
      setPricing(cached);
      setPricingLoading(false);
      setSelectedVariant(autoSelectVariant(cached, visionResult));
      return;
    }

    setPricingLoading(true);
    setPricing(null);
    setSelectedVariant("");
    const gen = ++fetchGen.current;

    const supabasePrice = createClient();
    supabasePrice.auth.getSession().then(({ data: sd }) => {
      const jwt = sd?.session?.access_token;
      if (!jwt) { if (gen === fetchGen.current) setPricingLoading(false); return; }
      fetch(`/api/tcg/price?cardId=${encodeURIComponent(selected.catalogCardId)}`, {
        headers: { "Authorization": `Bearer ${jwt}` },
      })
        .then(r => r.json())
        .then(d => {
          if (gen !== fetchGen.current) return; // stale
          if (!d.error) {
            priceCache.current.set(selected.catalogCardId, d);
            setPricing(d);
            setSelectedVariant(autoSelectVariant(d, visionResult));
          }
          setPricingLoading(false);
        })
        .catch(() => { if (gen === fetchGen.current) setPricingLoading(false); });
    });
  }, [selected?.catalogCardId]);

  // Haptic on mount
  useEffect(() => { if (band === "exact") navigator.vibrate?.(50); else if (band === "unclear") navigator.vibrate?.([30, 50, 30]); }, []);

  // Rapid scan countdown
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

    // Fire correction telemetry if user picked a non-rank-1 variant
    if (scanResultId && rank1CatalogCardId && selected.catalogCardId !== rank1CatalogCardId) {
      const supabaseCorr = createClient();
      supabaseCorr.auth.getSession().then(({ data: sd }) => {
        const t = sd?.session?.access_token;
        if (!t) return;
        void fetch(`/api/tcg/scan-results/${scanResultId}/correct`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
          body: JSON.stringify({ final_catalog_id: selected.catalogCardId, final_catalog_name: selected.name }),
        }).catch(() => {});
      });
    }

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) { setSaving(false); return; }

      const idemKey = crypto.randomUUID();
      const res = await fetch("/api/tcg/collection-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify({
          catalogCardId: selected.catalogCardId,
          game: "pokemon",
          player: selected.name,
          brand: "Pokémon TCG",
          set: selected.setName,
          set_name: selected.setName,
          set_code: selected.setCode,
          card_number: selected.cardNumber,
          rarity: selected.rarity,
          raw_value: displayMarket ?? 0,
          scan_image_url: selected.imageLargeUrl || selected.imageSmallUrl,
          storage_box: "PENDING",
        }),
      });
      const data = await res.json();
      if (res.ok && (data.card || data.replay)) { setSaved(true); navigator.vibrate?.(80); if (scanIntent !== "collect") setTimeout(onSaved, 1500); }
    } catch {}
    setSaving(false);
  };

  const imgSrc = imgError ? null : (selected?.imageLargeUrl || selected?.imageSmallUrl);
  const bStyle = bandStyles[band] || bandStyles.unclear;

  // ─── Zero candidates ───
  if (candidates.length === 0) {
    return (
      <Shell title="Result" back={onBack}>
        <div style={{ paddingTop: 60, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12, color: muted }}>🎴</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 8 }}>Couldn't identify this card</div>
          <button onClick={onScanAnother} style={{ padding: "14px 28px", minHeight: 48, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Try scanning again</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Result" back={onBack}>
      <div style={{ paddingTop: 16, paddingBottom: 140 }}>

        {/* Card image */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          {imgSrc ? <img src={imgSrc} alt={selected?.name} loading="eager" onError={() => setImgError(true)} style={{ width: 180, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }} /> : <div style={{ width: 180, height: 252, margin: "0 auto", background: surface2, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: muted }}>🎴</div>}
        </div>

        {/* Confidence badge */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 9999, background: bStyle.bg, border: "1px solid " + bStyle.border, color: bStyle.color, fontSize: 12, fontWeight: 600 }}>{bStyle.label}</span>
        </div>

        {/* Card info */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: text }}>{selected?.name}</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{selected?.setName} · #{selected?.cardNumber} · {selected?.rarity}</div>
          {result.method === "vision" && visionResult?.name && (
            <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>Vision read: {visionResult.name}{visionResult.number ? ` #${visionResult.number}` : ""}</div>
          )}
        </div>

        {/* ─── Candidate picker (horizontal scroll) ─── */}
        {candidates.length >= 2 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Which card is this?</div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {candidates.map(c => {
                const isSel = c.catalogCardId === selectedCardId;
                return (
                  <button key={c.catalogCardId} onClick={() => setSelectedCardId(c.catalogCardId)} style={{ flex: "0 0 auto", width: 90, scrollSnapAlign: "start", background: surface, border: isSel ? "2px solid " + accent : "1px solid " + border, borderRadius: 10, padding: 6, cursor: "pointer", textAlign: "center", minHeight: 44 }}>
                    {c.imageSmallUrl ? <img src={c.imageSmallUrl} alt="" loading="lazy" onError={e => (e.currentTarget.style.display = "none")} style={{ width: 72, height: 100, objectFit: "cover", borderRadius: 6, marginBottom: 4 }} /> : <div style={{ width: 72, height: 100, background: surface2, borderRadius: 6, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: muted, margin: "0 auto" }}>🎴</div>}
                    <div style={{ fontSize: 10, fontWeight: 600, color: isSel ? accent : text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: 9, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.setName}</div>
                    <div style={{ fontSize: 9, color: muted }}>{c.rarity}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
