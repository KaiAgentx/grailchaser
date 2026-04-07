/**
 * Image preprocessing for perceptual hashing.
 *
 * TODO (Phase 1B): Add contour detection and perspective correction.
 * Deferred until benchmark images exist to validate against.
 * Current pipeline uses centered crop only (sharp fit:cover).
 */

import sharp from "sharp";

/** Canonical square size for all preprocessed images. */
export const CANONICAL_SIZE = 256;

/**
 * Preprocess a card image for hashing.
 *
 * Pipeline: decode → centered square crop → resize to 256×256 →
 * grayscale → normalize contrast → extract raw pixel data.
 *
 * @param input — raw image bytes (any format sharp supports)
 * @returns grayscale pixel data as Uint8Array of length CANONICAL_SIZE²
 */
export async function preprocessImage(
  input: Buffer | Uint8Array
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);

  const { data, info } = await sharp(buf)
    .resize(CANONICAL_SIZE, CANONICAL_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .grayscale()
    .normalize()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}
