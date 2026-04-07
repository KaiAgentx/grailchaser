/**
 * Benchmark harness for card recognition accuracy and performance.
 *
 * Phase 1A delivers the scaffold only — the harness will become useful
 * when Phase 1B's sync jobs populate catalog_hashes.
 *
 * Usage: npm run benchmark
 */

import fs from "fs";
import path from "path";

const MANIFEST_PATH = path.resolve("benchmarks/manifest.json");
const IMAGES_DIR = path.resolve("benchmarks/images");

async function main() {
  console.log("═".repeat(60));
  console.log("GrailChaser Recognition Benchmark");
  console.log("═".repeat(60));

  // Check manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log("\n⚠ No manifest found at benchmarks/manifest.json");
    console.log("  See benchmarks/README.md for setup instructions.\n");
    console.log("  The benchmark harness requires:");
    console.log("  1. benchmark images in benchmarks/images/{pokemon,mtg,one_piece}/");
    console.log("  2. benchmarks/manifest.json mapping images to expected card IDs");
    console.log("  3. Phase 1B catalog sync to populate catalog_hashes in Supabase\n");
    console.log("Phase 1A delivers the harness scaffold only.");
    console.log("Preprocessing, hashing, and distance functions are ready for use.");
    process.exit(0);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const items = manifest.items || [];

  if (items.length === 0) {
    console.log("\n⚠ Manifest is empty. Add items to benchmarks/manifest.json.\n");
    process.exit(0);
  }

  console.log(`\nManifest: ${items.length} items`);

  // Check images exist
  let missing = 0;
  for (const item of items) {
    const imgPath = path.join(IMAGES_DIR, item.imagePath);
    if (!fs.existsSync(imgPath)) {
      console.log(`  ✗ Missing: ${item.imagePath}`);
      missing++;
    }
  }

  if (missing > 0) {
    console.log(`\n${missing} of ${items.length} images missing. Add them to benchmarks/images/.\n`);
  }

  // Phase 1A: catalog_hashes is not yet populated, so we can only test
  // preprocessing + hashing speed, not accuracy.
  console.log("\n⚠ Catalog not yet populated (Phase 1B required for accuracy testing).");
  console.log("  Preprocessing and hashing benchmarks will be available after catalog sync.\n");
  console.log("Planned metrics (available after Phase 1B):");
  console.log("  - Top-1 accuracy");
  console.log("  - Top-3 accuracy");
  console.log("  - Median latency (ms)");
  console.log("  - Failure rate");
  console.log("  - Low-confidence rate (unclear / total)");
  console.log("\n" + "═".repeat(60));
}

main().catch(err => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
