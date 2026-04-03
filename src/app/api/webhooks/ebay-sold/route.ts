import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  try {
    const payload = await request.json();
    const notificationType = payload.NotificationType || payload.metadata?.topic;
    if (!["ItemSold", "AuctionCheckoutComplete", "MARKETPLACE.ACCOUNT_DELETION"].includes(notificationType)) {
      return NextResponse.json({ ack: true });
    }
    const sku = payload.Item?.SKU || payload.resource?.sku;
    const soldPrice = parseFloat(payload.Item?.SellingStatus?.CurrentPrice?.Value || payload.resource?.price?.value || "0");
    const ebayListingId = payload.Item?.ItemID || payload.resource?.listing_id;
    if (!sku || !sku.startsWith("GC-")) return NextResponse.json({ ack: true, skipped: "not a GrailChaser card" });
    const cardId = sku.replace("GC-", "");
    const { data: card, error: fetchError } = await supabase.from("cards").select("*").eq("id", cardId).single();
    if (fetchError || !card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    const todayStr = new Date().toISOString().slice(0, 10);
    await supabase.from("cards").update({
      status: "sold", sold: true, sold_price: soldPrice, sold_date: todayStr, sold_platform: "eBay",
      ebay_listing_id: null, ebay_offer_id: null, ebay_sku: null, ebay_url: null,
    }).eq("id", cardId);
    if (card.shopify_product_id) {
      try {
        await fetch(process.env.NEXT_PUBLIC_APP_URL + "/api/shopify", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopify_product_id: card.shopify_product_id }),
        });
        await supabase.from("cards").update({ shopify_product_id: null, shopify_url: null }).eq("id", cardId);
      } catch (e) { console.error("Shopify auto-delist failed:", e); }
    }
    if (card.whatnot_listing_id && process.env.WHATNOT_API_TOKEN) {
      try { await supabase.from("cards").update({ whatnot_listing_id: null }).eq("id", cardId); } catch (e) { console.error("Whatnot auto-delist failed:", e); }
    }
    const manualPlatforms = [];
    if (card.mercari_listed) manualPlatforms.push("Mercari");
    if (card.facebook_listed) manualPlatforms.push("Facebook");
    if (card.tcgplayer_listed && !process.env.TCGPLAYER_API_KEY) manualPlatforms.push("TCGPlayer");
    for (const platform of manualPlatforms) {
      await supabase.from("alert_events").insert({
        user_id: card.user_id, card_id: cardId, type: "delist_reminder",
        old_price: card.raw_value, new_price: soldPrice, change_pct: 0, read: false, dismissed: false,
      });
    }
    return NextResponse.json({
      success: true, card_id: cardId, sold_price: soldPrice,
      auto_delisted: [card.shopify_product_id ? "Shopify" : null, card.whatnot_listing_id ? "Whatnot" : null].filter(Boolean),
      manual_delist_needed: manualPlatforms,
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challengeCode = searchParams.get("challenge_code");
  if (challengeCode) {
    const hash = crypto.createHash("sha256");
    hash.update(challengeCode);
    hash.update(process.env.EBAY_VERIFICATION_TOKEN || "");
    hash.update("https://grailchaser.vercel.app/api/webhooks/ebay-sold");
    return NextResponse.json({ challengeResponse: hash.digest("hex") });
  }
  return NextResponse.json({ status: "ok" });
}
