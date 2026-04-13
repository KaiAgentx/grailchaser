/**
 * Typed shapes for TCG recognition API responses.
 */

export interface VisionResult {
  name: string | null;
  number: string | null;
  set: string | null;
  edition: "1st" | "unlimited";
  finish: "holo" | "reverse_holo" | "non_holo";
  confidence: "high" | "medium" | "low";
}

export interface CandidateCard {
  rank: number;
  catalogCardId: string;
  name: string;
  setName: string;
  setCode: string;
  cardNumber: string | null;
  rarity: string | null;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  weightedDistance: number;
  distanceBreakdown: { phash: number; dhash: number; whash: number };
}

export interface RecognitionResult {
  confidenceBand: "exact" | "likely" | "choose_version" | "unclear";
  topDistance: number;
  candidates: CandidateCard[];
}

export interface RecognitionSuccess {
  ok: true;
  method: "vision" | "hash";
  visionResult: VisionResult;
  result: RecognitionResult;
  scan_session_id: string | null;
  scan_result_id: string | null;
  latencyMs?: number;
  timing?: { preprocessMs: number; hashMs: number; cacheMs: number; matchMs: number };
}

export interface RecognitionError {
  ok: false;
  error: string;
  message?: string;
}

export type RecognitionResponse = RecognitionSuccess | RecognitionError;
