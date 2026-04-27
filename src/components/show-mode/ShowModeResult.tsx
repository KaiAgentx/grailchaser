"use client";
import { useState, useEffect } from "react";
import { Shell } from "@/components/shell/Shell";
import { ActionButton } from "@/components/atoms/ActionButton";
import { VerdictStrip } from "@/components/atoms/VerdictStrip";
import { MoneyInput } from "@/components/atoms/MoneyInput";
import { LoadingSkeleton } from "@/components/atoms/LoadingSkeleton";
import { ErrorBanner } from "@/components/atoms/ErrorBanner";
import { Toast, type ToastVariant } from "@/components/atoms/Toast";
import { DecisionMathPanel } from "./DecisionMathPanel";
import { NegotiateModal } from "./NegotiateModal";
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

interface Props {
  scanResultId: string;
  showId: string;
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
}

const fmtUsd = (v: number | null) => v != null ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

export function ShowModeResult({ scanResultId, showId, onBack, onDecided }: Props) {
  const [scan, setScan] = useState<ScanResultRow | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow | null>(null);
  const [pricing, setPricing] = useState<PricingResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [askPrice, setAskPrice] = useState(0);
  const [submitting, setSubmitting] = useState<ScanDecision | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant } | null>(null);
  const [negotiateOpen, setNegotiateOpen] = useState(false);

  // Load scan + catalog + pricing in sequence on mount
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

        // 1) Scan result row (RLS-gated)
        const { data: sr, error: srErr } = await sb
          .from("scan_results")
          .select("id, catalog_match_id, catalog_match_name, final_catalog_id, final_catalog_name")
          .eq("id", scanResultId)
          .maybeSingle();
        if (cancelled) return;
        if (srErr || !sr) { setLoadError("Scan result not found."); setLoading(false); return; }
        setScan(sr as ScanResultRow);

        // 2) Catalog row for set/number/image — prefer corrected catalog id
        const catalogId = sr.final_catalog_id ?? sr.catalog_match_id;
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

          // 3) Pricing via /api/tcg/price
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
  }, [scanResultId]);

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
            <div style={{ background: "var(--gc-bg-surface-1)", border: "1px solid var(--gc-border-subtle)", borderRadius: "var(--gc-radius-md)", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Market Value</span>
              <span className="font-gc-mono" style={{ fontSize: 22, fontWeight: 700, color: marketValue != null ? "var(--gc-brand-gold-500)" : "var(--gc-text-muted)" }}>
                {fmtUsd(marketValue)}
              </span>
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
