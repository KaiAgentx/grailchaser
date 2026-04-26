"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Card } from "@/lib/types";
import { Box } from "@/hooks/useBoxes";
import { Shell } from "./Shell";
import { TierBadge } from "./TierBadge";
import { calcTier } from "@/lib/utils";
import { uploadCardScansAsync } from "@/lib/userScanStorage";
import { surface, surface2, border, accent, green, red, muted, secondary, text, font, mono } from "./styles";

type Phase = "upload" | "processing" | "verify" | "saving" | "done";

type Pair = { front: File; back: File | null; key: string };

const PAIR_PATTERN = /^(.+?)-(front|back)\.(jpe?g|png|webp)$/i;
const IMAGE_MIME = /^image\/(jpeg|png|webp)$/i;
const MAX_PAIRS = 100;

function isImageFile(file: File): boolean {
  return IMAGE_MIME.test(file.type);
}

function buildPairs(files: File[]): Pair[] {
  const stems = new Map<string, { front?: File; back?: File }>();
  const stemOrder: string[] = [];
  const orphans: File[] = [];

  for (const f of files) {
    const m = f.name.match(PAIR_PATTERN);
    if (m) {
      const stem = m[1];
      const side = m[2].toLowerCase() as "front" | "back";
      let entry = stems.get(stem);
      if (!entry) { entry = {}; stems.set(stem, entry); stemOrder.push(stem); }
      entry[side] = f;
    } else {
      orphans.push(f);
    }
  }

  const result: Pair[] = [];
  for (const stem of stemOrder) {
    const entry = stems.get(stem)!;
    if (!entry.front) continue; // orphan back: drop
    result.push({ front: entry.front, back: entry.back ?? null, key: stem });
  }
  for (const f of orphans) {
    result.push({ front: f, back: null, key: f.name });
  }
  return result;
}

