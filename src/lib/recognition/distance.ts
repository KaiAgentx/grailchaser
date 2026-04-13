/**
 * Hash distance and weighted scoring for perceptual hash matching.
 */

/**
 * Weights for combining the three hash distances into a single score.
 *
 * - phash (0.4): Perceptual hash — captures structural similarity via a
 *   reduced DCT. Most robust to resize and minor color shifts. Weighted
 *   equally with dhash because card art structure is the primary signal.
 *
 * - dhash (0.4): Difference hash — gradient-based, compares adjacent pixel
 *   brightness. Tolerant to overall brightness/contrast changes (phone
 *   cameras in varying light). Weighted equally with phash for a balanced
 *   structural + gradient signal.
 *
 * - whash (0.2): Wavelet hash — frequency-domain decomposition, best at
 *   capturing color/texture patterns. Lower weight because Pokémon cards
 *   share many texture patterns (holofoil, borders), making this noisier
 *   than the structural hashes for card identification.
 *
 * Sum = 1.0. Output range: 0 (identical) to 64 (completely different).
 */
export const HASH_WEIGHTS = { phash: 0.4, dhash: 0.4, whash: 0.2 } as const;

/**
 * Hamming distance between two 64-bit hashes.
 * XOR the two values and count set bits (popcount).
 * Returns 0 (identical) to 64 (completely different).
 */
export function hamming64(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

interface HashTriple {
  phash: bigint;
  dhash: bigint;
  whash: bigint;
}

/**
 * Weighted distance between two hash triples.
 * Applies HASH_WEIGHTS to the individual hamming distances.
 * Returns a value roughly in the range 0–64.
 */
export function weightedDistance(a: HashTriple, b: HashTriple): number {
  const pd = hamming64(a.phash, b.phash);
  const dd = hamming64(a.dhash, b.dhash);
  const wd = hamming64(a.whash, b.whash);
  return pd * HASH_WEIGHTS.phash + dd * HASH_WEIGHTS.dhash + wd * HASH_WEIGHTS.whash;
}
