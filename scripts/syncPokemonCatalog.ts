#!/usr/bin/env tsx
/**
 * Pokémon catalog sync.
 *
 * Idempotent and resumable: safe to re-run, will skip cards already
 * synced. Uses the Pokémon TCG API and writes to catalog_cards +
 * catalog_hashes via the Supabase service role key.
 *
 * Estimated runtime for full sync: 3–5 hours (sequential, ~16k cards)
 * Test with: npm run sync:pokemon -- --max-sets 2   (~5 minutes)
 * Resume:    just re-run; already-synced cards are skipped
 *
 * Run: npm run sync:pokemon
 * Optional flags:
 *   --max-sets <n>      Process only the first N sets (testing)
 *   --resume-from <id>  Skip sets until reaching this set id
 *   --dry-run           Process and log but don't write to DB
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";
import { normalizeName } from "../src/lib/recognition/normalize";
import { preprocessImage } from "../src/lib/recognition/preprocess";
import { phash, dhash, whash, hashToBytea } from "../src/lib/recognition/hashing";

// ─── Env checks ───

const POKEMONTCG_API_KEY = process.env.POKEMONTCG_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!POKEMONTCG_API_KEY) { console.error("Missing POKEMONTCG_API_KEY in environment"); process.exit(1); }
if (!SUPABASE_URL) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL in environment"); process.exit(1); }
if (!SUPABASE_SERVICE_KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY in environment"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── CLI flags ───

const args = process.argv.slice(2);
const flagIndex = (f: string) => args.indexOf(f);
const maxSets = flagIndex("--max-sets") >= 0 ? parseInt(args[flagIndex("--max-sets") + 1]) : Infinity;
const resumeFrom = flagIndex("--resume-from") >= 0 ? args[flagIndex("--resume-from") + 1] : null;
const dryRun = args.includes("--dry-run");

// ─── Constants ───

const SYNC_VERSION = new Date().toISOString();
const API_BASE = "https://api.pokemontcg.io/v2";
const RATE_LIMIT_MS = 200; // 5 requests/sec

// ─── Rate limiter ───

let lastApiCall = 0;

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pokemonApiFetch(path: string): Promise<any> {
  const now = Date.now();
  const elapsed = now - lastApiCall;
  if (elapsed < RATE_LIMIT_MS) {
    await delay(RATE_LIMIT_MS - elapsed);
  }
  lastApiCall = Date.now();

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "X-Api-Key": POKEMONTCG_API_KEY! },
  });
  if (!res.ok) {
    throw new Error(`Pokemon API ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

// ─── Helpers ───

function parseReleaseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // Pokemon API returns "YYYY/MM/DD"
  const m = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ─── Main sync ───

async function main() {
  const startTime = Date.now();

  console.log("═".repeat(60));
  console.log("Pokémon Catalog Sync");
  console.log("═".repeat(60));
  console.log(`Sync version: ${SYNC_VERSION}`);
  console.log(`Max sets: ${maxSets === Infinity ? "all" : maxSets}`);
  console.log(`Resume from: ${resumeFrom || "beginning"}`);
  console.log(`Dry run: ${dryRun}`);
  console.log();

  // a. Fetch all sets
  console.log("Fetching sets...");
  let allSets: any[] = [];
  let page = 1;
  while (true) {
    const data = await pokemonApiFetch(`/sets?pageSize=250&page=${page}`);
    allSets = allSets.concat(data.data || []);
    if (allSets.length >= (data.totalCount || 0)) break;
    page++;
  }
  console.log(`Found ${allSets.length} sets`);

  // b. Sort by release date ascending
  allSets.sort((a: any, b: any) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));

  // c. Apply filters
  let sets = allSets;
  if (resumeFrom) {
    const idx = sets.findIndex((s: any) => s.id === resumeFrom);
    if (idx < 0) {
      console.error(`Set "${resumeFrom}" not found. Available: ${sets.map((s: any) => s.id).join(", ")}`);
      process.exit(1);
    }
    sets = sets.slice(idx);
    console.log(`Resuming from set ${resumeFrom} (${sets.length} sets remaining)`);
  }
  if (maxSets < sets.length) {
    sets = sets.slice(0, maxSets);
    console.log(`Limited to ${maxSets} sets`);
  }

  // Counters
  let totalProcessed = 0, totalSkipped = 0, totalErrors = 0, totalNoImage = 0, totalFetchFail = 0;

  // d. Process each set
  for (let si = 0; si < sets.length; si++) {
    const set = sets[si];
    console.log(`\n[set ${si + 1}/${sets.length}] ${set.name} (${set.id}) — starting`);

    // Fetch all cards in the set
    let setCards: any[] = [];
    let cardPage = 1;
    while (true) {
      const data = await pokemonApiFetch(`/cards?q=set.id:${set.id}&pageSize=250&page=${cardPage}`);
      setCards = setCards.concat(data.data || []);
      if (setCards.length >= (data.totalCount || 0)) break;
      cardPage++;
    }

    let setProcessed = 0, setSkipped = 0, setErrors = 0;

    for (let ci = 0; ci < setCards.length; ci++) {
      const card = setCards[ci];

      try {
        // i. Check if already synced
        if (!dryRun) {
          const { data: existing } = await supabase
            .from("catalog_cards")
            .select("id")
            .eq("game", "pokemon")
            .eq("provider", "pokemon_tcg_api")
            .eq("printing_id", card.id)
            .maybeSingle();

          if (existing) {
            const { data: hashRow } = await supabase
              .from("catalog_hashes")
              .select("id")
              .eq("catalog_card_id", existing.id)
              .eq("image_side", "front")
              .maybeSingle();

            if (hashRow) {
              setSkipped++;
              totalSkipped++;
              continue;
            }
          }
        }

        // ii. Upsert catalog_cards
        const cardRow = {
          game: "pokemon",
          provider: "pokemon_tcg_api",
          canonical_card_id: card.id,
          printing_id: card.id,
          name: card.name,
          normalized_name: normalizeName(card.name),
          set_name: card.set?.name ?? null,
          set_code: card.set?.id ?? null,
          series: card.set?.series ?? null,
          card_number: card.number ?? null,
          rarity: card.rarity ?? null,
          finish: null,
          language: "en",
          release_date: parseReleaseDate(card.set?.releaseDate),
          image_small_url: card.images?.small ?? null,
          image_large_url: card.images?.large ?? null,
          metadata: card,
          catalog_version: SYNC_VERSION,
        };

        if (dryRun) {
          console.log(`  [dry-run] Would upsert: ${card.id} (${card.name})`);
          setProcessed++;
          totalProcessed++;
          continue;
        }

        const { data: upserted, error: upsertErr } = await supabase
          .from("catalog_cards")
          .upsert(cardRow, { onConflict: "game,provider,printing_id" })
          .select("id")
          .single();

        if (upsertErr || !upserted) {
          console.error(`  ✗ Upsert failed for ${card.id}: ${upsertErr?.message}`);
          setErrors++;
          totalErrors++;
          continue;
        }

        const catalogRowId = upserted.id;

        // iii. Check image
        if (!card.images?.small) {
          console.warn(`  ⚠ No image for ${card.id}`);
          totalNoImage++;
          setProcessed++;
          totalProcessed++;
          continue;
        }

        // iv. Fetch image
        let imgBuffer: Buffer;
        try {
          const imgRes = await fetch(card.images.small);
          if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
          imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        } catch (fetchErr: any) {
          console.warn(`  ⚠ Image fetch failed for ${card.id}: ${fetchErr.message}`);
          totalFetchFail++;
          setProcessed++;
          totalProcessed++;
          continue;
        }

        // v. Preprocess and hash
        const { data: pixels, width, height } = await preprocessImage(imgBuffer);
        const ph = phash(pixels, width, height);
        const dh = dhash(pixels, width, height);
        const wh = whash(pixels, width, height);

        // vi. Insert catalog_hashes
        const { error: hashErr } = await supabase.from("catalog_hashes").insert({
          catalog_card_id: catalogRowId,
          image_side: "front",
          phash: hashToBytea(ph),
          dhash: hashToBytea(dh),
          whash: hashToBytea(wh),
          image_width: width,
          image_height: height,
        });

        if (hashErr) {
          console.error(`  ✗ Hash insert failed for ${card.id}: ${hashErr.message}`);
          setErrors++;
          totalErrors++;
          continue;
        }

        setProcessed++;
        totalProcessed++;

        // viii. Progress
        if ((setProcessed + setSkipped) % 25 === 0) {
          console.log(`  ${setProcessed + setSkipped}/${setCards.length} cards processed in this set`);
        }
      } catch (err: any) {
        console.error(`  ✗ Error on ${card.id}: ${err.message}`);
        setErrors++;
        totalErrors++;
      }
    }

    console.log(`[set ${si + 1}/${sets.length}] ${set.name} done — processed: ${setProcessed}, skipped: ${setSkipped}, errors: ${setErrors}`);
  }

  // f. Update catalog_metadata
  if (!dryRun) {
    const { count } = await supabase.from("catalog_cards").select("id", { count: "exact", head: true }).eq("game", "pokemon");
    await supabase.from("catalog_metadata").update({
      catalog_version: SYNC_VERSION,
      last_synced_at: new Date().toISOString(),
      last_sync_status: "success",
      total_cards: count || 0,
    }).eq("game", "pokemon");
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "═".repeat(60));
  console.log("Sync complete");
  console.log(`  Sets:       ${sets.length}`);
  console.log(`  Processed:  ${totalProcessed}`);
  console.log(`  Skipped:    ${totalSkipped}`);
  console.log(`  Errors:     ${totalErrors}`);
  console.log(`  No image:   ${totalNoImage}`);
  console.log(`  Fetch fail: ${totalFetchFail}`);
  console.log(`  Duration:   ${elapsed}s`);
  console.log("═".repeat(60));
}

// SIGINT handler
process.on("SIGINT", () => {
  console.log("\nInterrupted. Current progress saved. Re-run to resume.");
  process.exit(0);
});

main().catch(async (err) => {
  console.error("\nFatal error:", err);
  try {
    await supabase.from("catalog_metadata").update({
      last_sync_status: "failed",
      last_sync_message: err.message?.substring(0, 500),
    }).eq("game", "pokemon");
  } catch {}
  process.exit(1);
});
