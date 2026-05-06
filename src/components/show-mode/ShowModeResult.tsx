"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/shell/Shell";
import { ActionButton } from "@/components/atoms/ActionButton";
import { VerdictStrip } from "@/components/atoms/VerdictStrip";
import { MoneyInput } from "@/components/atoms/MoneyInput";
import { LoadingSkeleton } from "@/components/atoms/LoadingSkeleton";
import { ErrorBanner } from "@/components/atoms/ErrorBanner";
import { Toast, type ToastVariant } from "@/components/atoms/Toast";
import { VariantPickerStrip } from "@/components/atoms/VariantPickerStrip";
import { DecisionMathPanel } from "./DecisionMathPanel";
import { GradedCompsCard } from "./GradedCompsCard";
import { NegotiateModal } from "./NegotiateModal";
import { useGradedComps } from "@/hooks/useGradedComps";
import { computeDecisionMetrics } from "@/lib/pricing/decision";
import { calcTier, TIER_LABEL } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import type { ScanDecision } from "@/lib/types";

/**
 * ShowModeResult — post-scan decision screen.
 *
 * Renders canonical Show Mode labels exclusively (per locked decisions):
 *   Market Value / Dealer Ask / Max Buy / Verdict
 *
 * Inputs:
 *   - scanResultId: the scan_results row to decide on
 *   - showId: the active show (decisions are tagged with this)
 *
 * Loads:
 *   - scan_results row → catalog_match_id, name (for display)
 *   - catalog row → set, card_number, image
 *   - pricing via /api/tcg/price?cardId=catalogCardId → market value
 *
 * Decision actions call POST /api/tcg/scan-results/[id]/decision with the
 * full body shape (decision, ask_price_usd, final_price_usd?,
 * negotiated_price_usd?, comp_at_decision_usd, show_id).
 */

/**
 * Pre-loaded scan + catalog data passed via state from the recognize response.
 * When present, ShowModeResult skips both the scan_results and catalog_cards
 * queries — the recognize response already has every field we need. Eliminates
 * the read-after-write race that bit us in iPhone testing (scan_results SELECT
 * returning "not found" immediately after recognize INSERT).
 *
 * Absent → fall back to fetch (dev-inject path).
 *
 * `candidates` carries all candidates from the recognize response. Normal
 * flow has just rank-1; force-pick flow (fuzzy fallback >3) has up to 6 and
 * `forcePickRequired=true` so the user must pick before pricing renders.
 */
export interface ShowModePreloadCandidate {
  catalogCardId: string;
  name: string;
  setName: string;
  cardNumber: string | null;
  rarity: string | null;
  imageLargeUrl: string | null;
  imageSmallUrl: string | null;
}

export interface ShowModePreload {
  candidates: ShowModePreloadCandidate[];
  forcePickRequired: boolean;
}

interface Props {
  scanResultId: string;
  showId: string;
  preloaded?: ShowModePreload;
  onBack: () => void;
  /** Called after a successful decision — caller should refetch show stats + return. */
  onDecided: (decision: ScanDecision) => void;
}

interface ScanResultRow {
  id: string;
  catalog_match_id: string | null;
  catalog_match_name: string | null;
  final_catalog_id: string | null;
  final_catalog_name: string | null;
}

interface CatalogRow {
  set_name: string | null;
  card_number: string | null;
  rarity: string | null;
  image_large_url: string | null;
  image_small_url: string | null;
}

interface PricingResp {
  ok: boolean;
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  tcgplayerUrl?: string | null;
  /** Which waterfall stage produced the market value:
   *    "tcgplayer"     — Pokemon TCG API (USD, primary)
   *    "ppt"           — Pokemon Price Tracker (USD, fallback for older promos)
   *    "cardmarket_eur" — CardMarket avg7 × 1.05 (rough USD est. for SV Black Star promos)
   *    null            — no source yielded a price (Unpriced) */
  source?: "tcgplayer" | "ppt" | "cardmarket_eur" | null;
}

const fmtUsd = (v: number | null) => v != null ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

