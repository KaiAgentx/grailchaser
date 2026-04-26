"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { accent, muted, text, font } from "./styles";

export interface CaptureMeta {
  method: "takePhoto" | "canvas";
  width: number;
  height: number;
  zoomSupported: boolean;
  torchSupported: boolean;
  probeResult: string;
}

interface Props {
  onCapture: (file: File, meta: CaptureMeta) => void;
  onCancel: () => void;
  onUnavailable: (reason: "permission_denied" | "no_camera" | "unsupported") => void;
  mode?: "front_only" | "front_and_back";
  onCaptureBoth?: (front: File, back: File | null, meta: CaptureMeta) => void;
}

export function LiveCamera({ onCapture, onCancel, onUnavailable, mode = "front_only", onCaptureBoth }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "capturing" | "error">("starting");
  const [zoomSupported, setZoomSupported] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number }>({ min: 1, max: 1, step: 0.1 });
  const [torchOn, setTorchOn] = useState(false);
  const [probeResult, setProbeResult] = useState("pending");
  const [frontCapture, setFrontCapture] = useState<{ file: File; meta: CaptureMeta; thumbUrl: string } | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  // Revoke front thumbnail URL when component unmounts or capture is replaced
  useEffect(() => () => { if (frontCapture?.thumbUrl) URL.revokeObjectURL(frontCapture.thumbUrl); }, [frontCapture?.thumbUrl]);

  // Start camera on mount
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailable("unsupported");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for loadedmetadata before reading capabilities (iOS Safari requirement)
          videoRef.current.onloadedmetadata = () => {
            if (cancelled) return;
            try {
              const caps = track.getCapabilities?.() as any;
              if (caps?.zoom) {
                setZoomSupported(true);
                setZoomRange({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
                setCurrentZoom(caps.zoom.min);
              }
              if (caps?.torch) {
                setTorchSupported(true);
              }
              setProbeResult(caps ? "capabilities_read" : "no_capabilities");
            } catch {
              setProbeResult("probe_failed");
            }
            setStatus("ready");
          };
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err.name === "NotAllowedError") onUnavailable("permission_denied");
        else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") onUnavailable("no_camera");
        else onUnavailable("unsupported");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleZoom = useCallback(async (val: number) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: val } as any] });
      setCurrentZoom(val);
    } catch {}
  }, []);

  const handleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {}
  }, [torchOn]);

  const handleCapture = useCallback(async () => {
    if (status !== "ready") return;
    setStatus("capturing");
    const track = trackRef.current;
    const video = videoRef.current;
    if (!track || !video) { setStatus("ready"); return; }

    let blob: Blob | null = null;
    let method: "takePhoto" | "canvas" = "canvas";
    let w = video.videoWidth;
    let h = video.videoHeight;

    // Try ImageCapture.takePhoto first (higher quality, full sensor resolution)
    try {
      if (typeof ImageCapture !== "undefined") {
        const ic = new ImageCapture(track);
        blob = await ic.takePhoto();
        method = "takePhoto";
        // takePhoto may return a different resolution than the video stream
        const bmp = await createImageBitmap(blob);
        w = bmp.width;
        h = bmp.height;
        bmp.close();
      }
    } catch {
      blob = null; // fall through to canvas
    }

    // Canvas fallback
    if (!blob) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.92));
      }
      method = "canvas";
    }

    if (!blob) { setStatus("ready"); return; }

    const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
    const meta: CaptureMeta = { method, width: w, height: h, zoomSupported, torchSupported, probeResult };

    if (mode === "front_and_back") {
      if (!frontCapture) {
        // First shot is the front: stash and prompt for the back
        const thumbUrl = URL.createObjectURL(file);
        setFrontCapture({ file, meta, thumbUrl });
        setStatus("ready");
        return;
      }
      // Second shot is the back
      onCaptureBoth?.(frontCapture.file, file, frontCapture.meta);
      return;
    }

    onCapture(file, meta);
  }, [status, mode, frontCapture, zoomSupported, torchSupported, probeResult, onCapture, onCaptureBoth]);

  const handleSkipBack = useCallback(() => {
    if (!frontCapture) return;
    onCaptureBoth?.(frontCapture.file, null, frontCapture.meta);
  }, [frontCapture, onCaptureBoth]);

  // Guide overlay dimensions: 63:88 aspect ratio (Pokémon card), ~80vw, max 400px
  const guideW = "min(80vw, 400px)";
  const guideH = `calc(${guideW} * 88 / 63)`;
  const inFlipPrompt = mode === "front_and_back" && frontCapture != null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000" }}>
      {/* Video */}
      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />

      {/* Card guide overlay */}
      {status === "ready" && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -55%)", width: guideW, height: guideH, pointerEvents: "none" }}>
          {/* Corner accents */}
          {[
            { top: 0, left: 0, borderTop: "3px solid rgba(255,255,255,0.7)", borderLeft: "3px solid rgba(255,255,255,0.7)" },
            { top: 0, right: 0, borderTop: "3px solid rgba(255,255,255,0.7)", borderRight: "3px solid rgba(255,255,255,0.7)" },
            { bottom: 0, left: 0, borderBottom: "3px solid rgba(255,255,255,0.7)", borderLeft: "3px solid rgba(255,255,255,0.7)" },
            { bottom: 0, right: 0, borderBottom: "3px solid rgba(255,255,255,0.7)", borderRight: "3px solid rgba(255,255,255,0.7)" },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", width: 24, height: 24, ...s } as any} />
          ))}
          {/* Border */}
          <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }} />
        </div>
      )}

      {/* Top left: cancel */}
      <button onClick={onCancel} style={{ position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 201 }}>✕</button>

      {/* Top right: torch toggle */}
      {torchSupported && status === "ready" && (
        <button onClick={handleTorch} style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", background: torchOn ? accent : "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 201 }}>
          {torchOn ? "🔦" : "💡"}
        </button>
      )}

      {/* Front-capture thumbnail (only during flip prompt) */}
      {inFlipPrompt && frontCapture && (
        <div style={{ position: "absolute", bottom: 200, left: 16, zIndex: 202, display: "flex", alignItems: "center", gap: 8 }}>
          <img src={frontCapture.thumbUrl} alt="" style={{ width: 48, height: 67, objectFit: "cover", borderRadius: 4, border: "2px solid rgba(255,255,255,0.5)", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }} />
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: font, fontWeight: 600 }}>Front ✓</span>
        </div>
      )}

      {/* Bottom area */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 32, zIndex: 201 }}>
        {/* Hint text */}
        {status === "ready" && !inFlipPrompt && <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: font, marginBottom: 12 }}>Position card within frame</div>}
        {status === "ready" && inFlipPrompt && <div style={{ color: "#fff", fontSize: 14, fontFamily: font, fontWeight: 600, marginBottom: 12, textAlign: "center", padding: "0 24px" }}>Now flip the card and scan the back</div>}
        {status === "starting" && <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: font, marginBottom: 12 }}>Starting camera…</div>}
        {status === "capturing" && <div style={{ color: accent, fontSize: 13, fontFamily: font, fontWeight: 600, marginBottom: 12 }}>Capturing…</div>}

        {/* Zoom slider */}
        {zoomSupported && status === "ready" && (
          <div style={{ width: "60%", maxWidth: 280, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>1×</span>
            <input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={currentZoom} onChange={e => handleZoom(parseFloat(e.target.value))} style={{ flex: 1 }} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{zoomRange.max.toFixed(0)}×</span>
          </div>
        )}

        {/* Capture button */}
        <button onClick={handleCapture} disabled={status !== "ready"} style={{ width: 72, height: 72, borderRadius: "50%", background: "#fff", border: `4px solid ${accent}`, cursor: status === "ready" ? "pointer" : "wait", opacity: status === "ready" ? 1 : 0.5, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }} />

        {/* Skip-back link (only during flip prompt) */}
        {inFlipPrompt && status === "ready" && (
          <button onClick={handleSkipBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: font, fontWeight: 600, cursor: "pointer", marginTop: 12, padding: 8 }}>
            Skip back
          </button>
        )}

        {/* Fallback link (hidden during flip prompt to keep UI clean) */}
        {!inFlipPrompt && (
          <button onClick={() => onUnavailable("unsupported")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: font, cursor: "pointer", marginTop: 12, padding: 4 }}>
            Use photo upload instead
          </button>
        )}
      </div>
    </div>
  );
}
