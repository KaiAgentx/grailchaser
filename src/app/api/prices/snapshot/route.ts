import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();
  try {
    const { data: cards } = await supabase
      .from("cards")
      .select("id, raw_value")
      .eq("sold", false)
      .gt("raw_value", 0);
    if (!cards?.length) return NextResponse.json({ snapshotted: 0 });
    const today = new Date().toISOString().slice(0, 10);
    const inserts = cards.map(c => ({ card_id: c.id, price: c.raw_value, recorded_at: today }));
    const { error } = await supabase.from("price_history").upsert(inserts, { onConflict: "card_id,recorded_at" });
    return NextResponse.json({ snapshotted: inserts.length, error: error?.message });
  } catch (error) {
    return NextResponse.json({ error: "Snapshot failed" }, { status: 500 });
  }
}