export function ShowModeResult({ scanResultId, showId, preloaded, onBack, onDecided }: Props) {
  const [scan, setScan] = useState<ScanResultRow | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow | null>(null);
  const [pricing, setPricing] = useState<PricingResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Force-pick mode starts unselected; normal mode preselects rank-1 (the only
  // candidate in the non-force-pick preload).
  const initialSelected = preloaded
    ? (preloaded.forcePickRequired ? null : (preloaded.candidates[0]?.catalogCardId ?? null))
    : null;
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(initialSelected);
  const selectedCandidate = preloaded?.candidates.find(c => c.catalogCardId === selectedCandidateId) ?? null;

  const [askPrice, setAskPrice] = useState(0);
  const [submitting, setSubmitting] = useState<ScanDecision | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant } | null>(null);
  const [negotiateOpen, setNegotiateOpen] = useState(false);

  // Load scan + catalog + pricing.
  // Two paths:
  //   (A) preloaded prop present (normal Show Mode flow) → synthesize from the
  //       selected candidate; skip both DB queries; jump to pricing fetch.
  //       Re-fires when the user picks a different candidate (force-pick path).
  //   (B) preloaded absent (dev-inject path) → fetch scan_results + catalog
  //       like before.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const sb = createClient();
        const { data: session } = await sb.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) { setLoadError("Not signed in."); setLoading(false); return; }

        let catalogId: string | null = null;

        if (preloaded) {
          if (!selectedCandidate) {
            // Force-pick mode, user hasn't picked yet — clear synth state.
            setScan(null);
            setCatalog(null);
            setPricing(null);
            setLoading(false);
            return;
          }
          // Path A — synthesize ScanResult + CatalogRow from selected candidate.
          setScan({
            id: scanResultId,
            catalog_match_id: selectedCandidate.catalogCardId,
            catalog_match_name: selectedCandidate.name,
            final_catalog_id: null,
            final_catalog_name: null,
          });
          setCatalog({
            set_name: selectedCandidate.setName,
            card_number: selectedCandidate.cardNumber,
            rarity: selectedCandidate.rarity,
            image_large_url: selectedCandidate.imageLargeUrl,
            image_small_url: selectedCandidate.imageSmallUrl,
          });
          catalogId = selectedCandidate.catalogCardId;
        } else {
          // Path B — fetch scan_results row (RLS-gated)
          const { data: sr, error: srErr } = await sb
            .from("scan_results")
            .select("id, catalog_match_id, catalog_match_name, final_catalog_id, final_catalog_name")
            .eq("id", scanResultId)
            .maybeSingle();
          if (cancelled) return;
          if (srErr || !sr) { setLoadError("Scan result not found."); setLoading(false); return; }
          setScan(sr as ScanResultRow);

          catalogId = sr.final_catalog_id ?? sr.catalog_match_id;
          if (catalogId) {
            const [setCode, ...numParts] = catalogId.split("-");
            const cardNumber = numParts.join("-");
            const { data: cat } = await sb
              .from("catalog_cards")
              .select("set_name, card_number, rarity, image_large_url, image_small_url")
              .eq("set_code", setCode)
              .eq("card_number", cardNumber)
              .limit(1)
              .maybeSingle();
            if (cancelled) return;
            if (cat) setCatalog(cat as CatalogRow);
          }
        }

        // Pricing fetch — both paths need this (external Pokemon TCG API)
        if (catalogId) {
          const priceRes = await fetch(`/api/tcg/price?cardId=${encodeURIComponent(catalogId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (cancelled) return;
          if (priceRes.ok) {
            const priceData = await priceRes.json();
            setPricing(priceData as PricingResp);
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scanResultId, preloaded, selectedCandidate?.catalogCardId]);

  // Graded comps — eBay sold + PSA tier averages from PPT. Render-only-when-
  // grade-worthy: GradedCompsCard mounts only if state is ok AND psa10_avg is
  // non-null. Bulk commons get nothing; no taps required at the show floor.
  const { state: compsState } = useGradedComps({
    name: selectedCandidate?.name,
    setName: selectedCandidate?.setName,
    cardNumber: selectedCandidate?.cardNumber,
  });

  // Derived values
  const player = scan?.final_catalog_name ?? scan?.catalog_match_name ?? null;
  const marketValue = pricing?.market ?? null;
  const metrics = computeDecisionMetrics({
    ask_usd: askPrice,
    tcgplayer_market_usd: marketValue,
    ebay_raw_avg_usd: null, // not surfaced in this commit's pricing fetch
    psa10_avg_usd: null,
    psa9_avg_usd: null,
  });
  const maxBuy = metrics.max_buy_usd;
  const tier = calcTier(marketValue);
  const tierLabel = TIER_LABEL[tier];

  let verdictState: "below_max" | "at_max" | "above_max" = "below_max";
  let verdictDetail: string | undefined;
  if (maxBuy != null) {
    if (askPrice <= 0) verdictState = "below_max";
    else if (Math.abs(askPrice - maxBuy) < 0.5) verdictState = "at_max";
    else if (askPrice > maxBuy) {
      verdictState = "above_max";
      verdictDetail = `${fmtUsd(askPrice - maxBuy)} above Max Buy`;
    } else if (metrics.pct_off_comp != null) {
      verdictDetail = `${metrics.pct_off_comp.toFixed(1)}% off Market Value`;
    }
  }

  const imgSrc = catalog?.image_large_url ?? catalog?.image_small_url ?? null;

  // Decision posting
  const postDecision = async (
    decision: ScanDecision,
    extras: { final_price_usd?: number; negotiated_price_usd?: number },
  ) => {
    if (!scanResultId) return;
    setSubmitting(decision);
    setSubmitError(null);
    try {
      const sb = createClient();
      const { data: session } = await sb.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setSubmitError("Not signed in."); setSubmitting(null); return; }
      const body: Record<string, unknown> = {
        decision,
        ask_price_usd: askPrice,
        show_id: showId,
      };
      if (marketValue != null) body.comp_at_decision_usd = marketValue;
      if (extras.final_price_usd != null) body.final_price_usd = extras.final_price_usd;
      if (extras.negotiated_price_usd != null) body.negotiated_price_usd = extras.negotiated_price_usd;

      const res = await fetch(`/api/tcg/scan-results/${scanResultId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data?.details || data?.message || `HTTP ${res.status}`);
        setSubmitting(null);
        return;
      }
      const variantByDecision: Record<ScanDecision, ToastVariant> = {
        purchased: "success",
        walked: "info",
        negotiated: "warning",
      };
      const labelByDecision: Record<ScanDecision, string> = {
        purchased: "Card added to Show Pickups",
        walked: "Walked",
        negotiated: "Counter-offer recorded",
      };
      setToast({ msg: labelByDecision[decision], variant: variantByDecision[decision] });
      // Brief delay so the user sees the toast before we navigate away
      setTimeout(() => onDecided(decision), 600);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
      setSubmitting(null);
    }
  };

  const handleBuy = () => {
    if (askPrice <= 0) return;
    postDecision("purchased", { final_price_usd: askPrice });
  };
  const handleWalk = () => postDecision("walked", {});
  const handleNegotiateSubmit = (counterOffer: number) => {
    setNegotiateOpen(false);
    postDecision("negotiated", { negotiated_price_usd: counterOffer });
  };

  // Force-pick: user must pick a candidate before pricing/decision UI renders.
  if (preloaded?.forcePickRequired && !selectedCandidate) {
    return (
      <Shell title="Pick Your Version" back={onBack}>
        <div className="font-gc-ui" style={{ paddingTop: 12, paddingBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gc-text-primary)", marginBottom: 6 }}>
            Which version is this?
          </div>
          <div style={{ fontSize: 13, color: "var(--gc-text-muted)", marginBottom: 16 }}>
            We weren{"'"}t sure — tap the card you have to see Market Value.
          </div>
          <VariantPickerStrip
            candidates={preloaded.candidates}
            selectedId={selectedCandidateId}
            onSelect={setSelectedCandidateId}
          />
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell title="Show Result" back={onBack}>
        <div className="font-gc-ui" style={{ paddingTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <LoadingSkeleton width={200} height={280} borderRadius={10} />
          <LoadingSkeleton height={20} />
          <LoadingSkeleton height={56} borderRadius={14} />
          <LoadingSkeleton height={56} borderRadius={14} />
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell title="Show Result" back={onBack}>
        <div style={{ paddingTop: 24 }}>
          <ErrorBanner message="Couldn’t load scan" detail={loadError} onRetry={onBack} retryLabel="Back" />
        </div>
      </Shell>
    );
  }

  return (
    <>
      <Shell title="Show Result" back={onBack}>
        <div className="font-gc-ui" style={{ paddingTop: 12, paddingBottom: 16 }}>
          {/* Card hero */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={player ?? ""}
                loading="eager"
                style={{ width: 200, height: 280, objectFit: "contain", borderRadius: 10, boxShadow: "var(--gc-shadow-md)" }}
              />
            ) : (
              <div style={{ width: 200, height: 280, background: "var(--gc-bg-surface-2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, color: "var(--gc-text-muted)" }}>
                🎴
              </div>
            )}
          </div>

          {/* Identity */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gc-text-primary)" }}>
              {player ?? "Unknown card"}
            </div>
            {catalog && (
              <div style={{ fontSize: 13, color: "var(--gc-text-muted)", marginTop: 4 }}>
                {catalog.set_name} · #{catalog.card_number}
                {catalog.rarity && ` · ${catalog.rarity}`}
              </div>
            )}
          </div>

          {/* Canonical pricing zone */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {/* Market Value */}
            <div style={{ background: "var(--gc-bg-surface-1)", border: "1px solid var(--gc-border-subtle)", borderRadius: "var(--gc-radius-md)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Market Value</span>
                <span className="font-gc-mono" style={{ fontSize: 22, fontWeight: 700, color: marketValue != null ? "var(--gc-brand-gold-500)" : "var(--gc-text-muted)" }}>
                  {fmtUsd(marketValue)}
                </span>
              </div>
              {pricing?.source === "ppt" && (
                <div style={{ fontSize: 10, color: "var(--gc-text-muted)", textAlign: "right", marginTop: 4 }}>
                  PPT estimate
                </div>
              )}
              {pricing?.source === "cardmarket_eur" && (
                <div style={{ fontSize: 10, color: "var(--gc-text-muted)", textAlign: "right", marginTop: 4 }}>
                  EU estimate
                </div>
              )}
            </div>

            {/* Dealer Ask (editable) */}
            <div>
              <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>
                Dealer Ask
              </div>
              <MoneyInput value={askPrice} onChange={setAskPrice} />
            </div>

            {/* Max Buy (read-only) */}
            <div style={{ background: "var(--gc-bg-surface-1)", border: "1px solid var(--gc-border-subtle)", borderRadius: "var(--gc-radius-md)", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                Max Buy
                {tierLabel && <span style={{ marginLeft: 6, fontWeight: 500 }}>· {tierLabel} tier</span>}
              </span>
              <span className="font-gc-mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--gc-text-primary)" }}>
                {fmtUsd(maxBuy)}
              </span>
            </div>

            {/* Verdict */}
            {askPrice > 0 && marketValue != null && (
              <VerdictStrip state={verdictState} detail={verdictDetail} />
            )}
          </div>

          {/* Graded comps — only when grade-worthy (PSA 10 average present) */}
          {compsState.kind === "ok" && compsState.comps.psa10_avg != null && (
            <GradedCompsCard comps={compsState.comps} />
          )}

          {/* Math panel */}
          <div style={{ marginBottom: 20 }}>
            <DecisionMathPanel
              marketValueUsd={marketValue}
              dealerAskUsd={askPrice}
              maxBuyUsd={maxBuy}
              maxBuyTierLabel={tierLabel}
            />
          </div>

          {submitError && (
            <div style={{ marginBottom: 12 }}>
              <ErrorBanner message="Couldn’t record decision" detail={submitError} onDismiss={() => setSubmitError(null)} />
            </div>
          )}

          {/* Action row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <ActionButton
              variant="walk"
              size="md"
              onClick={handleWalk}
              loading={submitting === "walked"}
              disabled={submitting != null && submitting !== "walked"}
            />
            <ActionButton
              variant="negotiate"
              size="md"
              onClick={() => setNegotiateOpen(true)}
              loading={submitting === "negotiated"}
              disabled={submitting != null && submitting !== "negotiated"}
            />
            <ActionButton
              variant="buy"
              size="md"
              onClick={handleBuy}
              loading={submitting === "purchased"}
              disabled={askPrice <= 0 || (submitting != null && submitting !== "purchased")}
            />
          </div>
        </div>
      </Shell>

      <NegotiateModal
        open={negotiateOpen}
        initialOffer={askPrice > 0 ? askPrice : 0}
        onClose={() => setNegotiateOpen(false)}
        onSubmit={handleNegotiateSubmit}
      />

      <Toast
        visible={!!toast}
        message={toast?.msg ?? ""}
        variant={toast?.variant ?? "info"}
        duration={2400}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
