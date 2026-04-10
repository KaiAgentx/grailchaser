// Requires SNAPSHOT_SECRET env var. Set in Vercel dashboard
// and .env.local for local dev.
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getOrCreateRequestId, logRequest } from "@/lib/logging";

const ROUTE = "/api/prices/snapshot";

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);
  const startedAt = Date.now();

  const respond = (resp: NextResponse): NextResponse => {
    resp.headers.set("X-Request-ID", requestId);
    logRequest({ requestId, route: ROUTE, method: "GET", userId: null, ecosystem: null, status: resp.status, latencyMs: Date.now() - startedAt, errorCode: resp.status === 401 ? "unauthorized" : resp.headers.get("x-error-code") });
    return resp;
  };

  const secret = req.headers.get("x-snapshot-secret");
  if (secret !== process.env.SNAPSHOT_SECRET) {
    return respond(NextResponse.json({ error: "unauthorized", request_id: requestId }, { status: 401 }));
  }

  const supabase = createServerClient();
  try {
    const { data: cards } = await supabase
      .from("cards")
      .select("id, raw_value")
      .eq("sold", false)
      .gt("raw_value", 0);
    if (!cards?.length) return respond(NextResponse.json({ snapshotted: 0 }));
    const today = new Date().toISOString().slice(0, 10);
    const inserts = cards.map(c => ({ card_id: c.id, price: c.raw_value, recorded_at: today }));
    const { error } = await supabase.from("price_history").upsert(inserts, { onConflict: "card_id,recorded_at" });
    return respond(NextResponse.json({ snapshotted: inserts.length, error: error?.message }));
  } catch (error) {
    return respond(NextResponse.json({ error: "Snapshot failed" }, { status: 500 }));
  }
}
