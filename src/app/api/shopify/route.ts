import { NextRequest, NextResponse } from "next/server";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

async function shopifyFetch(endpoint: string, method = "GET", body?: any) {
  const res = await fetch("https://" + SHOPIFY_STORE + "/admin/api/2024-01/" + endpoint, {
    method,
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_TOKEN || "" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const { card, price, images } = await request.json();
    if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) return NextResponse.json({ error: "Shopify not configured" }, { status: 400 });
    const title = [card.year, card.brand, card.set, card.parallel !== "Base" ? card.parallel : "", card.player, card.is_rc ? "RC" : "", card.card_number].filter(Boolean).join(" ");
    let bodyHtml = "<p>" + card.year + " " + card.brand + " " + card.set;
    if (card.parallel !== "Base") bodyHtml += " " + card.parallel;
    bodyHtml += "</p><p>Player: " + card.player + "</p><p>Sport: " + card.sport + "</p>";
    if (card.is_rc) bodyHtml += "<p>Rookie Card</p>";
    bodyHtml += "<p>Condition: " + (card.condition || "Raw") + "</p>";
    const product: any = {
      product: {
        title, body_html: bodyHtml, vendor: "GrailChaser", product_type: "Sports Card",
        tags: [card.sport, card.brand, card.player, card.is_rc ? "Rookie" : ""].filter(Boolean).join(", "),
        variants: [{ price: price.toFixed(2), sku: card.id, inventory_quantity: 1, inventory_management: "shopify" }],
        ...(images?.length > 0 ? { images: images.map((src: string) => ({ src })) } : {}),
      },
    };
    const result = await shopifyFetch("products.json", "POST", product);
    if (result.product) {
      return NextResponse.json({
        success: true,
        shopify_product_id: result.product.id.toString(),
        shopify_variant_id: result.product.variants?.[0]?.id?.toString(),
        url: "https://" + SHOPIFY_STORE + "/products/" + result.product.handle,
      });
    }
    return NextResponse.json({ error: "Failed to create product", details: result }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: "Shopify listing failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { shopify_product_id } = await request.json();
    if (!SHOPIFY_STORE || !SHOPIFY_TOKEN || !shopify_product_id) return NextResponse.json({ error: "Missing config or product ID" }, { status: 400 });
    const result = await shopifyFetch("products/" + shopify_product_id + ".json", "PUT", {
      product: { id: shopify_product_id, status: "draft" },
    });
    return NextResponse.json({ success: true, status: "delisted" });
  } catch (error) {
    return NextResponse.json({ error: "Shopify delist failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { shopify_product_id, shopify_variant_id, price, inventory } = await request.json();
    if (!SHOPIFY_STORE || !SHOPIFY_TOKEN || !shopify_product_id) return NextResponse.json({ error: "Missing config or product ID" }, { status: 400 });
    let variantId = shopify_variant_id;
    if (!variantId) {
      const product = await shopifyFetch("products/" + shopify_product_id + ".json", "GET");
      variantId = product?.product?.variants?.[0]?.id;
      if (!variantId) return NextResponse.json({ error: "Could not find variant ID" }, { status: 500 });
    }
    const variantUpdate: any = { id: variantId };
    if (price !== undefined) variantUpdate.price = price.toFixed(2);
    if (inventory !== undefined) variantUpdate.inventory_quantity = inventory;
    const result = await shopifyFetch("products/" + shopify_product_id + ".json", "PUT", {
      product: { id: shopify_product_id, variants: [variantUpdate] },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Shopify update failed" }, { status: 500 });
  }
}
