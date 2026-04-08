"use client";
import { useState, useEffect } from "react";
import { Shell } from "./Shell";
import { bg, surface, surface2, border, accent, green, red, cyan, purple, amber, muted, secondary, text, font, mono } from "./styles";
import type { TcgCondition } from "@/lib/types";

const CONDITIONS: TcgCondition[] = ["NM", "LP", "MP", "HP", "DMG"];

const bandStyles: Record<string, { bg: string; border: string; color: string; label: string }> = {
  exact: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", color: "#34d399", label: "✓ Exact Match" },
  likely: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", color: "#fbbf24", label: "~ Good Match" },
  choose_version: { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.4)", color: "#f59e0b", label: "? Pick Version" },
  unclear: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", color: "#f87171", label: "! Low Confidence" },
};

interface Candidate {
  rank: number;
  catalogCardId: string;
  name: string;
  setName: string;
  setCode: string;
  cardNumber: string | null;
  rarity: string | null;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  weightedDistance: number;
}

interface Props {
  result: any;
  scanIntent: "check" | "collect";
  onBack: () => void;
  onSaved: () => void;
  onScanAnother: () => void;
  userId: string;
}

export function TcgResultScreen({ result, scanIntent, onBack, onSaved, onScanAnother, userId }: Props) {
  const candidates: Candidate[] = result.result?.candidates || [];
  const band = result.result?.confidenceBand || "unclear";
  const topDistance = result.result?.topDistance || 64;

  const [selected, setSelected] = useState<Candidate>(candidates[0]);
  const [condition, setCondition] = useState<TcgCondition>("NM");
  const [prices, setPrices] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Candidate[]>([]);
  const [imgError, setImgError] = useState(false);

  // Fetch pricing for selected candidate
  useEffect(() => {
    if (!selected) return;
    setPriceLoading(true);
    setPrices(null);
    fetch("/api/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search_query: `${selected.name} ${selected.setName} pokemon`, game: "pokemon" }),
    })
      .then(r => r.json())
      .then(d => { setPrices(d.prices || null); setPriceLoading(false); })
      .catch(() => setPriceLoading(false));
  }, [selected?.catalogCardId]);

  // Search handler
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/tcg/search?q=${encodeURIComponent(searchQuery)}&game=pokemon`)
        .then(r => r.json())
        .then(d => setSearchResults(d.results || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tcg/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          game: "pokemon",
          player: selected.name,
          brand: "Pokémon TCG",
          set: selected.setName,
          card_number: selected.cardNumber,
          rarity: selected.rarity,
          condition,
          raw_value: prices?.raw || 0,
          scan_image_url: selected.imageLargeUrl || selected.imageSmallUrl,
          tcg_card_id: selected.catalogCardId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(onSaved, 1500);
      }
    } catch {}
    setSaving(false);
  };

  const imgSrc = imgError ? null : (selected?.imageLargeUrl || selected?.imageSmallUrl);
  const bStyle = bandStyles[band] || bandStyles.unclear;
  const showPicker = band === "choose_version" || band === "unclear";
  const showBlurry = topDistance > 35;
  const showNoMatch = band === "unclear" && topDistance > 50;

  return (
    <Shell title="Result" back={onBack}>
      <div style={{ paddingTop: 16, paddingBottom: 120 }}>
        {/* Card image */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          {imgSrc ? (
            <img src={imgSrc} alt={selected?.name} loading="eager" onError={() => setImgError(true)} style={{ width: 200, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }} />
          ) : (
            <div style={{ width: 200, height: 280, margin: "0 auto", background: surface2, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: muted, fontSize: 40 }}>⊙</div>
          )}
        </div>

        {/* Confidence badge */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 9999, background: bStyle.bg, border: "1px solid " + bStyle.border, color: bStyle.color, fontSize: 12, fontWeight: 600 }}>{bStyle.label}</span>
        </div>

        {/* Card info */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: text }}>{selected?.name}</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{selected?.setName} · #{selected?.cardNumber} · {selected?.rarity}</div>
        </div>

        {/* Pricing */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[{ label: "Raw", val: prices?.raw }, { label: "PSA 9", val: prices?.psa9 }, { label: "PSA 10", val: prices?.psa10 }].map(p => (
            <div key={p.label} style={{ background: surface, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: muted, marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: priceLoading ? muted : (p.val ? green : muted) }}>{priceLoading ? "—" : (p.val ? `$${p.val}` : "—")}</div>
            </div>
          ))}
        </div>
        {!priceLoading && !prices?.raw && !prices?.psa9 && !prices?.psa10 && (
          <div style={{ fontSize: 11, color: muted, textAlign: "center", marginBottom: 12 }}>No recent eBay sales found</div>
        )}
        {(prices?.raw || prices?.psa9 || prices?.psa10) && (
          <div style={{ fontSize: 10, color: muted, textAlign: "center", marginBottom: 16 }}>eBay market data</div>
        )}

        {/* Blurry photo warning */}
        {showBlurry && (
          <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: amber }}>Photo may be blurry — better lighting improves accuracy</div>
        )}

        {/* Candidate picker */}
        {showPicker && candidates.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>Is this the right card?</div>
            {candidates.slice(0, 3).map(c => (
              <button key={c.catalogCardId} onClick={() => { setSelected(c); setImgError(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: selected?.catalogCardId === c.catalogCardId ? surface2 : surface, border: "1px solid " + (selected?.catalogCardId === c.catalogCardId ? accent + "50" : border), borderRadius: 10, marginBottom: 4, cursor: "pointer", textAlign: "left" }}>
                {c.imageSmallUrl && <img src={c.imageSmallUrl} alt="" loading="lazy" style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 4 }} />}
                <div><div style={{ fontSize: 13, fontWeight: 600, color: text }}>{c.name}</div><div style={{ fontSize: 11, color: muted }}>{c.setName} · #{c.cardNumber}</div></div>
              </button>
            ))}
          </div>
        )}

        {/* No match — text search */}
        {showNoMatch && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>Couldn't identify this card</div>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name..." style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 10, padding: "12px 14px", color: text, fontFamily: font, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
            {searchResults.map((c: any) => (
              <button key={c.catalogCardId} onClick={() => { setSelected(c); setImgError(false); setSearchQuery(""); setSearchResults([]); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: surface, border: "1px solid " + border, borderRadius: 10, marginBottom: 4, cursor: "pointer", textAlign: "left" }}>
                {c.imageSmallUrl && <img src={c.imageSmallUrl} alt="" loading="lazy" style={{ width: 40, height: 56, objectFit: "cover", borderRadius: 4 }} />}
                <div><div style={{ fontSize: 13, fontWeight: 600, color: text }}>{c.name}</div><div style={{ fontSize: 11, color: muted }}>{c.setName} · #{c.cardNumber}</div></div>
              </button>
            ))}
          </div>
        )}

        {/* Saved toast */}
        {saved && (
          <div style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontSize: 14, color: green, fontWeight: 600, marginBottom: 16 }}>Added {selected?.name} to collection ✓</div>
        )}
      </div>

      {/* Sticky bottom actions */}
      {!saved && (
        <div style={{ position: "sticky", bottom: 64, zIndex: 50 }}>
          <div style={{ background: `linear-gradient(transparent, ${bg})`, height: 20 }} />
          <div style={{ background: bg, padding: "0 0 8px" }}>
            {scanIntent === "collect" && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: muted, marginBottom: 4, fontWeight: 600 }}>Condition</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {CONDITIONS.map(c => (
                    <button key={c} onClick={() => setCondition(c)} style={{ flex: 1, padding: "8px 4px", minHeight: 44, background: condition === c ? accent + "20" : surface2, border: "1px solid " + (condition === c ? accent + "50" : border), borderRadius: 8, color: condition === c ? accent : muted, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={handleSave} disabled={saving || !selected} style={{ width: "100%", padding: "14px", minHeight: 52, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Add to Collection"}</button>
            {scanIntent === "check" && (
              <button onClick={onBack} style={{ width: "100%", padding: "12px", minHeight: 44, background: surface, border: "1px solid " + border, borderRadius: 12, color: secondary, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Skip</button>
            )}
            <button onClick={onScanAnother} style={{ width: "100%", background: "none", border: "none", color: muted, fontFamily: font, fontSize: 13, cursor: "pointer", padding: "10px 0", marginTop: 4 }}>Scan Another</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
