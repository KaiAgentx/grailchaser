#!/usr/bin/env tsx
/**
 * Dev CLI for testing the recognition pipeline against a local image file.
 * Bypasses the HTTP layer — calls the same functions directly so you can
 * iterate fast without spinning up the dev server.
 *
 * Usage:
 *   npm run recognize -- /path/to/card.jpg
 *   npm run recognize -- /path/to/card.jpg --top 3
 *   npm run recognize -- /path/to/card.jpg --game pokemon
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { preprocessImage } from "../src/lib/recognition/preprocess";
import { phash, dhash, whash } from "../src/lib/recognition/hashing";
import { hamming64, HASH_WEIGHTS } from "../src/lib/recognition/distance";
import { bandFromDistance } from "../src/lib/recognition/confidence";
import { getOrLoadCache } from "../src/lib/recognition/cache";

// ─── Parse args ───

const args = process.argv.slice(2);
const imagePath = args.find((a) => !a.startsWith("--"));
const flagIdx = (f: string) => args.indexOf(f);
const topK = flagIdx("--top") >= 0 ? parseInt(args[flagIdx("--top") + 1]) : 5;
const game = flagIdx("--game") >= 0 ? args[flagIdx("--game") + 1] : "pokemon";

if (!imagePath) {
  console.error("Usage: npm run recognize -- /path/to/card.jpg [--top N] [--game pokemon]");
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`File not found: ${imagePath}`);
  process.exit(1);
}

// ─── Env ───

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY);

// ─── Main ───

async function main() {
  const t0 = performance.now();

  // Preprocess
  console.log(`Loading ${imagePath}...`);
  const buffer = fs.readFileSync(imagePath!);
  const { data, width, height } = await preprocessImage(buffer);
  const preprocessMs = Math.round(performance.now() - t0);

  // Hash
  const t1 = performance.now();
  const qp = phash(data, width, height);
  const qd = dhash(data, width, height);
  const qw = whash(data, width, height);
  const hashMs = Math.round(performance.now() - t1);

  // Cache
  const t2 = performance.now();
  console.log(`Loading cache for game=${game}...`);
  const cache = await getOrLoadCache(game, supabase);
  const cacheMs = Math.round(performance.now() - t2);
  console.log(`Cache: ${cache.entries.length} entries (version ${cache.catalogVersion})`);

  // Score
  const t3 = performance.now();
  const scored = cache.entries.map((entry) => {
    const pd = hamming64(qp, entry.phash);
    const dd = hamming64(qd, entry.dhash);
    const wd = hamming64(qw, entry.whash);
    return {
      entry,
      distance: pd * HASH_WEIGHTS.phash + dd * HASH_WEIGHTS.dhash + wd * HASH_WEIGHTS.whash,
      pd, dd, wd,
    };
  });
  scored.sort((a, b) => a.distance - b.distance);
  const top = scored.slice(0, topK);
  const matchMs = Math.round(performance.now() - t3);
  const totalMs = Math.round(performance.now() - t0);

  // Output
  const band = top.length > 0 ? bandFromDistance(top[0].distance) : "unclear";

  console.log();
  console.log(`CONFIDENCE: ${band.toUpperCase()} (top distance: ${top[0]?.distance.toFixed(2)})`);
  console.log();
  console.log("Rank | Distance | pHash | dHash | wHash | Name                          | Set               | #     | Rarity");
  console.log("─".repeat(120));

  for (const r of top) {
    const e = r.entry;
    console.log(
      `  ${String(top.indexOf(r) + 1).padEnd(4)}| ${r.distance.toFixed(2).padStart(8)} | ${String(r.pd).padStart(5)} | ${String(r.dd).padStart(5)} | ${String(r.wd).padStart(5)} | ${e.name.padEnd(29).substring(0, 29)} | ${(e.setName || "").padEnd(17).substring(0, 17)} | ${(e.cardNumber || "").padEnd(5)} | ${e.rarity || ""}`
    );
  }

  console.log();
  console.log("Timing:");
  console.log(`  Preprocess: ${preprocessMs}ms | Hash: ${hashMs}ms | Cache: ${cacheMs}ms | Match: ${matchMs}ms | Total: ${totalMs}ms`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
