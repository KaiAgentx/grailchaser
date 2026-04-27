#!/usr/bin/env tsx
/**
 * Backfill multi-source pricing for the authenticated user's existing cards.
 *
 * One-shot runner: iterates every card in the cards table belonging to the
 * user identified by the JWT in TOKEN, and POSTs to /refresh-price for each.
 * The endpoint writes the full multi-source pricing payload + first row in
 * card_price_history per card.
 *
 * Authenticates via:
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY     (read user's cards directly)
 *   - TOKEN (the user's JWT)                       (sign refresh-price requests)
 *
 * The script does NOT use the service role to call refresh-price. It uses the
 * user's JWT, so the same auth/rate-limit/cooldown gates the app uses apply
 * here too. This deliberately exercises the live code path end-to-end.
 *
 * Run:
 *   TOKEN=eyJ... npx tsx scripts/backfill-prices.ts
 *
 * Optional:
 *   BASE_URL=http://localhost:3000 ...   (override target deployment)
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";

// ─── Env ───
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.TOKEN;
const BASE_URL = process.env.BASE_URL || "https://grailchaser.vercel.app";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  process.exit(1);
}

if (!TOKEN) {
  console.error("Missing TOKEN environment variable.\n");
  console.error("Get your token from browser DevTools:");
  console.error("  1. Open https://grailchaser.vercel.app");
  console.error("  2. F12 → Application → Cookies → grailchaser.vercel.app");
  console.error("  3. Find sb-hgxyvbqmrajnvlnotcal-auth-token");
  console.error("  4. Copy the value, base64-decode if prefixed,");
  console.error("     extract access_token");
  console.error("  5. Run: TOKEN=eyJ... npx tsx scripts/backfill-prices.ts");
  process.exit(1);
}

const SLEEP_MS = 1000; // polite spacing between cards (the per-card cooldown is 60s server-side)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Validate the token + extract user_id
  const { data: userData, error: userErr } = await supabase.auth.getUser(TOKEN!);
  if (userErr || !userData?.user) {
    console.error("Invalid TOKEN:", userErr?.message ?? "no user returned");
    process.exit(1);
  }
  const userId = userData.user.id;
  console.log(`Authenticated as ${userData.user.email ?? userId}`);

  // Fetch all cards for this user
  const { data: cards, error: cardsErr } = await supabase
    .from("cards")
    .select("id, player, catalog_card_id, raw_value, tier")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (cardsErr) {
    console.error("Failed to load cards:", cardsErr.message);
    process.exit(1);
  }
  if (!cards || cards.length === 0) {
    console.log("No cards to backfill.");
    return;
  }

  console.log(`Backfilling ${cards.length} card${cards.length === 1 ? "" : "s"} via ${BASE_URL}`);
  console.log("");

  let refreshedCount = 0;
  let notFoundCount = 0;
  let rateLimitedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const idTag = card.catalog_card_id ? ` (${card.catalog_card_id})` : "";
    const label = `[${i + 1}/${cards.length}] ${card.player}${idTag}`;

    try {
      const res = await fetch(`${BASE_URL}/api/tcg/cards/${card.id}/refresh-price`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const data: any = await res.json().catch(() => ({}));

      if (data.outcome === "refreshed") {
        const rv = data.after?.raw_value;
        const tier = data.after?.tier;
        console.log(`${label} → refreshed, raw_value $${rv != null ? Number(rv).toFixed(2) : "—"}, tier ${tier ?? "—"}`);
        refreshedCount++;
      } else if (data.outcome === "not_found") {
        console.log(`${label} → not_found (no pricing data)`);
        notFoundCount++;
      } else if (data.outcome === "rate_limited") {
        console.warn(`${label} → rate_limited (60s cooldown active, skipped)`);
        rateLimitedCount++;
      } else if (!res.ok) {
        console.error(`${label} → HTTP ${res.status}: ${data.error ?? data.details ?? "unknown error"}`);
        errorCount++;
      } else {
        console.error(`${label} → unexpected outcome:`, data);
        errorCount++;
      }
    } catch (err) {
      console.error(`${label} → fetch failed:`, err instanceof Error ? err.message : err);
      errorCount++;
    }

    if (i < cards.length - 1) await new Promise(r => setTimeout(r, SLEEP_MS));
  }

  console.log("");
  console.log(`Backfilled ${cards.length} card${cards.length === 1 ? "" : "s"} (${refreshedCount} refreshed, ${notFoundCount} not_found, ${rateLimitedCount} rate_limited, ${errorCount} errors)`);
}

main().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
