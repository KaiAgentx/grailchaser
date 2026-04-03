import { Card } from "@/lib/types";

export interface PullSettings {
  rawThreshold: number;       // default $20
  gradeRatio: number;         // default 5 (PSA 10 must be 5x raw)
  minRawForGrading: number;   // default $5
  borderlineRange: number;    // default 0.2 (20%)
}

export interface PullCard {
  card: Card;
  category: "sellRaw" | "gradeCandidate" | "both" | "borderline" | "noPricing" | "bulk";
  destination: "sell" | "grade";
  sellProfit: number;
  gradeExpectedProfit: number;
  ratio: number;
  included: boolean; // for borderline toggle
}

export interface PullResult {
  sellRaw: PullCard[];
  gradeCandidates: PullCard[];
  both: PullCard[];
  borderline: PullCard[];
  noPricing: PullCard[];
  bulk: PullCard[];
  stats: PullStats;
}

export interface PullStats {
  totalCards: number;
  pullCount: number;
  sellRawCount: number;
  sellRawValue: number;
  gradeCandidateCount: number;
  gradeCandidateValue: number;
  borderlineCount: number;
  bulkCount: number;
  bulkValue: number;
  noPricingCount: number;
}

const DEFAULT_SETTINGS: PullSettings = {
  rawThreshold: 20,
  gradeRatio: 5,
  minRawForGrading: 5,
  borderlineRange: 0.2,
};

function calcGradeExpectedProfit(card: Card, costBasis: number): number {
  const gv = card.graded_values || { "10": 0, "9": 0, "8": 0, "7": 0 };
  const expected = gv["10"] * 0.15 + gv["9"] * 0.35 + gv["8"] * 0.30 + gv["7"] * 0.20;
  const fees = expected * 0.1325;
  const shipping = 4.50;
  const gradingCost = 25;
  return +(expected - fees - shipping - gradingCost - costBasis).toFixed(2);
}

function calcSellProfit(card: Card): number {
  const rv = card.raw_value || 0;
  const fees = rv * 0.1325 + 0.30;
  const shipping = rv >= 20 ? 4.50 : 1.05;
  return +(rv - fees - shipping - (card.cost_basis || 0)).toFixed(2);
}

export function analyzePull(cards: Card[], settings: Partial<PullSettings> = {}): PullResult {
  const s = { ...DEFAULT_SETTINGS, ...settings };

  const sellRaw: PullCard[] = [];
  const gradeCandidates: PullCard[] = [];
  const both: PullCard[] = [];
  const borderline: PullCard[] = [];
  const noPricing: PullCard[] = [];
  const bulk: PullCard[] = [];

  for (const card of cards) {
    const rv = card.raw_value || 0;
    const gv10 = card.graded_values?.["10"] || 0;
    const ratio = rv > 0 ? +(gv10 / rv).toFixed(1) : 0;
    const sellProfit = calcSellProfit(card);
    const gradeProfit = calcGradeExpectedProfit(card, card.cost_basis || 0);

    const base: Omit<PullCard, "category" | "destination" | "included"> = { card, sellProfit, gradeExpectedProfit: gradeProfit, ratio };

    // No pricing
    if (!rv || rv === 0) {
      noPricing.push({ ...base, category: "noPricing", destination: "sell", included: false });
      continue;
    }

    const meetsSell = rv >= s.rawThreshold;
    const meetsGrade = ratio >= s.gradeRatio && rv >= s.minRawForGrading;

    if (meetsSell && meetsGrade) {
      both.push({ ...base, category: "both", destination: "grade", included: true });
    } else if (meetsSell) {
      sellRaw.push({ ...base, category: "sellRaw", destination: "sell", included: true });
    } else if (meetsGrade) {
      gradeCandidates.push({ ...base, category: "gradeCandidate", destination: "grade", included: true });
    } else {
      // Check borderline
      const nearSell = rv >= s.rawThreshold * (1 - s.borderlineRange);
      const nearGrade = ratio >= s.gradeRatio * (1 - s.borderlineRange) && rv >= s.minRawForGrading * (1 - s.borderlineRange);
      if (nearSell || nearGrade) {
        borderline.push({ ...base, category: "borderline", destination: nearGrade ? "grade" : "sell", included: false });
      } else {
        bulk.push({ ...base, category: "bulk", destination: "sell", included: false });
      }
    }
  }

  // Sort each by position
  const byPos = (a: PullCard, b: PullCard) => (a.card.storage_position || 0) - (b.card.storage_position || 0);
  sellRaw.sort(byPos);
  gradeCandidates.sort(byPos);
  both.sort(byPos);
  borderline.sort(byPos);
  bulk.sort(byPos);

  const pullCount = sellRaw.length + gradeCandidates.length + both.length + borderline.filter(b => b.included).length;

  return {
    sellRaw, gradeCandidates, both, borderline, noPricing, bulk,
    stats: {
      totalCards: cards.length,
      pullCount,
      sellRawCount: sellRaw.length,
      sellRawValue: sellRaw.reduce((s, c) => s + (c.card.raw_value || 0), 0),
      gradeCandidateCount: gradeCandidates.length,
      gradeCandidateValue: gradeCandidates.reduce((s, c) => s + (c.card.raw_value || 0), 0),
      borderlineCount: borderline.length,
      bulkCount: bulk.length,
      bulkValue: bulk.reduce((s, c) => s + (c.card.raw_value || 0), 0),
      noPricingCount: noPricing.length,
    },
  };
}
