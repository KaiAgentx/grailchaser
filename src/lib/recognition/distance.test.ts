import { describe, it, expect } from "vitest";
import { hamming64, weightedDistance, HASH_WEIGHTS } from "./distance";

describe("hamming64", () => {
  it("returns 0 for identical hashes", () => {
    expect(hamming64(0n, 0n)).toBe(0);
    expect(hamming64(0xABCDn, 0xABCDn)).toBe(0);
  });

  it("returns 64 for completely opposite hashes", () => {
    expect(hamming64(0xFFFFFFFFFFFFFFFFn, 0n)).toBe(64);
  });

  it("counts single bit differences", () => {
    expect(hamming64(0b1n, 0b0n)).toBe(1);
    expect(hamming64(0b11n, 0b01n)).toBe(1);
  });
});

describe("weightedDistance", () => {
  const zero = { phash: 0n, dhash: 0n, whash: 0n };
  const ones = { phash: 0xFFFFFFFFFFFFFFFFn, dhash: 0xFFFFFFFFFFFFFFFFn, whash: 0xFFFFFFFFFFFFFFFFn };

  it("returns 0 for identical hash triples", () => {
    expect(weightedDistance(zero, zero)).toBe(0);
  });

  it("returns ~64 for completely different hash triples", () => {
    const d = weightedDistance(zero, ones);
    // 64*0.4 + 64*0.4 + 64*0.2 = 25.6 + 25.6 + 12.8 = 64
    expect(d).toBeCloseTo(64, 1);
  });

  it("weights sum to 1.0", () => {
    expect(HASH_WEIGHTS.phash + HASH_WEIGHTS.dhash + HASH_WEIGHTS.whash).toBeCloseTo(1.0);
  });
});
