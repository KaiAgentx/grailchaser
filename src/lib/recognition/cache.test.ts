import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrLoadCache, clearCache, getCache, CacheLoadError } from "./cache";

// ─── Mock helpers ───

function makeMockSupabase(metaVersion: string | null, cardRows: any[]) {
  const PAGE_SIZE = 1000;
  return {
    from: vi.fn((table: string) => {
      if (table === "catalog_metadata") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: metaVersion ? { catalog_version: metaVersion } : null,
                error: metaVersion === null ? { message: "not found" } : null,
              })),
            })),
          })),
        };
      }
      if (table === "catalog_cards") {
        let callCount = 0;
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              range: vi.fn((from: number, to: number) => {
                callCount++;
                const slice = cardRows.slice(from, to + 1);
                return { data: slice, error: null };
              }),
            })),
          })),
        };
      }
      return { select: vi.fn() };
    }),
  } as any;
}

function makeCardRow(id: string, name: string, phash = "\\x0102030405060708") {
  return {
    id,
    name,
    set_name: "Test Set",
    set_code: "test1",
    card_number: "1",
    rarity: "Common",
    image_small_url: "https://example.com/small.jpg",
    image_large_url: "https://example.com/large.jpg",
    catalog_hashes: [{ phash, dhash: phash, whash: phash }],
  };
}

// ─── Tests ───

beforeEach(() => {
  clearCache();
});

describe("getOrLoadCache", () => {
  it("loads from supabase on first call", async () => {
    const rows = [makeCardRow("c1", "Pikachu"), makeCardRow("c2", "Charizard")];
    const sb = makeMockSupabase("v1", rows);
    const cache = await getOrLoadCache("pokemon", sb);
    expect(cache.entries.length).toBe(2);
    expect(cache.catalogVersion).toBe("v1");
    expect(cache.entries[0].name).toBe("Pikachu");
    expect(sb.from).toHaveBeenCalled();
  });

  it("returns cached entry without re-querying on second call (same version)", async () => {
    const rows = [makeCardRow("c1", "Pikachu")];
    const sb = makeMockSupabase("v1", rows);
    await getOrLoadCache("pokemon", sb);

    // Reset mock call count
    sb.from.mockClear();
    const cache2 = await getOrLoadCache("pokemon", sb);
    expect(cache2.entries.length).toBe(1);
    // from() is called once for catalog_metadata version check, but NOT for catalog_cards
    expect(sb.from).toHaveBeenCalledTimes(1);
  });

  it("reloads when catalog_version changes", async () => {
    const rows1 = [makeCardRow("c1", "Pikachu")];
    const sb1 = makeMockSupabase("v1", rows1);
    await getOrLoadCache("pokemon", sb1);

    clearCache();
    const rows2 = [makeCardRow("c1", "Pikachu"), makeCardRow("c2", "Raichu")];
    const sb2 = makeMockSupabase("v2", rows2);
    const cache2 = await getOrLoadCache("pokemon", sb2);
    expect(cache2.entries.length).toBe(2);
    expect(cache2.catalogVersion).toBe("v2");
  });

  it("throws CacheLoadError when metadata is missing", async () => {
    const sb = makeMockSupabase(null, []);
    await expect(getOrLoadCache("pokemon", sb)).rejects.toThrow(CacheLoadError);
  });

  it("throws CacheLoadError when version is '0'", async () => {
    const sb = makeMockSupabase("0", []);
    await expect(getOrLoadCache("pokemon", sb)).rejects.toThrow(CacheLoadError);
  });

  it("skips orphan rows where catalog_hashes is empty", async () => {
    const orphan = { ...makeCardRow("c1", "Orphan"), catalog_hashes: [] };
    const good = makeCardRow("c2", "Pikachu");
    const sb = makeMockSupabase("v1", [orphan, good]);
    const cache = await getOrLoadCache("pokemon", sb);
    expect(cache.entries.length).toBe(1);
    expect(cache.entries[0].name).toBe("Pikachu");
  });

  it("converts bytea strings to bigint via hashFromBytea", async () => {
    const row = makeCardRow("c1", "Test", "\\xfcfcd1c24c64c522");
    const sb = makeMockSupabase("v1", [row]);
    const cache = await getOrLoadCache("pokemon", sb);
    expect(cache.entries[0].phash).toBe(0xfcfcd1c24c64c522n);
  });
});

describe("clearCache", () => {
  it("clears specific game", async () => {
    const sb = makeMockSupabase("v1", [makeCardRow("c1", "Pikachu")]);
    await getOrLoadCache("pokemon", sb);
    expect(getCache("pokemon")).toBeDefined();
    clearCache("pokemon");
    expect(getCache("pokemon")).toBeUndefined();
  });

  it("clears all when no game specified", async () => {
    const sb = makeMockSupabase("v1", [makeCardRow("c1", "Pikachu")]);
    await getOrLoadCache("pokemon", sb);
    clearCache();
    expect(getCache("pokemon")).toBeUndefined();
  });
});
