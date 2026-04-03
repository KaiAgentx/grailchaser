import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const testCards = [
  { player: "Mike Trout", sport: "Baseball", year: 2011, brand: "Topps", set: "Update", parallel: "Base", card_number: "#US175", raw_value: 5, graded_values: { "10": 45, "9": 20, "8": 10, "7": 6 } },
  { player: "Random Base 1", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#42", raw_value: 0.50, graded_values: { "10": 2, "9": 1, "8": 0.75, "7": 0.50 } },
  { player: "Random Base 2", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#118", raw_value: 0.25, graded_values: { "10": 1, "9": 0.50, "8": 0.30, "7": 0.25 } },
  { player: "Justin Herbert", sport: "Football", year: 2020, brand: "Panini", set: "Donruss", parallel: "Base", card_number: "#303", raw_value: 25, graded_values: { "10": 180, "9": 65, "8": 35, "7": 28 }, is_rc: true },
  { player: "Random Base 3", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#201", raw_value: 0.50, graded_values: { "10": 3, "9": 1, "8": 0.75, "7": 0.50 } },
  { player: "Ja Morant", sport: "Basketball", year: 2019, brand: "Panini", set: "Prizm", parallel: "Base", card_number: "#249", raw_value: 15, graded_values: { "10": 245, "9": 80, "8": 30, "7": 18 } },
  { player: "Random Base 4", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#77", raw_value: 1, graded_values: { "10": 4, "9": 2, "8": 1.25, "7": 1 } },
  { player: "Random Base 5", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#155", raw_value: 0.25, graded_values: { "10": 1, "9": 0.50, "8": 0.30, "7": 0.25 } },
  { player: "Shohei Ohtani", sport: "Baseball", year: 2018, brand: "Topps", set: "Chrome", parallel: "Base", card_number: "#150", raw_value: 35, graded_values: { "10": 150, "9": 60, "8": 40, "7": 30 } },
  { player: "Random Base 6", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#88", raw_value: 0.50, graded_values: { "10": 2, "9": 1, "8": 0.75, "7": 0.50 } },
  { player: "Bobby Witt Jr", sport: "Baseball", year: 2022, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#215", raw_value: 8, graded_values: { "10": 55, "9": 22, "8": 12, "7": 9 } },
  { player: "Random Base 7", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#33", raw_value: 0.75, graded_values: { "10": 3, "9": 1.50, "8": 1, "7": 0.75 } },
  { player: "Elly De La Cruz", sport: "Baseball", year: 2023, brand: "Topps", set: "Chrome", parallel: "Base", card_number: "#1", raw_value: 18, graded_values: { "10": 90, "9": 40, "8": 22, "7": 18 } },
  { player: "Random Base 8", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#199", raw_value: 0.50, graded_values: { "10": 2, "9": 1, "8": 0.75, "7": 0.50 } },
  { player: "Anthony Edwards", sport: "Basketball", year: 2020, brand: "Panini", set: "Prizm", parallel: "Base", card_number: "#258", raw_value: 45, graded_values: { "10": 200, "9": 85, "8": 50, "7": 40 } },
  { player: "Random Base 9", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#67", raw_value: 0.25, graded_values: { "10": 1, "9": 0.50, "8": 0.30, "7": 0.25 } },
  { player: "Wander Franco", sport: "Baseball", year: 2022, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#215", raw_value: 12, graded_values: { "10": 180, "9": 55, "8": 20, "7": 14 } },
  { player: "Random Base 10", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#144", raw_value: 0.50, graded_values: { "10": 2, "9": 1, "8": 0.75, "7": 0.50 } },
  { player: "Paul Skenes", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 2", parallel: "Base", card_number: "#697", raw_value: 22, graded_values: { "10": 85, "9": 40, "8": 25, "7": 20 }, is_rc: true },
  { player: "No Pricing Card", sport: "Baseball", year: 2024, brand: "Topps", set: "Series 1", parallel: "Base", card_number: "#300", raw_value: 0, graded_values: { "10": 0, "9": 0, "8": 0, "7": 0 } },
];

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Get the user from the request (pass user_id in body)
    const { user_id } = await request.json();
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    // Create box
    const { data: existingBox } = await supabase.from("boxes").select("id").eq("name", "TEST SCAN").eq("user_id", user_id).single();
    if (!existingBox) {
      const { error: boxError } = await supabase.from("boxes").insert({ user_id, name: "TEST SCAN", num_rows: 1, divider_size: 50, box_type: "scanned" });
      if (boxError) return NextResponse.json({ error: "Box creation failed: " + boxError.message });
    }

    // Insert cards
    const inserts = testCards.map((c, i) => ({
      user_id,
      player: c.player,
      sport: c.sport,
      team: "",
      year: c.year,
      brand: c.brand,
      set: c.set,
      parallel: c.parallel,
      card_number: c.card_number,
      is_rc: c.is_rc || false,
      is_auto: false,
      is_numbered: false,
      numbered_to: null,
      condition: "NM",
      raw_value: c.raw_value,
      cost_basis: 0.50,
      tier: c.raw_value >= 100 ? "Gem" : c.raw_value >= 25 ? "Star" : c.raw_value >= 5 ? "Core" : "Bulk",
      gem_probability: 0.30,
      graded_values: c.graded_values,
      status: "raw",
      watchlist: false,
      grade_candidate: (c.graded_values["10"] / (c.raw_value || 1)) >= 5 && c.raw_value >= 5,
      storage_box: "TEST SCAN",
      storage_row: 1,
      storage_position: i + 1,
      notes: "Smart Pull test card",
      date_added: new Date().toISOString().slice(0, 10),
    }));

    const { data, error } = await supabase.from("cards").insert(inserts).select("id, player, storage_position");
    if (error) return NextResponse.json({ error: error.message });

    return NextResponse.json({ success: true, inserted: data?.length || 0, cards: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
