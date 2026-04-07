import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { preprocessImage, CANONICAL_SIZE } from "./preprocess";

describe("preprocessImage", () => {
  it("produces 256x256 = 65536 bytes from a synthetic solid-color image", async () => {
    // Generate a 100x100 solid gray PNG
    const input = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();

    const result = await preprocessImage(input);

    expect(result.width).toBe(CANONICAL_SIZE);
    expect(result.height).toBe(CANONICAL_SIZE);
    expect(result.data.length).toBe(CANONICAL_SIZE * CANONICAL_SIZE);
  });

  it("all bytes are roughly equal for solid-color input", async () => {
    const input = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer();

    const result = await preprocessImage(input);

    // After normalize(), a solid image may not be exactly uniform
    // but all values should be very close (within a few levels)
    const first = result.data[0];
    const allClose = result.data.every(v => Math.abs(v - first) <= 2);
    expect(allClose).toBe(true);
  });

  it("handles non-square input", async () => {
    const input = await sharp({
      create: { width: 300, height: 400, channels: 3, background: { r: 200, g: 100, b: 50 } },
    }).png().toBuffer();

    const result = await preprocessImage(input);
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
    expect(result.data.length).toBe(65536);
  });
});
