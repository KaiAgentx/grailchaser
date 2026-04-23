"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { bg, surface, surface2, border, green, red, amber, muted, text, font, mono } from "./styles";
import type { RecognitionSuccess, CandidateCard } from "@/types/tcg";
import { fmtPrice } from "@/lib/tcg/variants";
import { GAME_DISPLAY_NAME, type TcgGame } from "@/lib/games";
import type { GradedComps, GradedCompsOutcome } from "@/lib/ppt/client";
import type { Box, BoxType } from "@/hooks/useBoxes";

interface Props {
  result: RecognitionSuccess;
  scanIntent: "check" | "collect";
  onBack: () => void;
  onSaved: () => void;
  onScanAnother: () => void;
  userId: string;
  scanResultId?: string | null;
  rank1CatalogCardId?: string | null;
  boxes: Box[];
  addBox: (name: string, numRows: number, dividerSize: number, boxType: BoxType) => Promise<any>;
}

type CompsState =
  | { kind: "loading" }
  | { kind: "ok"; comps: GradedComps }
  | { kind: "not_found" }
  | { kind: "timeout" }
  | { kind: "rate_limited"; retryAfterSeconds?: number }
  | { kind: "error"; message?: string };

type PurchaseStage = "idle" | "confirming" | "saving";

const GAME: TcgGame = "pokemon";

const trendArrow = (t: string | null): { label: string; color: string } => {
  if (t === "up") return { label: "↑", color: amber };
  if (t === "down") return { label: "↓", color: red };
  if (t === "stable") return { label: "→", color: muted };
  return { label: "", color: muted };
};

function verdictFor(ask: number | null, rawMarket: number | null):
  | { tone: "green" | "amber" | "red"; label: string; pct: number }
  | null
{
  if (ask == null || !Number.isFinite(ask) || ask <= 0) return null;
  if (rawMarket == null || !Number.isFinite(rawMarket) || rawMarket <= 0) return null;
  const pct = (ask / rawMarket) * 100;
  if (pct < 85) return { tone: "green", label: "Good Buy", pct };
  if (pct <= 110) return { tone: "amber", label: "Fair", pct };
  return { tone: "red", label: "Overpriced", pct };
}

async function jwt(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data?.session?.access_token ?? null;
}

