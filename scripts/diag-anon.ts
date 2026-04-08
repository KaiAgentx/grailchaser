import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("URL:", url);
console.log("Key length:", key?.length ?? "missing");
console.log("Key first 20:", key?.slice(0, 20));
console.log("Key last 10:", key?.slice(-10));

if (!url || !key) {
  console.error("ENV MISSING");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log("\n--- Test 1: SELECT * FROM catalog_metadata WHERE game=pokemon ---");
  const res1 = await supabase
    .from("catalog_metadata")
    .select("*")
    .eq("game", "pokemon");
  console.log("error:", res1.error);
  console.log("status:", res1.status, res1.statusText);
  console.log("count:", res1.data?.length);
  console.log("data:", JSON.stringify(res1.data, null, 2));

  console.log("\n--- Test 2: same query with .single() ---");
  const res2 = await supabase
    .from("catalog_metadata")
    .select("catalog_version")
    .eq("game", "pokemon")
    .single();
  console.log("error:", res2.error);
  console.log("status:", res2.status, res2.statusText);
  console.log("data:", JSON.stringify(res2.data, null, 2));

  console.log("\n--- Test 3: COUNT catalog_cards WHERE game=pokemon ---");
  const res3 = await supabase
    .from("catalog_cards")
    .select("*", { count: "exact", head: true })
    .eq("game", "pokemon");
  console.log("error:", res3.error);
  console.log("status:", res3.status, res3.statusText);
  console.log("count:", res3.count);
}

main().catch((e) => {
  console.error("Caught:", e);
  process.exit(1);
});
