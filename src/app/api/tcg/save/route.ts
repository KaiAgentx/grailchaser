import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, game, player, brand, set, card_number, rarity, condition, raw_value, scan_image_url, tcg_card_id } = body;

    if (!user_id || !game || !player) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase.from("cards").insert({
      user_id,
      player,
      sport: "Pokemon" as any, // Maps to existing sport column for TCG cards
      brand: brand || "Pokémon TCG",
      set: set || "",
      card_number: card_number || "",
      rarity: rarity || null,
      condition: condition || "NM",
      raw_value: raw_value || 0,
      cost_basis: 0,
      scan_image_url: scan_image_url || null,
      notes: `TCG: ${game} | ${tcg_card_id || ""}`,
      date_added: new Date().toISOString().slice(0, 10),
      status: "raw",
      tier: raw_value >= 100 ? "Gem" : raw_value >= 25 ? "Star" : raw_value >= 5 ? "Core" : "Bulk",
      year: new Date().getFullYear(),
      team: "",
      parallel: "Base",
      is_rc: false,
      is_auto: false,
      is_numbered: false,
      watchlist: false,
      grade_candidate: false,
      storage_box: "PENDING",
      storage_row: 1,
      storage_position: 1,
      gem_probability: 0.15,
      graded_values: { "10": 0, "9": 0, "8": 0, "7": 0 },
    }).select("id").single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
