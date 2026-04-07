import { describe, it, expect } from "vitest";
import { bandFromDistance, CONFIDENCE_THRESHOLDS } from "./confidence";

describe("bandFromDistance", () => {
  it("returns exact for distance 0", () => {
    expect(bandFromDistance(0)).toBe("exact");
  });

  it("returns exact at threshold boundary (6)", () => {
    expect(bandFromDistance(CONFIDENCE_THRESHOLDS.exact)).toBe("exact");
  });

  it("returns likely just above exact (7)", () => {
    expect(bandFromDistance(7)).toBe("likely");
  });

  it("returns likely at threshold boundary (12)", () => {
    expect(bandFromDistance(CONFIDENCE_THRESHOLDS.likely)).toBe("likely");
  });

  it("returns choose_version just above likely (13)", () => {
    expect(bandFromDistance(13)).toBe("choose_version");
  });

  it("returns choose_version at threshold boundary (20)", () => {
    expect(bandFromDistance(CONFIDENCE_THRESHOLDS.choose_version)).toBe("choose_version");
  });

  it("returns unclear just above choose_version (21)", () => {
    expect(bandFromDistance(21)).toBe("unclear");
  });

  it("returns unclear for max distance (64)", () => {
    expect(bandFromDistance(64)).toBe("unclear");
  });
});
