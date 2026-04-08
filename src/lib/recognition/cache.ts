/**
 * In-memory hash cache for card recognition.
 *
 * - Cache is module-level: each Node.js process has its own copy.
 * - In Vercel production, each serverless instance loads independently on
 *   cold start (~1-3s for 20k Pokemon).
 * - In Next.js dev mode, module state RESETS on file save / hot reload.
 *   First request after save will be slow while cache repopulates.
 * - Memory: ~6MB for 20k Pokemon, roughly doubles when MTG joins.
 * - Cache invalidation: catalog_metadata.catalog_version is checked on
 *   EVERY request (one tiny SELECT, ~5ms). Reload only when version changes.
 * - No external cache (Redis etc) needed for v1.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { hashFromBytea } from "./hashing";

// ─── Types ───

export interface CachedCatalogEntry {
  catalogCardId: string;
  name: string;
  setName: string;
  setCode: string;
  cardNumber: string | null;
  rarity: string | null;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  phash: bigint;
  dhash: bigint;
  whash: bigint;
}

export interface RecognitionCache {
  game: "pokemon" | "mtg" | "one_piece";
  catalogVersion: string;
  loadedAt: number;
  entries: CachedCatalogEntry[];
}

export class CacheLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CacheLoadError";
  }
}

// ─── Module-level state ───

const caches = new Map<string, RecognitionCache>();
const inflight = new Map<string, Promise<RecognitionCache>>();

// ─── Public API ───

/** Synchronous read of the current cache state. No version check. */
export function getCache(game: string): RecognitionCache | undefined {
  return caches.get(game);
}

export function setCache(game: string, cache: RecognitionCache): void {
  caches.set(game, cache);
}

/** Clear one game's cache or all caches. */
export function clearCache(game?: string): void {
  if (game) {
    caches.delete(game);
  } else {
    caches.clear();
  }
}

/**
 * Get the cache for a game, loading it from Supabase if needed.
 * Checks catalog_metadata.catalog_version on every call.
 * Single-flighted: concurrent requests share the same load promise.
 */
export async function getOrLoadCache(
  game: string,
  supabase: SupabaseClient
): Promise<RecognitionCache> {
  // a. Fetch current catalog_version
  const { data: meta, error: metaErr } = await supabase
    .from("catalog_metadata")
    .select("catalog_version")
    .eq("game", game)
    .single();

  if (metaErr || !meta) {
    throw new CacheLoadError(
      `Catalog not yet populated for game=${game}. Run sync first.`
    );
  }

  const currentVersion = meta.catalog_version;
  if (!currentVersion || currentVersion === "0") {
    throw new CacheLoadError(
      `Catalog not yet populated for game=${game}. Run sync first.`
    );
  }

  // b. Fast path: cache exists and version matches
  const existing = caches.get(game);
  if (existing && existing.catalogVersion === currentVersion) {
    return existing;
  }

  // c. Single-flight: share in-progress load
  const pending = inflight.get(game);
  if (pending) return pending;

  // d. Kick off load
  const loadPromise = doFullLoad(game, supabase, currentVersion);
  inflight.set(game, loadPromise);
  try {
    const cache = await loadPromise;
    caches.set(game, cache);
    return cache;
  } finally {
    inflight.delete(game);
  }
}

// ─── Private loader ───

async function doFullLoad(
  game: string,
  supabase: SupabaseClient,
  catalogVersion: string
): Promise<RecognitionCache> {
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("catalog_cards")
      .select(
        "id, name, set_name, set_code, card_number, rarity, image_small_url, image_large_url, catalog_hashes!inner(phash, dhash, whash)"
      )
      .eq("game", game)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new CacheLoadError(
        `Cache load failed at offset ${from}: ${error.message}`
      );
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // Build entries, skipping orphans (empty catalog_hashes)
  const entries: CachedCatalogEntry[] = [];
  for (const row of allRows) {
    const hashes = row.catalog_hashes;
    if (!hashes || !Array.isArray(hashes) || hashes.length === 0) continue;
    const h = hashes[0];
    entries.push({
      catalogCardId: row.id,
      name: row.name,
      setName: row.set_name,
      setCode: row.set_code,
      cardNumber: row.card_number,
      rarity: row.rarity,
      imageSmallUrl: row.image_small_url,
      imageLargeUrl: row.image_large_url,
      phash: hashFromBytea(h.phash),
      dhash: hashFromBytea(h.dhash),
      whash: hashFromBytea(h.whash),
    });
  }

  console.log(
    `[cache] Loaded ${entries.length} entries for game=${game} (version=${catalogVersion})`
  );

  return {
    game: game as RecognitionCache["game"],
    catalogVersion,
    loadedAt: Date.now(),
    entries,
  };
}
