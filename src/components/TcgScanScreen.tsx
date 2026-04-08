"use client";
import { useState, useRef, useEffect } from "react";
import { Shell } from "./Shell";
import { bg, surface, surface2, border, accent, green, red, cyan, purple, amber, muted, secondary, text, font, mono } from "./styles";

function compressImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("No canvas");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  game: string;
  scanIntent: "check" | "collect";
  onBack: () => void;
  onResult: (result: any, intent: "check" | "collect") => void;
}

export function TcgScanScreen({ game, scanIntent, onBack, onResult }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  // Fire warmup on mount (fire-and-forget)
  useEffect(() => {
    fetch("/api/tcg/recognize/warmup").catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    setScanning(true);
    setError("");
    try {
      const base64 = await compressImage(file, 800);
      const res = await fetch("/api/tcg/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, imageBase64: base64 }),
      });
      const data = await res.json();
      if (data.ok && data.result?.candidates?.length > 0) {
        onResult(data, scanIntent);
      } else {
        setError(data.error || "Could not identify card. Try a clearer photo.");
        setScanning(false);
      }
    } catch (err: any) {
      setError("Scan failed: " + err.message);
      setScanning(false);
    }
  };

  return (
    <Shell title={scanIntent === "check" ? "Check a Card" : "Scan to Collection"} back={onBack}>
      <div style={{ paddingTop: 24, textAlign: "center" }}>
        <input type="file" accept="image/*" capture="environment" ref={fileRef} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

        {/* Card-shaped viewfinder guide */}
        <div style={{ width: 220, height: 308, margin: "0 auto 24px", border: "2px dashed " + (scanning ? accent : border), borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {/* Corner accents */}
          {[[0,0],[1,0],[0,1],[1,1]].map(([x,y]) => (
            <div key={`${x}${y}`} style={{ position: "absolute", width: 20, height: 20, [y ? "bottom" : "top"]: -1, [x ? "right" : "left"]: -1, borderColor: accent, borderStyle: "solid", borderWidth: 0, [`border${y ? "Bottom" : "Top"}Width`]: 3, [`border${x ? "Right" : "Left"}Width`]: 3, [`border${y ? "Bottom" : "Top"}${x ? "Right" : "Left"}Radius`]: 6 }} />
          ))}
          {scanning ? (
            <div>
              <div style={{ width: 24, height: 24, border: "3px solid " + border, borderTopColor: accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
              <div style={{ fontSize: 13, color: accent, fontWeight: 600 }}>Identifying...</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: muted }}>Align card within frame</div>
          )}
        </div>

        {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: red }}>{error}</div>}

        <button onClick={() => fileRef.current?.click()} disabled={scanning} style={{ width: "100%", padding: "16px", minHeight: 52, background: scanning ? surface2 : green, border: "none", borderRadius: 12, color: scanning ? muted : "#fff", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: scanning ? "wait" : "pointer", marginBottom: 8 }}>{scanning ? "Processing..." : "Take Photo"}</button>

        <button onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); }; input.click(); }} disabled={scanning} style={{ width: "100%", padding: "14px", minHeight: 48, background: surface, border: "1px solid " + border, borderRadius: 12, color: secondary, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: scanning ? "wait" : "pointer" }}>Choose from Library</button>
      </div>
    </Shell>
  );
}
