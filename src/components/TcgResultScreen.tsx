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

const SPARKLES = [
  { top: "8%", left: "10%", size: 3, dur: 2.5, delay: 0, color: "#ffd700" },
  { top: "12%", right: "8%", size: 2, dur: 3, delay: 0.5, color: "#fff8dc" },
  { top: "55%", right: "4%", size: 4, dur: 2.8, delay: 1.2, color: "#ffd700" },
  { bottom: "15%", right: "12%", size: 2, dur: 3.2, delay: 0.8, color: "#fff8dc" },
  { bottom: "18%", left: "8%", size: 3, dur: 2.6, delay: 1.5, color: "#ffd700" },
  { top: "50%", left: "4%", size: 2, dur: 3.5, delay: 0.3, color: "#fff8dc" },
];

const fmtPrice = (v: number | null) => v != null ? `$${v.toFixed(2)}` : "—";

function fmtDate(s: string): string {
  const d = new Date(s.replace(/\//g, "-"));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  // Computed prices (USD only)
  const activePrice = pricing?.allPrices?.[selectedVariant];
  const displayMarket = activePrice?.market ?? pricing?.market ?? null;
  const displayLow = activePrice?.low ?? pricing?.low ?? null;
  const displayHigh = activePrice?.high ?? pricing?.high ?? null;
  const displayDirectLow = (activePrice as any)?.directLow ?? null;
  const hasPrice = displayMarket != null;

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
  const updatedDate = pricing?.updatedAt ? fmtDate(pricing.updatedAt) : null;

  // ─── Zero candidates ───
  if (candidates.length === 0) {
    return (
      <Shell title="Result" back={onBack}>
        <div style={{ paddingTop: 60, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12, color: muted }}>🎴</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 8 }}>Couldn{"'"}t identify this card</div>
          <button onClick={onScanAnother} style={{ padding: "14px 28px", minHeight: 48, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Try scanning again</button>
        </div>
      </Shell>
    );
  }

  return (
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", maxWidth: 500, margin: "0 auto" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes glow { 0%, 100% { opacity: 0.6; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes sparkle { 0%, 100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* ─── Custom header ─── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,9,13,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid " + border, padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: muted, fontSize: 18, cursor: "pointer", padding: "8px 4px", lineHeight: 1 }}>←</button>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 0.5 }}>Pokémon</span>
        </div>
        <button onClick={onScanAnother} style={{ background: "rgba(53,99,233,0.12)", border: "1px solid rgba(53,99,233,0.25)", borderRadius: 8, padding: "8px 14px", color: "#5B8DEF", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Scan Another</button>
      </div>

      {/* ─── Content ─── */}
      <div style={{ padding: "0 20px 80px", animation: "fadeIn 0.3s ease" }}>

        {/* Card image with gold sparkle effect */}
        <div style={{ position: "relative", textAlign: "center", padding: "28px 0 20px" }}>
          {/* Radial glow */}
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 280, height: 360, transform: "translate(-50%, -50%)", background: "radial-gradient(circle, rgba(212,168,67,0.3) 0%, rgba(212,168,67,0.08) 40%, transparent 70%)", animation: "glow 4s ease-in-out infinite", pointerEvents: "none" }} />
          {/* Sparkle dots */}
          {SPARKLES.map((s, i) => (
            <div key={i} style={{ position: "absolute", top: s.top, left: (s as any).left, right: (s as any).right, bottom: (s as any).bottom, width: s.size, height: s.size, borderRadius: "50%", background: s.color, animation: `sparkle ${s.dur}s ease-in-out ${s.delay}s infinite`, pointerEvents: "none" }} />
          ))}
          {/* Card */}
          {imgSrc ? (
            <img src={imgSrc} alt={selected?.name} loading="eager" onError={() => setImgError(true)} style={{ position: "relative", width: 200, height: 280, objectFit: "contain", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }} />
          ) : (
            <div style={{ position: "relative", width: 200, height: 280, margin: "0 auto", background: surface2, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, color: muted }}>🎴</div>
          )}
        </div>

        {/* Confidence badge */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 9999, background: bStyle.bg, border: "1px solid " + bStyle.border, color: bStyle.color, fontSize: 12, fontWeight: 600 }}>{bStyle.label}</span>
        </div>

        {/* ─── Split layout: name left, price right ─── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          {/* Left — card info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>{selected?.name}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 5 }}>{selected?.setName} · #{selected?.cardNumber}</div>
            {selected?.rarity && (
              <span style={{ display: "inline-block", marginTop: 8, background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.2)", borderRadius: 6, padding: "3px 10px", color: "#D4A843", fontSize: 11, fontWeight: 600 }}>{selected.rarity}</span>
            )}
          </div>
          {/* Right — market price */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.35)", fontWeight: 600, marginBottom: 4 }}>Market</div>
            {pricingLoading ? (
              <div style={{ fontSize: 32, fontWeight: 700, color: muted }}>—</div>
            ) : hasPrice ? (
              <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, background: "linear-gradient(105deg, #B8860B 0%, #D4A843 20%, #FFD700 35%, #FFF8DC 42%, #FFD700 48%, #D4A843 60%, #B8860B 80%, #D4A843 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 4s ease-in-out infinite", lineHeight: 1.1 }}>{fmtPrice(displayMarket)}</div>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 600, color: muted }}>No price</div>
            )}
            {!pricingLoading && (displayLow != null || displayHigh != null) && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{fmtPrice(displayLow)} – {fmtPrice(displayHigh)}</div>
            )}
          </div>
        </div>

        {/* ─── Pricing detail card ─── */}
        {!pricingLoading && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Low</div>
                  <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>{fmtPrice(displayLow)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>High</div>
                  <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>{fmtPrice(displayHigh)}</div>
                </div>
                {displayDirectLow != null && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Direct</div>
                    <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", fontWeight: 600, marginTop: 2 }}>{fmtPrice(displayDirectLow)}</div>
                  </div>
                )}
              </div>
              {pricing?.tcgplayerUrl && (
                <a href={pricing.tcgplayerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#5B8DEF", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", paddingTop: 2 }}>View on TCGPlayer →</a>
              )}
            </div>
            {updatedDate && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>Updated {updatedDate}</div>
            )}
            {!hasPrice && (
              <div style={{ fontSize: 12, color: muted, textAlign: "center", padding: "4px 0" }}>No pricing available</div>
            )}
          </div>
        )}

        {/* ─── Candidate picker — "PICK YOUR VERSION" ─── */}
        {candidates.length >= 2 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginBottom: 10 }}>Pick Your Version</div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
              {candidates.map(c => {
                const isSel = c.catalogCardId === selectedCardId;
                return (
                  <button key={c.catalogCardId} onClick={() => setSelectedCardId(c.catalogCardId)} style={{ position: "relative", flex: "0 0 auto", minWidth: 135, scrollSnapAlign: "start", background: isSel ? "rgba(212,168,67,0.06)" : "rgba(255,255,255,0.02)", border: isSel ? "2px solid #D4A843" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 8, cursor: "pointer", textAlign: "center" }}>
                    {isSel && (
                      <div style={{ position: "absolute", top: 0, right: 0, background: "#D4A843", color: "#0a0a12", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: "0 10px 0 8px" }}>SELECTED</div>
                    )}
                    {(c.imageLargeUrl || c.imageSmallUrl) ? (
                      <img src={c.imageLargeUrl || c.imageSmallUrl || ""} alt="" loading="lazy" onError={e => (e.currentTarget.style.display = "none")} style={{ width: 119, height: 167, objectFit: "contain", borderRadius: 7, marginBottom: 6 }} />
                    ) : (
                      <div style={{ width: 119, height: 167, background: surface2, borderRadius: 7, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: muted, margin: "0 auto" }}>🎴</div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSel ? "#D4A843" : "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{c.setName}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{c.rarity}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Action buttons (in flow, not sticky) ─── */}
        <div style={{ marginTop: 8, paddingBottom: 20 }}>
          {saved && scanIntent === "collect" ? (
            <>
              <div style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 12, padding: "12px", textAlign: "center", fontSize: 14, color: green, fontWeight: 600, marginBottom: 8 }}>✓ {selected?.name} added</div>
              <button onClick={onScanAnother} style={{ width: "100%", height: 56, background: "#3563E9", border: "none", borderRadius: 14, color: "#fff", fontFamily: font, fontSize: 17, fontWeight: 600, cursor: "pointer" }}>Scan Next Card ({countdown}...)</button>
            </>
          ) : saved ? (
            <div style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 12, padding: "12px", textAlign: "center", fontSize: 14, color: green, fontWeight: 600 }}>✓ {selected?.name} added to collection</div>
          ) : (
            <>
              {scanIntent === "collect" && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Condition</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {CONDITIONS.map(c => (
                      <button key={c} onClick={() => setCondition(c)} style={{ flex: 1, padding: "8px 4px", minHeight: 44, background: condition === c ? "rgba(212,168,67,0.12)" : "rgba(255,255,255,0.03)", border: "1px solid " + (condition === c ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.06)"), borderRadius: 8, color: condition === c ? "#D4A843" : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleSave} disabled={saving || !selected} style={{ width: "100%", height: 56, background: "#3563E9", border: "none", borderRadius: 14, color: "#fff", fontFamily: font, fontSize: 17, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Add to Collection"}</button>
              {scanIntent === "check" && (
                <button onClick={onBack} style={{ width: "100%", height: 56, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "rgba(255,255,255,0.6)", fontFamily: font, fontSize: 16, fontWeight: 500, cursor: "pointer", marginTop: 8 }}>Skip</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
