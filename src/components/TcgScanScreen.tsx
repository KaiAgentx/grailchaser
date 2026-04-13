"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Shell } from "./Shell";
import { bg, surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "./styles";

// ─── EXIF-aware image compression ───

function getExifOrientation(buf: ArrayBuffer): number {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return 1;
  let o = 2;
  while (o + 4 < v.byteLength) {
    const marker = v.getUint16(o);
    const len = v.getUint16(o + 2);
    if (marker === 0xFFE1 && v.byteLength > o + 10) {
      const le = v.getUint16(o + 10) === 0x4949;
      const ifd = v.getUint32(o + 14, le);
      const base = o + 10;
      if (base + ifd + 2 > v.byteLength) break;
      const entries = v.getUint16(base + ifd, le);
      for (let i = 0; i < entries; i++) {
        const entry = base + ifd + 2 + i * 12;
        if (entry + 12 > v.byteLength) break;
        if (v.getUint16(entry, le) === 0x0112) return v.getUint16(entry + 8, le);
      }
    }
    if (len < 2) break;
    o += 2 + len;
  }
  return 1;
}

function applyExifTransform(ctx: CanvasRenderingContext2D, o: number, w: number, h: number) {
  const t: Record<number, () => void> = {
    2: () => ctx.transform(-1, 0, 0, 1, w, 0),
    3: () => ctx.transform(-1, 0, 0, -1, w, h),
    4: () => ctx.transform(1, 0, 0, -1, 0, h),
    5: () => ctx.transform(0, 1, 1, 0, 0, 0),
    6: () => ctx.transform(0, 1, -1, 0, h, 0),
    7: () => ctx.transform(0, -1, -1, 0, h, w),
    8: () => ctx.transform(0, -1, 1, 0, 0, w),
  };
  t[o]?.();
}

function compressImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const orientation = getExifOrientation(arrayBuffer);
        const blob = new Blob([arrayBuffer], { type: file.type });
        const url = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
        img.onload = () => {
          URL.revokeObjectURL(url);
          const swap = orientation >= 5 && orientation <= 8;
          let srcW = img.naturalWidth, srcH = img.naturalHeight;
          if (swap) [srcW, srcH] = [srcH, srcW];
          const scale = Math.min(1, maxWidth / Math.max(srcW, srcH));
          const w = Math.round(srcW * scale);
          const h = Math.round(srcH * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          applyExifTransform(ctx, orientation, w, h);
          ctx.drawImage(img, 0, 0, swap ? h : w, swap ? w : h);
          resolve(canvas.toDataURL("image/jpeg", 0.88).split(",")[1]);
        };
        img.src = url;
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── Component ───

interface Props {
  game: string;
  scanIntent: "check" | "collect";
  onBack: () => void;
  onResult: (result: any, intent: "check" | "collect") => void;
}

export function TcgScanScreen({ game, scanIntent, onBack, onResult }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);

  useEffect(() => { fetch("/api/tcg/recognize/warmup").catch(() => {}); }, []);

  const handleFile = async (file: File) => {
    setScanning(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) { setError("Not signed in"); setScanning(false); return; }

      const base64 = await compressImage(file, 800);
      const headers: Record<string, string> = { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` };
      if (scanSessionId) headers["X-Scan-Session-ID"] = scanSessionId;
      const res = await fetch("/api/tcg/recognize", { method: "POST", headers, body: JSON.stringify({ game, imageBase64: base64, scanIntent }) });
      const data = await res.json();
      if (data.scan_session_id) setScanSessionId(data.scan_session_id);
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

  const title = scanIntent === "check" ? "Scan Pokémon Card" : "Scan to Collection";

  if (scanning) {
    return (
      <Shell title={title} back={() => { setScanning(false); }}>
        <div style={{ paddingTop: 60, textAlign: "center" }}>
          <div style={{ width: 180, height: 252, margin: "0 auto 24px", background: surface, borderRadius: 12, animation: "pulse 1s ease-in-out infinite alternate" }} />
          <style>{`@keyframes pulse { from { transform: scale(0.97); opacity: 0.7; } to { transform: scale(1.03); opacity: 1; } }`}</style>
          <div style={{ fontSize: 18, fontWeight: 700, color: text }}>Identifying card...</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>Comparing against 20,000+ cards</div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={title} back={onBack}>
      <div style={{ paddingTop: 32, textAlign: "center" }}>
        <input type="file" accept="image/*" capture="environment" ref={cameraRef} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        <input type="file" accept="image/*" ref={libraryRef} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

        {/* Icon */}
        <div style={{ fontSize: 72, marginBottom: 16, color: accent, opacity: 0.8 }}>📷</div>

        <div style={{ fontSize: 20, fontWeight: 700, color: text, marginBottom: 4 }}>Take a photo of your card</div>
        <div style={{ fontSize: 13, color: muted, marginBottom: 32 }}>Front of card only</div>

        {/* Tips */}
        <div style={{ textAlign: "left", maxWidth: 280, margin: "0 auto 32px" }}>
          {[
            { icon: "☀️", tip: "Flat surface, good lighting" },
            { icon: "📐", tip: "Fill the frame with the card" },
            { icon: "🎴", tip: "No sleeves needed" },
          ].map(t => (
            <div key={t.tip} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", minHeight: 44 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 14, color: secondary }}>{t.tip}</span>
            </div>
          ))}
        </div>

        {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: red }}>{error}</div>}

        <button onClick={() => cameraRef.current?.click()} style={{ width: "100%", padding: "16px", minHeight: 56, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>Open Camera</button>

        <button onClick={() => libraryRef.current?.click()} style={{ width: "100%", padding: "14px", minHeight: 44, background: surface, border: "1px solid " + border, borderRadius: 12, color: secondary, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Choose from Library</button>
      </div>
    </Shell>
  );
}
