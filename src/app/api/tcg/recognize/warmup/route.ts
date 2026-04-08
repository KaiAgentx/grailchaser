import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrLoadCache, getCache } from "@/lib/recognition";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let warmPromise: Promise<void> | null = null;

export async function GET() {
  const existing = getCache("pokemon");
  if (existing) {
    return NextResponse.json({ ok: true, cached: true, entries: existing.entries.length });
  }

  if (!warmPromise) {
    warmPromise = getOrLoadCache("pokemon", supabase)
      .then(() => {})
      .catch((err) => {
        console.error("[warmup] Cache load failed:", err.message);
        warmPromise = null;
      });
  }

  try {
    await warmPromise;
    const cache = getCache("pokemon");
    return NextResponse.json({ ok: true, cached: false, entries: cache?.entries.length ?? 0 });
  } catch {
    return NextResponse.json({ ok: false, error: "Cache load failed" }, { status: 503 });
  }
}
