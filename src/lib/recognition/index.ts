/**
 * Card recognition module.
 *
 * Re-exports the public API for image preprocessing, perceptual hashing,
 * distance calculation, confidence banding, name normalization, and cache.
 */

export { normalizeName } from "./normalize";
export { phash, dhash, whash, hashToBytes, hashFromBytes, hashToBytea, hashFromBytea } from "./hashing";
export { hamming64, weightedDistance, HASH_WEIGHTS } from "./distance";
export { bandFromDistance, CONFIDENCE_THRESHOLDS } from "./confidence";
export type { ConfidenceBand } from "./confidence";
export { preprocessImage, CANONICAL_SIZE } from "./preprocess";
export { getOrLoadCache, getCache, setCache, clearCache, CacheLoadError } from "./cache";
export type { CachedCatalogEntry, RecognitionCache } from "./cache";
