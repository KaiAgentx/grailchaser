"use client";
import { surface2, muted } from "../styles";

export interface PickerCandidate {
  catalogCardId: string;
  setName: string;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
}

interface Props {
  candidates: PickerCandidate[];
  selectedId: string | null;
  onSelect: (catalogCardId: string) => void;
  label?: string;
}

export function VariantPickerStrip({ candidates, selectedId, onSelect, label = "Pick Your Version" }: Props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
        {candidates.map(c => {
          const isSel = c.catalogCardId === selectedId;
          return (
            <button key={c.catalogCardId} onClick={() => onSelect(c.catalogCardId)} style={{ position: "relative", flex: "0 0 auto", minWidth: 110, scrollSnapAlign: "start", background: isSel ? "rgba(212,168,67,0.06)" : "rgba(255,255,255,0.02)", border: isSel ? "2px solid #D4A843" : "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 6, cursor: "pointer", textAlign: "center" }}>
              {(c.imageSmallUrl || c.imageLargeUrl) ? (
                <img src={c.imageSmallUrl || c.imageLargeUrl || ""} alt="" loading="lazy" onError={e => (e.currentTarget.style.display = "none")} style={{ width: 96, height: 134, objectFit: "contain", borderRadius: 5, marginBottom: 4 }} />
              ) : (
                <div style={{ width: 96, height: 134, background: surface2, borderRadius: 5, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: muted, margin: "0 auto" }}>🎴</div>
              )}
              <div style={{ fontSize: 11, color: isSel ? "#D4A843" : "rgba(255,255,255,0.8)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.setName}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
