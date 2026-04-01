import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerClient();
  try {
    const { data: rules } = await supabase.from("alert_rules").select("*").eq("active", true);
    if (!rules?.length) return NextResponse.json({ checked: 0 });
    const userIds = [...new Set(rules.map(r => r.user_id))];
    let alertsFired = 0;
    for (const userId of userIds) {
      const userRules = rules.filter(r => r.user_id === userId);
      const { data: cards } = await supabase
        .from("cards")
        .select("*, price_history(price, recorded_at)")
        .eq("user_id", userId)
        .eq("sold", false)
        .order("recorded_at", { referencedTable: "price_history", ascending: false })
        .limit(2, { referencedTable: "price_history" });
      if (!cards?.length) continue;
      for (const card of cards) {
        const prices = card.price_history || [];
        if (prices.length < 2) continue;
        const currentPrice = prices[0]?.price || card.raw_value;
        const prevPrice = prices[1]?.price || card.raw_value;
        const changePct = prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;
        for (const rule of userRules) {
          if (rule.scope === "watchlist" && !card.watchlist) continue;
          let shouldFire = false;
          if (rule.type === "spike" && changePct >= rule.threshold) shouldFire = true;
          if (rule.type === "drop" && changePct <= -rule.threshold) shouldFire = true;
          if (rule.type === "grading_opp") {
            const gradedVal = card.graded_values?.["10"] || 0;
            if (gradedVal > card.raw_value * (1 + rule.threshold / 100)) shouldFire = true;
          }
          if (rule.type === "breakout" && changePct >= rule.threshold && card.raw_value >= 5) shouldFire = true;
          if (shouldFire) {
            await supabase.from("alert_events").insert({
              user_id: userId, rule_id: rule.id, card_id: card.id, type: rule.type,
              old_price: prevPrice, new_price: currentPrice, change_pct: +changePct.toFixed(1),
            });
            alertsFired++;
          }
        }
      }
    }
    return NextResponse.json({ checked: userIds.length, alertsFired });
  } catch (error) {
    return NextResponse.json({ error: "Alert check failed" }, { status: 500 });
  }
}