async function readFsEntry(entry: any): Promise<File[]> {
  if (entry.isFile) {
    return new Promise<File[]>(resolve => {
      entry.file(
        (file: File) => resolve(isImageFile(file) ? [file] : []),
        () => resolve([]),
      );
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const all: File[] = [];
    const drain = (): Promise<void> => new Promise<void>(resolve => {
      reader.readEntries(async (entries: any[]) => {
        if (entries.length === 0) { resolve(); return; }
        for (const e of entries) all.push(...await readFsEntry(e));
        await drain();
        resolve();
      }, () => resolve());
    });
    await drain();
    return all;
  }
  return [];
}

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
  userId: string;
  onBack: () => void;
  addCard: (row: any) => void;
  updateCardPrice: (id: string, updatedRow: any) => void;
  onDone: (savedCardIds: string[]) => void;
}

export function BatchImportView({ boxes, userId, onBack, addCard, updateCardPrice, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map());
  const [results, setResults] = useState<BulkResult[]>([]);
  const [batchSessionId, setBatchSessionId] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [targetBox, setTargetBox] = useState(boxes[0]?.name || "PENDING");
  const [savedCount, setSavedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [progressIndex, setProgressIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  // If boxes was empty at mount, targetBox defaulted to "PENDING".
  // Once boxes hydrates, upgrade it to the first real box.
  // Sticky: once the user picks a non-PENDING value the guard skips.
  useEffect(() => {
    if (targetBox === "PENDING" && boxes.length > 0 && boxes[0]?.name) {
      setTargetBox(boxes[0].name);
    }
  }, [boxes]);

  const applyFiles = (incoming: File[]) => {
    const filtered = incoming.filter(isImageFile);
    const built = buildPairs(filtered).slice(0, MAX_PAIRS);
    setPairs(built);
    // Index-keyed object URLs (built from front of each pair) — order matches bulk-recognize response order
    const urls = new Map<string, string>();
    built.forEach((p, i) => urls.set(String(i), URL.createObjectURL(p.front)));
    setFileUrls(urls);
  };

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected) return;
    applyFiles(Array.from(selected));
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const items = Array.from(e.dataTransfer.items || []);
    const collected: File[] = [];
    const supportsEntry = items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === "function";
    if (supportsEntry) {
      for (const item of items) {
        if (item.kind !== "file") continue;
        const entry = (item as any).webkitGetAsEntry?.();
        if (entry) collected.push(...await readFsEntry(entry));
      }
    } else {
      for (const f of Array.from(e.dataTransfer.files)) {
        if (isImageFile(f)) collected.push(f);
      }
    }
    applyFiles(collected);
  };

  const handleRecognize = async () => {
    if (pairs.length === 0) return;
    setPhase("processing");
    setErrorMsg(null);
    try {
      const sb = createClient();
      const { data: session } = await sb.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setErrorMsg("Not authenticated"); setPhase("upload"); return; }

      const formData = new FormData();
      formData.append("game", "pokemon");
      // Only send the FRONT of each pair to bulk-recognize.
      // Backs are kept client-side and uploaded to storage after each save.
      pairs.forEach(p => formData.append("files[]", p.front));

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
    const tokenSnapshot = token; // capture before loop iteration

    let succeeded = 0;
    let failed = 0;
    const failedIds: string[] = [];
    const savedCardIds: string[] = [];
    const idsArray = Array.from(acceptedIds);

    for (let i = 0; i < idsArray.length; i++) {
      const scanResultId = idsArray[i];
      setProgressIndex(i + 1);
      const resultIdx = results.findIndex(x => x.scan_result_id === scanResultId);
      const r = resultIdx >= 0 ? results[resultIdx] : null;
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
          const row = data.card || data;
          console.log("[BatchImport.save] success branch entered for", row.id, "token present:", !!tokenSnapshot);
          addCard(row);
          if (row.id) savedCardIds.push(row.id);
          // Fire-and-forget user-scan upload; loop continues immediately
          if (row.id && userId && resultIdx >= 0) {
            const pair = pairs[resultIdx];
            if (pair) {
              uploadCardScansAsync(userId, row.id, pair.front, pair.back)
                .catch(err => console.error("[scan upload]", err));
            }
          }
          // Fire-and-forget price refresh: populate raw_value + tier from PPT comps
          if (row.id && tokenSnapshot) {
            console.log("[BatchImport.refresh] firing for", row.id);
            fetch(`/api/tcg/cards/${row.id}/refresh-price`, {
              method: "POST",
              headers: { Authorization: `Bearer ${tokenSnapshot}` },
            })
              .then(r => r.json())
              .then(data => {
                console.log("[BatchImport.refresh] response for", row.id, ":", data.outcome, "raw_value:", data.card?.raw_value);
                if (data.outcome === "refreshed" && data.card) {
                  updateCardPrice(row.id, data.card);
                }
              })
              .catch(err => console.error("[BatchImport] price refresh failed:", err));
          } else {
            console.warn("[BatchImport.refresh] SKIPPED for", row.id, "token:", !!tokenSnapshot);
          }
          succeeded++;
          setSavedCount(s => s + 1);
        } else {
          console.error("[BatchImport] save failed:", res.status, data?.error || data?.code, data);
          failed++;
          setFailedCount(f => f + 1);
          failedIds.push(scanResultId);
        }
      } catch (err) {
        console.error("[BatchImport] save threw:", err instanceof Error ? err.message : err);
        failed++;
        setFailedCount(f => f + 1);
        failedIds.push(scanResultId);
      }
      if (i < idsArray.length - 1) await new Promise(res => setTimeout(res, 100));
    }

    if (failedIds.length > 0) console.error("[BatchImport] failed scan_result_ids:", failedIds);
    setSavedIds(savedCardIds);
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
  if (phase === "upload") {
    const totalPhotos = pairs.reduce((s, p) => s + (p.back ? 2 : 1), 0);
    const totalBytes = pairs.reduce((s, p) => s + p.front.size + (p.back?.size || 0), 0);
    const pairedCount = pairs.filter(p => p.back).length;

    return (
      <Shell title="Import Batch" back={onBack}>
        <div style={{ paddingTop: 16, textAlign: "center" }}>
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={e => { handleFilesSelected(e.target.files); e.target.value = ""; }} />

          <div style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 4 }}>Batch Card Import</div>
          <div style={{ fontSize: 13, color: muted, marginBottom: 16 }}>Up to {MAX_PAIRS} cards per batch · pair files as <span style={{ fontFamily: mono }}>name-front.jpg</span> / <span style={{ fontFamily: mono }}>name-back.jpg</span></div>

          {/* Drag-drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={e => { e.preventDefault(); if (!isDragging) setIsDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
            style={{
              height: 240,
              borderRadius: 14,
              border: `2px dashed ${isDragging ? accent : border}`,
              background: isDragging ? accent + "10" : surface,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              cursor: "pointer", marginBottom: 12, padding: 20, transition: "border-color 120ms, background 120ms",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>📸</div>
            {pairs.length === 0 ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 4 }}>Drop card photos or folder here</div>
                <div style={{ fontSize: 12, color: muted }}>JPEG, PNG, WEBP</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 4 }}>{pairs.length} card{pairs.length !== 1 ? "s" : ""} ready</div>
                <div style={{ fontSize: 12, color: muted }}>{totalPhotos} photo{totalPhotos !== 1 ? "s" : ""}{pairedCount > 0 ? ` · ${pairedCount} with back` : ""} · {(totalBytes / 1024 / 1024).toFixed(1)} MB</div>
                <div style={{ fontSize: 11, color: muted, marginTop: 6 }}>Drop more or click to replace</div>
              </>
            )}
          </div>

          <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", color: muted, fontFamily: font, fontSize: 12, cursor: "pointer", padding: 4, marginBottom: 16 }}>
            or click to browse files
          </button>

          {pairs.length >= MAX_PAIRS && <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>Reached {MAX_PAIRS}-card limit (extras dropped)</div>}

          <button onClick={handleRecognize} disabled={pairs.length === 0} style={{ width: "100%", padding: "16px", minHeight: 56, background: pairs.length > 0 ? green : surface2, border: "none", borderRadius: 12, color: pairs.length > 0 ? "#0a0a12" : muted, fontFamily: font, fontSize: 16, fontWeight: 700, cursor: pairs.length > 0 ? "pointer" : "default", opacity: pairs.length > 0 ? 1 : 0.4 }}>
            {pairs.length > 0 ? `Recognize ${pairs.length} card${pairs.length !== 1 ? "s" : ""}` : "Select files first"}
          </button>

          {errorMsg && <div style={{ fontSize: 12, color: red, marginTop: 12 }}>{errorMsg}</div>}
        </div>
      </Shell>
    );
  }

  // ─── PROCESSING ───
  if (phase === "processing") return (
    <Shell title="Import Batch" back={() => {}}>
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, margin: "0 auto 20px", border: "3px solid " + border, borderTop: "3px solid " + accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: text }}>Recognizing {pairs.length} card{pairs.length !== 1 ? "s" : ""}…</div>
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
    <Shell title="Import Complete" back={() => onDone(savedIds)}>
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{failedCount > 0 ? "⚠" : "✓"}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: failedCount > 0 ? "#f59e0b" : green, marginBottom: 8 }}>
          {failedCount > 0 ? `Saved ${savedCount} · Failed ${failedCount}` : `Saved ${savedCount} cards`}
        </div>
        <div style={{ fontSize: 13, color: muted, marginBottom: 32 }}>Added to {targetBox}</div>
        <button onClick={() => onDone(savedIds)} style={{ padding: "14px 32px", minHeight: 48, background: green, border: "none", borderRadius: 12, color: "#0a0a12", fontFamily: font, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {savedIds.length > 0 ? "Review tiers" : "Done"}
        </button>
      </div>
    </Shell>
  );
}
