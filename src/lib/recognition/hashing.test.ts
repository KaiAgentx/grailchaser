import { describe, it, expect } from "vitest";
import { phash, dhash, whash, hashToBytes, hashFromBytes, hashToBytea, hashFromBytea } from './hashing';

// Create a deterministic grayscale gradient buffer
function makeGradient(w: number, h: number): Uint8Array {
  const buf = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      buf[y * w + x] = (x + y) % 256;
    }
  }
  return buf;
}

function makeSolid(w: number, h: number, val: number): Uint8Array {
  return new Uint8Array(w * h).fill(val);
}

describe("phash", () => {
  it("is deterministic", () => {
    const buf = makeGradient(64, 64);
    expect(phash(buf, 64, 64)).toBe(phash(buf, 64, 64));
  });

  it("returns a 64-bit bigint", () => {
    const h = phash(makeGradient(64, 64), 64, 64);
    expect(typeof h).toBe("bigint");
    expect(h).toBeGreaterThanOrEqual(0n);
    expect(h).toBeLessThanOrEqual(0xFFFFFFFFFFFFFFFFn);
  });

  it("same image twice produces zero hamming distance", () => {
    const buf = makeGradient(128, 128);
    const h1 = phash(buf, 128, 128);
    const h2 = phash(buf, 128, 128);
    expect(h1 ^ h2).toBe(0n);
  });
});

describe("dhash", () => {
  it("is deterministic", () => {
    const buf = makeGradient(64, 64);
    expect(dhash(buf, 64, 64)).toBe(dhash(buf, 64, 64));
  });

  it("returns a 64-bit bigint", () => {
    const h = dhash(makeGradient(64, 64), 64, 64);
    expect(typeof h).toBe("bigint");
    expect(h).toBeGreaterThanOrEqual(0n);
    expect(h).toBeLessThanOrEqual(0xFFFFFFFFFFFFFFFFn);
  });

  it("same image twice produces zero hamming distance", () => {
    const buf = makeSolid(64, 64, 128);
    expect(dhash(buf, 64, 64) ^ dhash(buf, 64, 64)).toBe(0n);
  });
});

describe("whash", () => {
  it("is deterministic", () => {
    const buf = makeGradient(64, 64);
    expect(whash(buf, 64, 64)).toBe(whash(buf, 64, 64));
  });

  it("returns a 64-bit bigint", () => {
    const h = whash(makeGradient(64, 64), 64, 64);
    expect(typeof h).toBe("bigint");
    expect(h).toBeGreaterThanOrEqual(0n);
    expect(h).toBeLessThanOrEqual(0xFFFFFFFFFFFFFFFFn);
  });

  it("same image twice produces zero hamming distance", () => {
    const buf = makeGradient(32, 32);
    expect(whash(buf, 32, 32) ^ whash(buf, 32, 32)).toBe(0n);
  });
});

describe("hashToBytes / hashFromBytes", () => {
  it("round-trips 0n", () => {
    expect(hashFromBytes(hashToBytes(0n))).toBe(0n);
  });

  it("round-trips 1n", () => {
    expect(hashFromBytes(hashToBytes(1n))).toBe(1n);
  });

  it("round-trips max u64", () => {
    const max = 0xFFFFFFFFFFFFFFFFn;
    expect(hashFromBytes(hashToBytes(max))).toBe(max);
  });

  it("round-trips arbitrary values", () => {
    const vals = [42n, 0xDEADBEEFn, 0x0102030405060708n, 0xABCDEF0123456789n];
    for (const v of vals) {
      expect(hashFromBytes(hashToBytes(v))).toBe(v);
    }
  });

  it("hashToBytes(0n) returns 8 zero bytes", () => {
    const b = hashToBytes(0n);
    expect(b.length).toBe(8);
    expect(Array.from(b)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("hashToBytes(1n) ends with 0x01", () => {
    const b = hashToBytes(1n);
    expect(b[7]).toBe(1);
    expect(b.slice(0, 7).every(v => v === 0)).toBe(true);
  });

  it("hashToBytes(max) returns 8 0xFF bytes", () => {
    const b = hashToBytes(0xFFFFFFFFFFFFFFFFn);
    expect(Array.from(b)).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it("throws on negative bigint", () => {
    expect(() => hashToBytes(-1n)).toThrow("non-negative");
  });

  it("throws on bigint > 2^64 - 1", () => {
    expect(() => hashToBytes(1n << 64n)).toThrow("64 bits");
  });

  it("hashFromBytes throws on wrong length", () => {
    expect(() => hashFromBytes(new Uint8Array(7))).toThrow("8 bytes");
    expect(() => hashFromBytes(new Uint8Array(9))).toThrow("8 bytes");
  });
});
describe('hashToBytea / hashFromBytea', () => {
  it('hashToBytea(0n) returns "\\x0000000000000000"', () => {
    expect(hashToBytea(0n)).toBe('\\x0000000000000000');
  });

  it('hashToBytea(0xFFFFFFFFFFFFFFFFn) returns all f', () => {
    expect(hashToBytea(0xFFFFFFFFFFFFFFFFn)).toBe('\\xffffffffffffffff');
  });

  it('hashToBytea(1n) returns "\\x0000000000000001"', () => {
    expect(hashToBytea(1n)).toBe('\\x0000000000000001');
  });

  it('round-trips through bytea text format', () => {
    const values = [0n, 1n, 0xDEADBEEFn, 0xFFFFFFFFFFFFFFFFn, 0x0123456789ABCDEFn];
    for (const v of values) {
      expect(hashFromBytea(hashToBytea(v))).toBe(v);
    }
  });

  it('hashFromBytea throws on missing \\x prefix', () => {
    expect(() => hashFromBytea('0123456789abcdef')).toThrow(TypeError);
  });

  it('hashFromBytea throws on wrong length', () => {
    expect(() => hashFromBytea('\\xabc')).toThrow(RangeError);
  });
});