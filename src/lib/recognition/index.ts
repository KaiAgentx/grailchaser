/**
 * Card recognition module.
 *
 * Re-exports the public API for image preprocessing, perceptual hashing,
 * distance calculation, confidence banding, and name normalization.
 */

export { normalizeName } from "./normalize";
export { phash, dhash, whash, hashToBytes, hashFromBytes } from "./hashing";
export { hamming64, weightedDistance, HASH_WEIGHTS } from "./distance";
export { bandFromDistance, CONFIDENCE_THRESHOLDS } from "./confidence";
export type { ConfidenceBand } from "./confidence";
export { preprocessImage, CANONICAL_SIZE } from "./preprocess";
