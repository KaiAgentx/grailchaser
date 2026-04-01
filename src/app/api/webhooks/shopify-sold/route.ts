import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const rawBody = await request.text();
    const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");
    if (process.env.SHOPIFY_WEBHOOK_SECRET && hmacHeader) {
      const hash = crypto.createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET).update(rawBody, "utf8").digest("base64");
      if (hash !== hmacHeader) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const order = JSON.parse(rawBody);
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const item of order.line_items || []) {
      const sku = item.sku;
      if (!sku) continue;
      const { data: card, error } = await supabase.from("cards").select("*").eq("id", sku).single();
      if (error || !card) continue;
      const soldPrice = parseFloat(item.price || "0");
      await supabase.from("cards").update({
        status: "sold", sold: true, sold_price: soldPrice, sold_date: todayStr, sold_platform: "Shopify", shopify_product_id: null,
      }).eq("id", sku);
      if (card.ebay_offer_id || card.ebay_sku) {
        try {
          await fetch(process.env.NEXT_PUBLIC_APP_URL + "/api/ebay", {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ebay_offer_id: card.ebay_offer_id, ebay_sku: card.ebay_sku }),
          });
          await supabase.from("cards").update({ ebay_listing_id: null, ebay_offer_id: null, ebay_sku: null, ebay_url: null }).eq("id", sku);
        } catch (e) { console.error("eBay auto-delist failed:", e); }
      }
      if (card.whatnot_listing_id && process.env.WHATNOT_API_TOKEN) {
        try { await supabase.from("cards").update({ whatnot_listing_id: null }).eq("id", sku); } catch (e) { console.error("Whatnot auto-delist failed:", e); }
      }
      const manualPlatforms = [];
      if (card.mercari_listed) manualPlatforms.push("Mercari");
      if (card.facebook_listed) manualPlatforms.push("Facebook");
      for (const platform of manualPlatforms) {
        await supabase.from("alert_events").insert({
          user_id: card.user_id, card_id: sku, type: "delist_reminder",
          old_price: card.raw_value, new_price: soldPrice, change_pct: 0,
        });
      }
    }
    return NextResponse.json({ success: true, items_processed: order.line_items?.length || 0 });
  } catch (error: any) {
    console.error("Shopify webhook error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
