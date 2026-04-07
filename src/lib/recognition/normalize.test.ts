import { describe, it, expect } from "vitest";
import { normalizeName } from "./normalize";

describe("normalizeName", () => {
  it("lowercases ASCII", () => {
    expect(normalizeName("CHARIZARD")).toBe("charizard");
  });

  it("strips accents (Pokémon → pokemon)", () => {
    expect(normalizeName("Pokémon")).toBe("pokemon");
  });

  it("strips punctuation", () => {
    expect(normalizeName("Pokémon  Card #25!")).toBe("pokemon card 25");
  });

  it("handles colons and special chars", () => {
    expect(normalizeName("Magic: The Gathering")).toBe("magic the gathering");
  });

  it("handles accented multi-word (café)", () => {
    expect(normalizeName("Café Society")).toBe("cafe society");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeName("a   b    c")).toBe("a b c");
  });

  it("preserves numbers", () => {
    expect(normalizeName("Card 123 ABC")).toBe("card 123 abc");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeName("")).toBe("");
  });
});
