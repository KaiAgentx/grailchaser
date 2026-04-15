/**
 * Backfill catalog_sets from the Pokémon TCG API.
 * Uses printedTotal (NOT row count) for accurate set sizes.
 *
 * Run: npx tsx scripts/backfill-catalog-sets-pokemon.ts
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   POKEMONTCG_API_KEY
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POKEMONTCG_API_KEY = process.env.POKEMONTCG_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !POKEMONTCG_API_KEY) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POKEMONTCG_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface PokemonTcgSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string; // "YYYY/MM/DD"
  ptcgoCode?: string;
  images?: { symbol?: string; logo?: string };
}

async function main() {
  console.log("Fetching Pokémon sets from API...");

  const res = await fetch("https://api.pokemontcg.io/v2/sets", {
    headers: { "X-Api-Key": POKEMONTCG_API_KEY! },
  });

  if (!res.ok) {
    console.error(`API returned ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const { data: sets }: { data: PokemonTcgSet[] } = await res.json();
  console.log(`Fetched ${sets.length} sets from Pokémon TCG API`);

  // Upsert each set
  let upsertCount = 0;
  let errorCount = 0;

  for (const set of sets) {
    const codeAliases = [...new Set([set.id, set.ptcgoCode, set.ptcgoCode ? `${set.ptcgoCode} EN` : null].filter(Boolean) as string[])];
    const releasedAt = set.releaseDate ? set.releaseDate.replace(/\//g, "-") : null;

    const row = {
      game: "pokemon" as const,
      set_id: set.id,
      code: set.ptcgoCode || set.id,
      code_aliases: codeAliases,
      name: set.name,
      series: set.series || null,
      printed_total: set.printedTotal || null,
      total: set.total || null,
      numbering_format: "fraction" as const,
      rarity_location: "bottom_left" as const,
      released_at: releasedAt,
      source: "pokemontcg",
      source_uri: `https://api.pokemontcg.io/v2/sets/${set.id}`,
      icon_url: set.images?.symbol || null,
      notes: null,
    };

    const { error } = await supabase
      .from("catalog_sets")
      .upsert(row, { onConflict: "game,set_id" });

    if (error) {
      console.error(`  ✗ ${set.id} (${set.name}): ${error.message}`);
      errorCount++;
    } else {
      upsertCount++;
    }
  }

  console.log(`\nUpserted ${upsertCount} sets (${errorCount} errors)`);

  // Link catalog_cards.set_uuid
  console.log("\nLinking catalog_cards.set_uuid...");
  const { data: linkResult, error: linkError } = await supabase.rpc("exec_sql", {
    sql: `
      UPDATE catalog_cards c
      SET set_uuid = s.id
      FROM catalog_sets s
      WHERE c.game = 'pokemon' AND s.game = 'pokemon' AND c.set_code = s.set_id
        AND (c.set_uuid IS NULL OR c.set_uuid != s.id)
    `,
  });

  if (linkError) {
    // Fallback: do it manually if exec_sql RPC doesn't exist
    console.log("exec_sql not available, linking via individual queries...");
    const { data: allSets } = await supabase
      .from("catalog_sets")
      .select("id, set_id")
      .eq("game", "pokemon");

    if (allSets) {
      let linked = 0;
      for (const s of allSets) {
        const { count } = await supabase
          .from("catalog_cards")
          .update({ set_uuid: s.id })
          .eq("game", "pokemon")
          .eq("set_code", s.set_id)
          .is("set_uuid", null);
        linked += (count || 0);
      }
      console.log(`Linked ${linked} cards to their sets`);
    }
  } else {
    console.log("Linked cards via exec_sql");
  }

  // Report orphans
  const { data: orphans, count: orphanCount } = await supabase
    .from("catalog_cards")
    .select("set_code", { count: "exact" })
    .eq("game", "pokemon")
    .is("set_uuid", null);

  if (orphanCount && orphanCount > 0) {
    const orphanCodes = [...new Set((orphans || []).map((o: any) => o.set_code))];
    console.log(`\n⚠ ${orphanCount} cards with no matching set (${orphanCodes.length} unique set_codes):`);
    orphanCodes.slice(0, 20).forEach(c => console.log(`  - ${c}`));
    if (orphanCodes.length > 20) console.log(`  ... and ${orphanCodes.length - 20} more`);
  } else {
    console.log("\n✓ All cards linked to sets (0 orphans)");
  }

  console.log("\nDone.");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
