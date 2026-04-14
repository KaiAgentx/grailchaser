/**
 * Shared TCG variant helpers — used by TcgResultScreen and TcgCardDetail.
 */
import type { VisionResult } from "@/types/tcg";

export const VARIANT_LABELS: Record<string, string> = {
  holofoil: "Holo", reverseHolofoil: "Reverse Holo", normal: "Non-Holo",
  "1stEditionHolofoil": "1st Edition", unlimitedHolofoil: "Unlimited Holo",
  "1stEditionNormal": "1st Ed Non-Holo", unlimitedNormal: "Non-Holo",
};

export function autoSelectVariant(pricing: any, visionResult: VisionResult | null): string {
  const available = Object.keys(pricing?.allPrices || {});
  if (available.length === 0) return pricing?.priceType || "";
  if (available.length === 1) return available[0];
  if (visionResult?.edition === "1st") { const f = available.find((t: string) => t.includes("1stEdition")); if (f) return f; }
  if (visionResult?.finish === "reverse_holo") { if (available.includes("reverseHolofoil")) return "reverseHolofoil"; }
  if (visionResult?.finish === "non_holo") { const f = available.find((t: string) => t.includes("Normal") || t === "normal"); if (f) return f; }
  return pricing?.priceType || available[0];
}

export const fmtPrice = (v: number | null) => v != null ? `$${v.toFixed(2)}` : "—";

export function fmtDate(s: string): string {
  const d = new Date(s.replace(/\//g, "-"));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
