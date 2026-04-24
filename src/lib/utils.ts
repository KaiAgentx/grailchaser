import { Platform, GradingCompany } from "./types";

// ─── Tier system (single source of truth) ───

export type Tier = 'Unpriced' | 'Bulk' | 'Low' | 'Mid' | 'High';

export function calcTier(rawValue: number | null | undefined): Tier {
  if (rawValue === null || rawValue === undefined) return 'Unpriced';
  if (rawValue < 1) return 'Bulk';
  if (rawValue < 5) return 'Low';
  if (rawValue < 50) return 'Mid';
  return 'High';
}

export const TIER_COLORS: Record<Tier, string> = {
  Unpriced: '#94a3b8',
  Bulk:     '#6b7280',
  Low:      '#9ca3af',
  Mid:      '#3b82f6',
  High:     '#d4a017',
};

export const TIER_LABEL: Record<Tier, string> = {
  Unpriced: 'Unpriced',
  Bulk: 'Bulk', Low: 'Low', Mid: 'Mid', High: 'High',
};

export const TIER_RANK: Record<Tier, number> = {
  High: 0, Mid: 1, Low: 2, Bulk: 3, Unpriced: 4,
};

export const today = () => new Date().toISOString().slice(0, 10);

export const PLATFORMS: Platform[] = [
  { name: "eBay", feeRate: 0.1325, fixedFee: 0, paymentFee: 0, paymentFixed: 0.30, pros: ["Largest audience", "Best for high-value"], cons: ["High fees", "Returns"] },
  { name: "Shopify", feeRate: 0, fixedFee: 0, paymentFee: 0.029, paymentFixed: 0.30, pros: ["Own your store", "Low fees"], cons: ["Drive own traffic"] },
  { name: "TCGPlayer", feeRate: 0.1089, fixedFee: 0, paymentFee: 0, paymentFixed: 0.30, pros: ["Card-specific audience"], cons: ["API restricted"] },
  { name: "Whatnot", feeRate: 0.08, fixedFee: 0, paymentFee: 0.029, paymentFixed: 0.30, pros: ["Live selling", "Hype factor"], cons: ["Need followers"] },
  { name: "COMC", feeRate: 0.05, fixedFee: 0.25, paymentFee: 0, paymentFixed: 0, pros: ["They ship for you"], cons: ["Slow", "Fees add up"] },
  { name: "Mercari", feeRate: 0.10, fixedFee: 0, paymentFee: 0, paymentFixed: 0, pros: ["Easy listing"], cons: ["Lower prices"] },
  { name: "Card Show", feeRate: 0, fixedFee: 0, paymentFee: 0, paymentFixed: 0, pros: ["No fees", "Cash"], cons: ["Table cost", "Travel"] },
  { name: "FB Groups", feeRate: 0, fixedFee: 0, paymentFee: 0.029, paymentFixed: 0.30, pros: ["No platform fees"], cons: ["Trust issues", "Manual"] },
];

export const GRADING_COMPANIES: GradingCompany[] = [
  { name: "PSA", fee: 24.99, turnaround: "65 business days", premium: 1.0 },
  { name: "BGS", fee: 14.95, turnaround: "50 business days", premium: 0.85 },
  { name: "CGC", fee: 15.00, turnaround: "45 business days", premium: 0.80 },
  { name: "SGC", fee: 9.00, turnaround: "30 business days", premium: 0.70 },
];

export function calcNet(price: number, platform: Platform): number {
  const platformFee = price * platform.feeRate + platform.fixedFee;
  const paymentFee = price * platform.paymentFee + platform.paymentFixed;
  return +(price - platformFee - paymentFee).toFixed(2);
}

export function calcShipping(price: number): number {
  if (price >= 50) return 5.50;
  if (price >= 20) return 4.50;
  return 1.05;
}

// calcTier is defined above with the Tier type

export function shouldFlagForGrading(rawValue: number, gemProb: number): boolean {
  if (rawValue < 10) return false;
  const potentialGraded = rawValue * 3;
  const gradingCost = 25;
  const expectedProfit = (potentialGraded * gemProb) - gradingCost;
  return expectedProfit > rawValue * 0.3;
}

export function gradingROI(rawValue: number, gradedValues: Record<string, number>, gemProb: number, company: GradingCompany): {
  expectedValue: number; cost: number; profit: number; roi: number;
} {
  const expected = (gradedValues["10"] || 0) * gemProb +
    (gradedValues["9"] || 0) * 0.35 +
    (gradedValues["8"] || 0) * 0.30 +
    (gradedValues["7"] || 0) * (1 - gemProb - 0.65);
  const cost = company.fee + 4.50;
  const profit = expected - rawValue - cost;
  const roi = cost > 0 ? (profit / cost) * 100 : 0;
  return { expectedValue: +expected.toFixed(2), cost: +cost.toFixed(2), profit: +profit.toFixed(2), roi: +roi.toFixed(1) };
}

export function generateEbayTitle(card: any): string {
  return [card.year, card.brand, card.set,
    card.parallel !== "Base" ? card.parallel : "",
    card.player,
    card.is_rc ? "RC Rookie" : "", card.is_auto ? "Auto" : "",
    card.is_numbered ? `/${card.numbered_to}` : "",
    card.card_number, card.sport,
  ].filter(Boolean).join(" ").slice(0, 80);
}

export function exportToCSV(cards: any[]): string {
  const headers = ["player","sport","team","year","brand","set","parallel","card_number","is_rc","condition","raw_value","cost_basis","tier","status","storage_box","storage_row","storage_position","listed_platform","listed_price","sold","sold_price","sold_platform","grading_company","graded_grade","notes","date_added"];
  const rows = cards.map(c => headers.map(h => {
    const v = c[h]; return typeof v === "string" && v.includes(",") ? `"${v}"` : v ?? "";
  }).join(","));
  return [headers.join(","), ...rows].join("\n");
}
