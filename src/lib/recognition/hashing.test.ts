import { describe, it, expect } from "vitest";
import { phash, dhash, whash } from "./hashing";

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
