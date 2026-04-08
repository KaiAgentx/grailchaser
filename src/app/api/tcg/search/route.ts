import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const game = req.nextUrl.searchParams.get("game") || "pokemon";

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await supabase
    .from("catalog_cards")
    .select("id, name, set_name, set_code, card_number, rarity, image_small_url, image_large_url")
    .eq("game", game)
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    results: (data || []).map(r => ({
      id: `${r.set_code}-${r.card_number}`,
      catalogCardId: `${r.set_code}-${r.card_number}`,
      name: r.name,
      setName: r.set_name,
      setCode: r.set_code,
      cardNumber: r.card_number,
      rarity: r.rarity,
      imageSmallUrl: r.image_small_url,
      imageLargeUrl: r.image_large_url,
    })),
  });
}
