"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { compressImage } from "@/lib/imageCompress";
import { LiveCamera, type CaptureMeta } from "./LiveCamera";
import { Shell } from "./shell/Shell";
import { bg, surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "./styles";

// ─── Component ───

interface Props {
  game: string;
  scanIntent: "check" | "collect";
  onBack: () => void;
  onResult: (result: any, intent: "check" | "collect") => void;
  onFrontCaptured?: (front: File) => void;
  onBackCaptured?: (back: Blob | null) => void;
}

export function ScanScreen({ game, scanIntent, onBack, onResult, onFrontCaptured, onBackCaptured }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<"live" | "fallback">(() =>
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia ? "live" : "fallback"
  );
  const [cameraFailed, setCameraFailed] = useState(false);

  useEffect(() => { fetch("/api/tcg/recognize/warmup").catch(() => {}); }, []);

  // Close scan session on unmount (best-effort, fire-and-forget)
  useEffect(() => {
    const sid = scanSessionId;
    return () => {
      if (sid) {
        const supabase = createClient();
        (async () => { try { await supabase.from("scan_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sid); } catch {} })();
      }
    };
  }, [scanSessionId]);

  const handleFile = async (file: File, captureMeta?: CaptureMeta, back?: Blob | null) => {
    setScanning(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) { setError("Not signed in"); setScanning(false); return; }

      // Measure original dimensions before compression
      let imagePreW: number | null = null;
      let imagePreH: number | null = null;
      try {
        const preUrl = URL.createObjectURL(file);
        const preImg = new window.Image();
        preImg.src = preUrl;
        await new Promise(r => { preImg.onload = r; preImg.onerror = r; });
        imagePreW = preImg.naturalWidth;
        imagePreH = preImg.naturalHeight;
        URL.revokeObjectURL(preUrl);
      } catch {}

      const base64 = await compressImage(file);

      // Measure post-compression dimensions
      let imagePostW: number | null = null;
      let imagePostH: number | null = null;
      try {
        const postImg = new window.Image();
        postImg.src = "data:image/jpeg;base64," + base64;
        await new Promise(r => { postImg.onload = r; postImg.onerror = r; });
        imagePostW = postImg.naturalWidth;
        imagePostH = postImg.naturalHeight;
      } catch {}

      const headers: Record<string, string> = { "Content-Type": "application/json", "Authorization": `Bearer ${jwt}` };
      if (scanSessionId) headers["X-Scan-Session-ID"] = scanSessionId;
      const res = await fetch("/api/tcg/recognize", { method: "POST", headers, body: JSON.stringify({
        game, imageBase64: base64, scanIntent, imagePreW, imagePreH, imagePostW, imagePostH,
        capture_method: captureMeta?.method ?? "file_input",
        zoom_supported: captureMeta?.zoomSupported ?? null,
        torch_supported: captureMeta?.torchSupported ?? null,
        probe_result: captureMeta?.probeResult ?? null,
      }) });
      const data = await res.json();
      if (data.scan_session_id) setScanSessionId(data.scan_session_id);
      if (data.ok && data.result?.candidates?.length > 0) {
        // Hand the captured front (and optional back) up to page.tsx
        // for storage upload after the user confirms the save.
        if (scanIntent === "collect") {
          onFrontCaptured?.(file);
          onBackCaptured?.(back ?? null);
        }
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

  // ─── Live camera mode ───
  if (cameraMode === "live" && !cameraFailed && !scanning) {
    return (
      <LiveCamera
        mode={scanIntent === "collect" ? "front_and_back" : "front_only"}
        onCapture={(file, meta) => handleFile(file, meta)}
        onCaptureBoth={(front, back, meta) => handleFile(front, meta, back)}
        onCancel={onBack}
        onUnavailable={(reason) => {
          console.log("[scan] camera unavailable:", reason);
          setCameraFailed(true);
          setCameraMode("fallback");
        }}
      />
    );
  }

  // ─── Fallback file-input mode ───
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

        {cameraFailed && (
          <button onClick={() => { setCameraFailed(false); setCameraMode("live"); }} style={{ width: "100%", padding: "12px", minHeight: 40, background: "none", border: "none", color: accent, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 12 }}>Try live camera</button>
        )}
      </div>
    </Shell>
  );
}
