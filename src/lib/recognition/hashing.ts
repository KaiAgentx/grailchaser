/**
 * Perceptual hash functions for card image matching.
 *
 * All three return a 64-bit hash as a bigint.
 * Input buffers are Uint8Array of grayscale pixel data at the specified dimensions.
 *
 * hashToBytes / hashFromBytes convert between bigint and 8-byte big-endian
 * Uint8Array for Postgres BYTEA storage in the catalog_hashes table.
 */

// ─── Helpers ───

/** Nearest-neighbor resize of a grayscale buffer. */
function resizeNearest(src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number): Uint8Array {
  const dst = new Uint8Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.floor(y * srcH / dstH);
    for (let x = 0; x < dstW; x++) {
      const sx = Math.floor(x * srcW / dstW);
      dst[y * dstW + x] = src[sy * srcW + sx];
    }
  }
  return dst;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ─── DCT helpers for phash ───

const COS_TABLE_32: number[][] = [];
for (let i = 0; i < 32; i++) {
  COS_TABLE_32[i] = [];
  for (let j = 0; j < 32; j++) {
    COS_TABLE_32[i][j] = Math.cos((Math.PI / 32) * (j + 0.5) * i);
  }
}

/** 2D DCT on a 32x32 matrix, returns 32x32 coefficient matrix. */
function dct32(matrix: number[][]): number[][] {
  const N = 32;
  const result: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      let sum = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          sum += matrix[i][j] * COS_TABLE_32[u][i] * COS_TABLE_32[v][j];
        }
      }
      result[u][v] = sum;
    }
  }
  return result;
}

/**
 * Perceptual hash (pHash) — captures structural similarity.
 *
 * Resize to 32x32, compute 2D DCT, take top-left 8x8 (excluding DC),
 * compare each value to median, set bits accordingly. 64 bits.
 */
export function phash(grayscaleBuffer: Uint8Array, width: number, height: number): bigint {
  const resized = resizeNearest(grayscaleBuffer, width, height, 32, 32);

  // Build 32x32 matrix
  const matrix: number[][] = Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => resized[y * 32 + x])
  );

  const dctResult = dct32(matrix);

  // Extract top-left 8x8 excluding DC (0,0)
  const values: number[] = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (i === 0 && j === 0) continue;
      values.push(dctResult[i][j]);
    }
  }
  // Take first 64 values
  const use = values.slice(0, 64);
  const med = median(use);

  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (use[i] > med) {
      hash |= 1n << BigInt(63 - i);
    }
  }
  return hash;
}

/**
 * Difference hash (dHash) — captures gradient/edge direction.
 *
 * Resize to 9x8, compare adjacent horizontal pixels.
 * If left pixel > right pixel, set bit. 8 rows × 8 comparisons = 64 bits.
 */
export function dhash(grayscaleBuffer: Uint8Array, width: number, height: number): bigint {
  const resized = resizeNearest(grayscaleBuffer, width, height, 9, 8);

  let hash = 0n;
  let bit = 63;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (resized[y * 9 + x] > resized[y * 9 + x + 1]) {
        hash |= 1n << BigInt(bit);
      }
      bit--;
    }
  }
  return hash;
}

/**
 * Wavelet hash (wHash) — captures texture frequency.
 *
 * Resize to 8x8, compute one level of Haar wavelet transform,
 * threshold against median. 64 bits.
 */
export function whash(grayscaleBuffer: Uint8Array, width: number, height: number): bigint {
  const resized = resizeNearest(grayscaleBuffer, width, height, 8, 8);
  const pixels = Array.from(resized).map(Number);

  // 1D Haar wavelet on rows
  const rowTransformed: number[] = new Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      const a = pixels[y * 8 + x * 2];
      const b = pixels[y * 8 + x * 2 + 1];
      rowTransformed[y * 8 + x] = (a + b) / 2;
      rowTransformed[y * 8 + x + 4] = (a - b) / 2;
    }
  }

  // 1D Haar wavelet on columns
  const result: number[] = new Array(64);
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 4; y++) {
      const a = rowTransformed[y * 2 * 8 + x];
      const b = rowTransformed[(y * 2 + 1) * 8 + x];
      result[y * 8 + x] = (a + b) / 2;
      result[(y + 4) * 8 + x] = (a - b) / 2;
    }
  }

  const med = median(result);

  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (result[i] > med) {
      hash |= 1n << BigInt(63 - i);
    }
  }
  return hash;
}

// ─── Bigint ↔ bytes serialization for Postgres BYTEA ───

const MAX_U64 = (1n << 64n) - 1n;

/**
 * Convert a 64-bit unsigned bigint to an 8-byte big-endian Uint8Array.
 * Suitable for Postgres BYTEA storage in catalog_hashes columns.
 *
 * @throws if hash is negative or exceeds 2^64 - 1
 */
export function hashToBytes(hash: bigint): Uint8Array {
  if (hash < 0n) throw new RangeError("hash must be non-negative");
  if (hash > MAX_U64) throw new RangeError("hash exceeds 64 bits");
  const bytes = new Uint8Array(8);
  let val = hash;
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(val & 0xFFn);
    val >>= 8n;
  }
  return bytes;
}

/**
 * Convert an 8-byte big-endian Uint8Array back to a 64-bit unsigned bigint.
 *
 * @throws if input is not exactly 8 bytes
 */
export function hashFromBytes(bytes: Uint8Array): bigint {
  if (bytes.length !== 8) throw new RangeError("expected exactly 8 bytes, got " + bytes.length);
  let val = 0n;
  for (let i = 0; i < 8; i++) {
    val = (val << 8n) | BigInt(bytes[i]);
  }
  return val;
}

/**
 * Convert a 64-bit hash bigint to Postgres BYTEA text input format (\xHEX).
 * Use this when inserting hashes via supabase-js — passing a raw Uint8Array
 * causes supabase-js to JSON.stringify it as {"0":n,"1":n,...} which is wrong.
 * Returns a string like "\\x0123456789abcdef" (16 hex chars after \x).
 */
export function hashToBytea(hash: bigint): string {
  const bytes = hashToBytes(hash);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return '\\x' + hex;
}

/**
 * Convert a Postgres BYTEA text representation (\xHEX) back to bigint.
 * Used when reading hashes from supabase-js — bytea columns come back as
 * "\\xHEX" strings in PostgREST JSON responses.
 */
export function hashFromBytea(bytea: string): bigint {
  if (typeof bytea !== 'string' || !bytea.startsWith('\\x')) {
    throw new TypeError('hashFromBytea expects a string starting with \\x');
  }
  const hex = bytea.slice(2);
  if (hex.length !== 16) {
    throw new RangeError(`hashFromBytea expected 16 hex chars, got ${hex.length}`);
  }
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return hashFromBytes(bytes);
}