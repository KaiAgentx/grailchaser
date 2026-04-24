"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { Card } from "@/lib/types";
import { Box } from "@/hooks/useBoxes";
import { Shell } from "./Shell";
import { TierBadge } from "./TierBadge";
import { calcTier } from "@/lib/utils";
import { surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "./styles";

type Phase = "upload" | "processing" | "verify" | "saving" | "done";

interface BulkResult {
  file_name: string;
  file_size: number;
  outcome: "recognized" | "timeout" | "error";
  scan_result_id: string | null;
  result: { confidenceBand: string; candidates: any[] } | null;
  visionResult: any;
  method: string | null;
  error: string | null;
}

interface Props {
  boxes: Box[];
  onBack: () => void;
  addCard: (row: any) => void;
  onDone: () => void;
}

export function BatchImportView({ boxes, onBack, addCard, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map());
  const [results, setResults] = useState<BulkResult[]>([]);
  const [batchSessionId, setBatchSessionId] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [targetBox, setTargetBox] = useState(boxes[0]?.name || "PENDING");
  const [savedCount, setSavedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [progressIndex, setProgressIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected) return;
    const arr = Array.from(selected).slice(0, 100);
    setFiles(arr);
    // Index-keyed object URLs — order matches bulk-recognize response order
    const urls = new Map<string, string>();
    arr.forEach((f, i) => urls.set(String(i), URL.createObjectURL(f)));
    setFileUrls(urls);
  };

  const handleRecognize = async () => {
    if (files.length === 0) return;
    setPhase("processing");
    setErrorMsg(null);
    try {
      const sb = createClient();
      const { data: session } = await sb.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setErrorMsg("Not authenticated"); setPhase("upload"); return; }

      const formData = new FormData();
      formData.append("game", "pokemon");
      files.forEach(f => formData.append("files[]", f));

      const res = await fetch("/api/tcg/bulk-recognize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || data.details || `Error ${res.status}`);
        setPhase("upload");
        return;
      }

      setBatchSessionId(data.batch_session_id);
      const bulkResults: BulkResult[] = data.results || [];
      setResults(bulkResults);

      // Auto-accept high-confidence recognitions
      const autoAccept = new Set<string>();
      bulkResults.forEach(r => {
        if (r.outcome === "recognized" && r.result?.confidenceBand === "exact" && r.scan_result_id) {
          autoAccept.add(r.scan_result_id);
        }
      });
      setAcceptedIds(autoAccept);
      setPhase("verify");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Recognition failed");
      setPhase("upload");
    }
  };

  const toggleAccepted = (scanResultId: string) => {
    setAcceptedIds(prev => {
      const next = new Set(prev);
      if (next.has(scanResultId)) next.delete(scanResultId);
      else next.add(scanResultId);
      return next;
    });
  };

  const acceptAllAutoOk = () => {
    const ids = new Set(acceptedIds);
    results.forEach(r => {
      if (r.outcome === "recognized" && r.result?.confidenceBand === "exact" && r.scan_result_id) {
        ids.add(r.scan_result_id);
      }
    });
    setAcceptedIds(ids);
  };

  const handleSave = async () => {
    if (acceptedIds.size === 0) return;
    setPhase("saving");
    setSavedCount(0);
    setFailedCount(0);
    setProgressIndex(0);
    setErrorMsg(null);

    const sb = createClient();
    const { data: session } = await sb.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) { setErrorMsg("Not authenticated"); setPhase("verify"); return; }

    let succeeded = 0;
    let failed = 0;
    const failedIds: string[] = [];
    const idsArray = Array.from(acceptedIds);

    for (let i = 0; i < idsArray.length; i++) {
      const scanResultId = idsArray[i];
      setProgressIndex(i + 1);
      const r = results.find(x => x.scan_result_id === scanResultId);
      if (!r || r.outcome !== "recognized" || !r.result?.candidates?.[0]) { failed++; setFailedCount(f => f + 1); continue; }

      const c = r.result.candidates[0];
      const idemKey = crypto.randomUUID();
      const payload = {
        catalogCardId: c.catalogCardId,
        game: "pokemon",
        player: c.name,
        brand: "Pokémon TCG",
        set: c.setName, set_name: c.setName, set_code: c.setCode,
        card_number: c.cardNumber, rarity: c.rarity,
        raw_value: 0,
        cost_basis: 0,
        scan_image_url: c.imageLargeUrl || c.imageSmallUrl,
        storage_box: targetBox,
      };

      try {
        const res = await fetch("/api/tcg/collection-items", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": idemKey },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && (data.card || data.replay)) {
          addCard(data.card || data);
          succeeded++;
          setSavedCount(s => s + 1);
        } else {
          failed++;
          setFailedCount(f => f + 1);
          failedIds.push(scanResultId);
        }
      } catch {
        failed++;
        setFailedCount(f => f + 1);
        failedIds.push(scanResultId);
      }
      if (i < idsArray.length - 1) await new Promise(res => setTimeout(res, 100));
    }

    if (failedIds.length > 0) console.error("[BatchImport] failed scan_result_ids:", failedIds);
    setPhase("done");
  };

  const confidenceColor = (r: BulkResult) => {
    if (r.outcome !== "recognized") return { bg: red + "15", border: red + "30", color: red, label: "Unknown" };
    const band = r.result?.confidenceBand;
    if (band === "exact") return { bg: green + "15", border: green + "30", color: green, label: "Auto-OK" };
    if (band === "likely") return { bg: green + "15", border: green + "30", color: green, label: "Likely" };
    return { bg: "#f59e0b15", border: "#f59e0b30", color: "#f59e0b", label: "Verify" };
  };

  const recognizedCount = results.filter(r => r.outcome === "recognized").length;
  const unknownCount = results.filter(r => r.outcome !== "recognized").length;

  // ─── UPLOAD ───
  if (phase === "upload") return (
    <Shell title="Import Batch" back={onBack}>
      <div style={{ paddingTop: 24, textAlign: "center" }}>
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={e => handleFilesSelected(e.target.files)} />
        <div style={{ fontSize: 48, marginBottom: 16, color: muted }}>📸</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 8 }}>Batch Card Import</div>
        <div style={{ fontSize: 13, color: muted, marginBottom: 24 }}>Select up to 100 card photos to recognize at once</div>

        <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "16px", minHeight: 56, background: surface, border: "1px solid " + border, borderRadius: 12, color: text, fontFamily: font, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
          {files.length > 0 ? `${files.length} files selected (${(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB)` : "Select card photos"}
        </button>

        {files.length > 100 && <div style={{ fontSize: 12, color: red, marginBottom: 8 }}>Maximum 100 files per batch</div>}

        <button onClick={handleRecognize} disabled={files.length === 0 || files.length > 100} style={{ width: "100%", padding: "16px", minHeight: 56, background: files.length > 0 ? green : surface2, border: "none", borderRadius: 12, color: files.length > 0 ? "#0a0a12" : muted, fontFamily: font, fontSize: 16, fontWeight: 700, cursor: files.length > 0 ? "pointer" : "default", opacity: files.length > 0 ? 1 : 0.4 }}>
          {files.length > 0 ? `Recognize ${files.length} cards` : "Select files first"}
        </button>

        {errorMsg && <div style={{ fontSize: 12, color: red, marginTop: 12 }}>{errorMsg}</div>}
      </div>
    </Shell>
  );

  // ─── PROCESSING ───
  if (phase === "processing") return (
    <Shell title="Import Batch" back={() => {}}>
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, margin: "0 auto 20px", border: "3px solid " + border, borderTop: "3px solid " + accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: text }}>Recognizing {files.length} cards…</div>
        <div style={{ fontSize: 12, color: muted, marginTop: 8 }}>This may take a few minutes</div>
      </div>
    </Shell>
  );

  // ─── VERIFY ───
  if (phase === "verify") return (
    <Shell title="Verify Results" back={() => setPhase("upload")}>
      <div style={{ paddingTop: 16 }}>
        {/* Summary bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: muted }}>
            <span style={{ color: green, fontWeight: 600 }}>{recognizedCount} recognized</span>
            {unknownCount > 0 && <span> · <span style={{ color: red }}>{unknownCount} unknown</span></span>}
          </div>
          <button onClick={acceptAllAutoOk} style={{ padding: "6px 12px", background: green + "15", border: "1px solid " + green + "30", borderRadius: 8, color: green, fontFamily: font, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Accept all Auto-OK</button>
        </div>

        {/* Box selector */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Save to:</span>
          <select value={targetBox} onChange={e => setTargetBox(e.target.value)} style={{ flex: 1, background: surface2, border: "1px solid " + border, borderRadius: 8, padding: "8px 10px", color: text, fontFamily: font, fontSize: 12, outline: "none" }}>
            {boxes.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            <option value="PENDING">PENDING (unsorted)</option>
          </select>
        </div>

        {/* Tile grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {results.map((r, i) => {
            const conf = confidenceColor(r);
            const candidate = r.result?.candidates?.[0];
            const isAccepted = r.scan_result_id ? acceptedIds.has(r.scan_result_id) : false;
            const canAccept = r.outcome === "recognized" && r.scan_result_id != null;
            const thumbUrl = fileUrls.get(String(i));

            return (
              <button key={r.scan_result_id || i} onClick={() => { if (canAccept && r.scan_result_id) toggleAccepted(r.scan_result_id); }} disabled={!canAccept} style={{ background: isAccepted ? accent + "08" : surface, border: isAccepted ? "2px solid " + accent : "1px solid " + border, borderRadius: 12, padding: 10, cursor: canAccept ? "pointer" : "default", textAlign: "left", opacity: canAccept ? 1 : 0.5 }}>
                {/* Thumbnail */}
                {thumbUrl && <img src={thumbUrl} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, marginBottom: 8, background: surface2 }} />}

                {/* Confidence pill */}
                <span style={{ display: "inline-block", fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: conf.bg, border: "1px solid " + conf.border, color: conf.color, marginBottom: 6 }}>{conf.label}</span>

                {/* Card info */}
                {candidate ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{candidate.name}</div>
                    <div style={{ fontSize: 10, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{candidate.setName} · #{candidate.cardNumber}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: muted }}>Could not identify</div>
                )}

                {/* Accept indicator */}
                {canAccept && (
                  <div style={{ fontSize: 16, textAlign: "right", marginTop: 4, color: isAccepted ? accent : muted }}>{isAccepted ? "✓" : "○"}</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Save button */}
        <button onClick={handleSave} disabled={acceptedIds.size === 0} style={{ width: "100%", padding: "16px", minHeight: 56, background: acceptedIds.size > 0 ? green : surface2, border: "none", borderRadius: 12, color: acceptedIds.size > 0 ? "#0a0a12" : muted, fontFamily: font, fontSize: 16, fontWeight: 700, cursor: acceptedIds.size > 0 ? "pointer" : "default", opacity: acceptedIds.size > 0 ? 1 : 0.4 }}>
          {acceptedIds.size > 0 ? `Save ${acceptedIds.size} accepted cards` : "Select cards to save"}
        </button>

        {errorMsg && <div style={{ fontSize: 12, color: red, marginTop: 8, textAlign: "center" }}>{errorMsg}</div>}
      </div>
    </Shell>
  );

  // ─── SAVING ───
  if (phase === "saving") return (
    <Shell title="Saving…" back={() => {}}>
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, margin: "0 auto 20px", border: "3px solid " + border, borderTop: "3px solid " + green, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: text }}>Saving {progressIndex} of {acceptedIds.size}…</div>
        <div style={{ fontSize: 12, color: muted, marginTop: 8 }}>{savedCount} saved{failedCount > 0 ? ` · ${failedCount} failed` : ""}</div>
      </div>
    </Shell>
  );

  // ─── DONE ───
  return (
    <Shell title="Import Complete" back={onDone}>
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{failedCount > 0 ? "⚠" : "✓"}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: failedCount > 0 ? "#f59e0b" : green, marginBottom: 8 }}>
          {failedCount > 0 ? `Saved ${savedCount} · Failed ${failedCount}` : `Saved ${savedCount} cards`}
        </div>
        <div style={{ fontSize: 13, color: muted, marginBottom: 32 }}>Added to {targetBox}</div>
        <button onClick={onDone} style={{ padding: "14px 32px", minHeight: 48, background: green, border: "none", borderRadius: 12, color: "#0a0a12", fontFamily: font, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Done</button>
      </div>
    </Shell>
  );
}