export function ResultScreen({ result, scanIntent, onBack, onScanAnother, userId, scanResultId, rank1CatalogCardId, boxes, addBox }: Props) {
  const candidates: CandidateCard[] = result.result?.candidates || [];
  const [selectedCardId, setSelectedCardId] = useState(candidates[0]?.catalogCardId || "");
  const selected = candidates.find(c => c.catalogCardId === selectedCardId) || candidates[0];

  const [compsState, setCompsState] = useState<CompsState>({ kind: "loading" });
  const [compsRetryToken, setCompsRetryToken] = useState(0);
  const [ownedCount, setOwnedCount] = useState<number | null>(null);
  const [dealerAsk, setDealerAsk] = useState<string>("");
  const [purchaseStage, setPurchaseStage] = useState<PurchaseStage>("idle");
  const [finalPrice, setFinalPrice] = useState<string>("");
  const [decisionInFlight, setDecisionInFlight] = useState<null | "skip" | "walked" | "purchased">(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── Fetch comps whenever the confirmed candidate (or retry token) changes ───
  useEffect(() => {
    if (!selected?.catalogCardId) return;
    if (!selected.cardNumber) {
      setCompsState({ kind: "not_found" });
      return;
    }
    let cancelled = false;
    setCompsState({ kind: "loading" });

    (async () => {
      const token = await jwt();
      if (!token) { if (!cancelled) setCompsState({ kind: "error", message: "not authenticated" }); return; }
      const params = new URLSearchParams({
        name: selected.name,
        setName: selected.setName,
        cardNumber: selected.cardNumber!,
      });
      try {
        const res = await fetch(`/api/tcg/graded-comps?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (cancelled) return;
          if (res.status === 429) setCompsState({ kind: "rate_limited" });
          else setCompsState({ kind: "error", message: `HTTP ${res.status}` });
          return;
        }
        const body = await res.json();
        const outcome: GradedCompsOutcome | undefined = body?.outcome;
        if (cancelled) return;
        if (!outcome) { setCompsState({ kind: "error", message: "no outcome" }); return; }
        switch (outcome.status) {
          case "ok": setCompsState({ kind: "ok", comps: outcome.comps }); break;
          case "not_found": setCompsState({ kind: "not_found" }); break;
          case "timeout": setCompsState({ kind: "timeout" }); break;
          case "rate_limited": setCompsState({ kind: "rate_limited", retryAfterSeconds: outcome.retryAfterSeconds }); break;
          case "error": setCompsState({ kind: "error", message: outcome.message }); break;
        }
      } catch (err) {
        if (!cancelled) setCompsState({ kind: "error", message: err instanceof Error ? err.message : "fetch failed" });
      }
    })();

    return () => { cancelled = true; };
  }, [selected?.catalogCardId, selected?.name, selected?.setName, selected?.cardNumber, compsRetryToken]);

  // ─── Owned count (cards table) ───
  useEffect(() => {
    if (!selected?.catalogCardId || !userId) return;
    let cancelled = false;
    (async () => {
      const { count } = await createClient()
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("catalog_card_id", selected.catalogCardId);
      if (!cancelled) setOwnedCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [selected?.catalogCardId, userId]);

  const compsOk = compsState.kind === "ok" ? compsState.comps : null;
  const askNumeric = useMemo(() => {
    const n = parseFloat(dealerAsk);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [dealerAsk]);
  const verdict = verdictFor(askNumeric, compsOk?.raw_market ?? null);
  const trend = trendArrow(compsOk?.trend30d ?? null);

  // ─── Decision POST ───
  async function postDecision(decision: "skip" | "walked" | "purchased", includeSnapshot: boolean, dealerAskValue: number | null) {
    if (!scanResultId) return; // nothing to update, but side-effects (card insert) still run
    const token = await jwt();
    if (!token) return;
    const payload: Record<string, unknown> = { user_decision: decision };
    if (decision !== "skip") {
      if (dealerAskValue != null) payload.dealer_ask = dealerAskValue;
      if (includeSnapshot && compsOk) {
        payload.ppt_raw_market = compsOk.raw_market;
        payload.ppt_psa10_avg = compsOk.psa10_avg;
        payload.ppt_psa9_avg = compsOk.psa9_avg;
        payload.ppt_psa8_avg = compsOk.psa8_avg;
        if (compsOk.trend30d) payload.ppt_trend30d = compsOk.trend30d;
      }
    }
    await fetch(`/api/tcg/scan-results/${scanResultId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  // If the user re-picked a non-rank-1 candidate, fire the existing correction telemetry.
  async function maybePostCorrection() {
    if (!scanResultId || !rank1CatalogCardId || !selected) return;
    if (selected.catalogCardId === rank1CatalogCardId) return;
    const token = await jwt();
    if (!token) return;
    void fetch(`/api/tcg/scan-results/${scanResultId}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ final_catalog_id: selected.catalogCardId, final_catalog_name: selected.name }),
    }).catch(() => {});
  }

  // ─── Handlers ───
  const handleSkip = async () => {
    if (decisionInFlight) return;
    setDecisionInFlight("skip");
    setErrorMsg(null);
    await maybePostCorrection();
    await postDecision("skip", false, null);
    navigator.vibrate?.(30);
    onScanAnother();
  };

  const handleWalked = async () => {
    if (decisionInFlight) return;
    setDecisionInFlight("walked");
    setErrorMsg(null);
    await maybePostCorrection();
    await postDecision("walked", true, askNumeric);
    navigator.vibrate?.(40);
    onScanAnother();
  };

  const handlePurchasedStart = () => {
    setErrorMsg(null);
    setFinalPrice(dealerAsk || "");
    setPurchaseStage("confirming");
  };

  const handlePurchasedCancel = () => {
    setPurchaseStage("idle");
    setFinalPrice("");
  };

  const ensureShowPickupsBox = async (): Promise<string | null> => {
    const boxName = `${GAME_DISPLAY_NAME[GAME]} Show Pickups`;
    // Check React state first — if useBoxes already knows about it, no work needed
    if (boxes.some(b => b.name === boxName)) return boxName;
    // Create via addBox so useBoxes state stays in sync
    const { error } = await addBox(boxName, 1, 50, "singles" as BoxType);
    if (error) {
      // Duplicate-name error means it exists in DB but not in React state (race).
      // That's fine — the box exists, card save will succeed.
      console.warn("[ShowPickups] addBox error (may be duplicate):", error.message || error);
      return boxName;
    }
    return boxName;
  };

  const handlePurchasedConfirm = async () => {
    if (!selected || decisionInFlight) return;
    const price = parseFloat(finalPrice);
    if (!Number.isFinite(price) || price < 0) { setErrorMsg("Enter a valid final price (0 or more)."); return; }
    setDecisionInFlight("purchased");
    setPurchaseStage("saving");
    setErrorMsg(null);
    try {
      await maybePostCorrection();

      const boxName = await ensureShowPickupsBox();
      if (!boxName) { setErrorMsg("Could not prepare Show Pickups box."); setPurchaseStage("confirming"); setDecisionInFlight(null); return; }

      const token = await jwt();
      if (!token) { setErrorMsg("Not authenticated."); setPurchaseStage("confirming"); setDecisionInFlight(null); return; }

      const idemKey = crypto.randomUUID();
      const payload = {
        catalogCardId: selected.catalogCardId,
        game: GAME,
        player: selected.name,
        brand: "Pokémon TCG",
        set: selected.setName, set_name: selected.setName, set_code: selected.setCode,
        card_number: selected.cardNumber, rarity: selected.rarity,
        raw_value: compsOk?.raw_market ?? 0,
        cost_basis: price,
        purchase_source: "show",
        purchase_date: new Date().toISOString().slice(0, 10),
        scan_image_url: selected.imageLargeUrl || selected.imageSmallUrl,
        storage_box: boxName,
      };

      const res = await fetch("/api/tcg/collection-items", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": idemKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (!data.card && !data.replay)) {
        setErrorMsg(`Save failed (${res.status}): ${data.error || data.details || "Unknown error"}`);
        setPurchaseStage("confirming");
        setDecisionInFlight(null);
        return;
      }

      await postDecision("purchased", true, askNumeric ?? price);
      navigator.vibrate?.(80);
      setToast(`Added to ${boxName}`);
      setTimeout(() => onScanAnother(), 900);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
      setPurchaseStage("confirming");
      setDecisionInFlight(null);
    }
  };

  // ─── Zero candidates ───
  if (candidates.length === 0) {
    return (
      <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", maxWidth: 500, margin: "0 auto", padding: 24 }}>
        <div style={{ paddingTop: 60, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12, color: muted }}>🎴</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Couldn{"'"}t identify this card</div>
          <button onClick={onScanAnother} style={{ padding: "14px 28px", minHeight: 48, background: green, border: "none", borderRadius: 12, color: "#fff", fontFamily: font, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Try scanning again</button>
          <div style={{ marginTop: 16 }}>
            <button onClick={onBack} style={{ background: "transparent", border: "none", color: muted, fontFamily: font, fontSize: 13, cursor: "pointer" }}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  const imgSrc = selected?.imageSmallUrl || selected?.imageLargeUrl;

  return (
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", maxWidth: 500, margin: "0 auto" }}>
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,9,13,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid " + border, padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", color: muted, cursor: "pointer", padding: "8px 4px", lineHeight: 1, display: "flex", alignItems: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#D4A843", textTransform: "uppercase", letterSpacing: 1.5 }}>Pokémon</span>
        </div>
        <button onClick={onScanAnother} style={{ background: "rgba(53,99,233,0.12)", border: "1px solid rgba(53,99,233,0.25)", borderRadius: 8, padding: "8px 14px", color: "#5B8DEF", fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Scan Another</button>
      </div>

      <div style={{ padding: "16px 20px 80px" }}>
        {/* Compact card header */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
          {imgSrc ? (
            <img src={imgSrc} alt={selected?.name} style={{ width: 72, height: 100, objectFit: "contain", borderRadius: 6, flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }} />
          ) : (
            <div style={{ width: 72, height: 100, background: surface2, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: muted }}>🎴</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{selected?.name}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>{selected?.setName} · #{selected?.cardNumber}</div>
            {selected?.rarity && (
              <span style={{ display: "inline-block", marginTop: 6, background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.2)", borderRadius: 6, padding: "2px 8px", color: "#D4A843", fontSize: 10, fontWeight: 600 }}>{selected.rarity}</span>
            )}
          </div>
        </div>

        {/* Owned badge */}
        {ownedCount != null && ownedCount > 0 && (
          <div style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13, fontWeight: 600, color: "#a78bfa", textAlign: "center" }}>
            You own {ownedCount} cop{ownedCount === 1 ? "y" : "ies"}
          </div>
        )}

        {/* Pick Your Version (candidate disambiguation) */}
        {candidates.length >= 2 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.3)", fontWeight: 600, marginBottom: 8 }}>Pick Your Version</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
              {candidates.map(c => {
                const isSel = c.catalogCardId === selectedCardId;
                return (
                  <button key={c.catalogCardId} onClick={() => setSelectedCardId(c.catalogCardId)} style={{ position: "relative", flex: "0 0 auto", minWidth: 110, scrollSnapAlign: "start", background: isSel ? "rgba(212,168,67,0.06)" : "rgba(255,255,255,0.02)", border: isSel ? "2px solid #D4A843" : "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 6, cursor: "pointer", textAlign: "center" }}>
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
        )}

        {/* Comps panel */}
        <div style={{ background: surface, border: "1px solid " + border, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>Graded Comps</div>
            {compsOk && trend.label && (
              <div style={{ fontSize: 14, color: trend.color, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <span>Trend</span>
                <span style={{ fontSize: 16 }}>{trend.label}</span>
              </div>
            )}
          </div>

          {compsState.kind === "loading" && (
            <div style={{ fontSize: 13, color: muted, textAlign: "center", padding: "12px 0" }}>Loading comps…</div>
          )}
          {compsState.kind === "not_found" && (
            <div style={{ fontSize: 13, color: muted, textAlign: "center", padding: "12px 0" }}>No comps available for this card</div>
          )}
          {compsState.kind === "timeout" && (
            <div style={{ fontSize: 13, color: amber, textAlign: "center", padding: "12px 0" }}>
              Comps lookup timed out. <button onClick={() => setCompsRetryToken(t => t + 1)} style={{ background: "none", border: "none", color: amber, fontFamily: font, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Retry</button>
            </div>
          )}
          {compsState.kind === "rate_limited" && (
            <div style={{ fontSize: 13, color: amber, textAlign: "center", padding: "12px 0" }}>
              Too many requests. {compsState.retryAfterSeconds ? `Retry in ${compsState.retryAfterSeconds}s.` : "Try again shortly."}
            </div>
          )}
          {compsState.kind === "error" && (
            <div style={{ fontSize: 13, color: red, textAlign: "center", padding: "12px 0" }}>
              Comps error{compsState.message ? `: ${compsState.message}` : ""}. <button onClick={() => setCompsRetryToken(t => t + 1)} style={{ background: "none", border: "none", color: red, fontFamily: font, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Retry</button>
            </div>
          )}
          {compsState.kind === "ok" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              <CompStat label="Raw market" value={fmtPrice(compsState.comps.raw_market)} accent="#fff" />
              <CompStat label="PSA 10" value={fmtPrice(compsState.comps.psa10_avg)} accent="#D4A843" />
              <CompStat label="PSA 9" value={fmtPrice(compsState.comps.psa9_avg)} accent="rgba(255,255,255,0.8)" />
              <CompStat label="PSA 8" value={fmtPrice(compsState.comps.psa8_avg)} accent="rgba(255,255,255,0.8)" />
            </div>
          )}
        </div>

        {/* Dealer ask input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginBottom: 6 }}>Dealer Ask</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 22, fontWeight: 700, color: muted }}>$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={dealerAsk}
              onChange={e => setDealerAsk(e.target.value)}
              placeholder="0.00"
              disabled={purchaseStage !== "idle"}
              style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 12, padding: "18px 16px 18px 36px", fontFamily: mono, fontSize: 22, fontWeight: 700, color: text, outline: "none", boxSizing: "border-box", opacity: purchaseStage !== "idle" ? 0.5 : 1 }}
            />
          </div>
        </div>

        {/* Verdict strip */}
        {verdict && (
          <div style={{
            borderRadius: 12, padding: "14px 16px", marginBottom: 14, textAlign: "center",
            background: verdict.tone === "green" ? "rgba(52,211,153,0.12)" : verdict.tone === "amber" ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)",
            border: "1px solid " + (verdict.tone === "green" ? "rgba(52,211,153,0.35)" : verdict.tone === "amber" ? "rgba(251,191,36,0.35)" : "rgba(248,113,113,0.35)"),
            color: verdict.tone === "green" ? green : verdict.tone === "amber" ? amber : red,
            fontSize: 18, fontWeight: 700, letterSpacing: 0.3,
          }}>
            {verdict.label} · {verdict.pct.toFixed(0)}% of market
          </div>
        )}
        {!verdict && askNumeric != null && !compsOk && (
          <div style={{ borderRadius: 12, padding: "12px 16px", marginBottom: 14, textAlign: "center", background: surface2, border: "1px solid " + border, color: muted, fontSize: 13 }}>
            Verdict unavailable — no market price
          </div>
        )}

        {errorMsg && (
          <div style={{ background: "rgba(80,20,20,0.25)", border: "1px solid rgba(180,80,80,0.35)", color: "#e8c4c4", fontSize: 13, padding: "10px 14px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{errorMsg}</div>
        )}

        {toast && (
          <div style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 12, padding: 12, textAlign: "center", fontSize: 14, color: green, fontWeight: 600, marginBottom: 12 }}>✓ {toast}</div>
        )}

        {/* CTA block */}
        {purchaseStage === "idle" && !toast && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={handleSkip} disabled={decisionInFlight !== null} style={{
              width: "100%", minHeight: 56, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
              color: "rgba(255,255,255,0.75)", fontFamily: font, fontSize: 16, fontWeight: 600,
              cursor: decisionInFlight ? "wait" : "pointer", opacity: decisionInFlight && decisionInFlight !== "skip" ? 0.4 : 1,
            }}>
              {decisionInFlight === "skip" ? "Logging…" : "Skip"}
            </button>
            <button onClick={handleWalked} disabled={decisionInFlight !== null} style={{
              width: "100%", minHeight: 56, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 14,
              color: amber, fontFamily: font, fontSize: 16, fontWeight: 700,
              cursor: decisionInFlight ? "wait" : "pointer", opacity: decisionInFlight && decisionInFlight !== "walked" ? 0.4 : 1,
            }}>
              {decisionInFlight === "walked" ? "Logging…" : "Walked"}
            </button>
            <button onClick={handlePurchasedStart} disabled={decisionInFlight !== null || !selected} style={{
              width: "100%", minHeight: 56, border: "none", borderRadius: 14,
              background: green, color: "#0a0a12", fontFamily: font, fontSize: 17, fontWeight: 800,
              cursor: decisionInFlight ? "wait" : "pointer", letterSpacing: 0.3,
              position: "relative", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: "50%", background: "#0a0a12", color: green, alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>●</span>
              Purchased
            </button>
          </div>
        )}

        {/* Inline purchased confirm */}
        {purchaseStage !== "idle" && !toast && (
          <div style={{ background: surface, border: "1px solid rgba(52,211,153,0.3)", borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2, color: green, fontWeight: 700, marginBottom: 8 }}>Final Price Paid</div>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 22, fontWeight: 700, color: muted }}>$</span>
              <input
                type="number" inputMode="decimal" step="0.01" min="0"
                value={finalPrice} onChange={e => setFinalPrice(e.target.value)} autoFocus
                disabled={purchaseStage === "saving"}
                style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 12, padding: "18px 16px 18px 36px", fontFamily: mono, fontSize: 22, fontWeight: 700, color: text, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handlePurchasedCancel} disabled={purchaseStage === "saving"} style={{ flex: 1, minHeight: 48, background: surface2, border: "1px solid " + border, borderRadius: 12, color: muted, fontFamily: font, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handlePurchasedConfirm} disabled={purchaseStage === "saving"} style={{ flex: 2, minHeight: 48, background: green, border: "none", borderRadius: 12, color: "#0a0a12", fontFamily: font, fontSize: 15, fontWeight: 800, cursor: purchaseStage === "saving" ? "wait" : "pointer" }}>
                {purchaseStage === "saving" ? "Saving…" : `Confirm & Add to Show Pickups`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent, marginTop: 3, fontFamily: mono }}>{value}</div>
    </div>
  );
}
