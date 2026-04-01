import { NextRequest, NextResponse } from "next/server";

const EBAY_ENV = process.env.EBAY_ENVIRONMENT || "production";
const EBAY_BASE = EBAY_ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

async function getEbayToken(): Promise<string | null> {
  const refreshToken = process.env.EBAY_REFRESH_TOKEN;
  const clientId = process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CERT_ID;
  if (!refreshToken || !clientId || !clientSecret) return null;
  const credentials = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const res = await fetch(EBAY_BASE + "/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + credentials },
    body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refreshToken) + "&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment"),
  });
  const data = await res.json();
  return data.access_token || null;
}

async function ebayFetch(path: string, method = "GET", body?: any) {
  const token = await getEbayToken();
  if (!token) throw new Error("eBay auth failed");
  const res = await fetch(EBAY_BASE + path, {
    method,
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "Content-Language": "en-US", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return { success: true };
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const { card, price, images, fulfillment_policy_id, payment_policy_id, return_policy_id } = await request.json();
    const sku = "GC-" + card.id;
    const title = [card.year, card.brand, card.set, card.parallel !== "Base" ? card.parallel : "", card.player, card.is_rc ? "RC Rookie" : "", card.is_auto ? "Auto" : "", card.is_numbered ? "/" + card.numbered_to : "", card.card_number, card.sport].filter(Boolean).join(" ").slice(0, 80);
    let description = card.year + " " + card.brand + " " + card.set;
    if (card.parallel !== "Base") description += " " + card.parallel;
    description += " " + card.card_number + "\n";
    description += "Player: " + card.player + "\nSport: " + card.sport + "\nTeam: " + card.team + "\n";
    if (card.is_rc) description += "Rookie Card: Yes\n";
    if (card.is_auto) description += "Autograph: Yes\n";
    if (card.is_numbered) description += "Numbered: /" + card.numbered_to + "\n";
    description += "Condition: " + (card.condition || "Raw/Ungraded") + "\n";
    if (card.graded_grade) description += "Graded: " + card.grading_company + " " + card.graded_grade + "\n";
    description += "\nShipped in penny sleeve + toploader" + (price >= 20 ? ", secured in bubble mailer with tracking" : " via PWE") + ".";
    const isGraded = card.status === "graded" && card.graded_grade;
    const conditionId = isGraded ? "LIKE_NEW" : "USED_VERY_GOOD";
    const conditionDescriptors = isGraded
      ? [{ name: "27501", values: [getGraderValueId(card.grading_company)] }, { name: "27502", values: [getGradeValueId(card.graded_grade)] }, ...(card.grading_cert ? [{ name: "27503", additionalInfo: card.grading_cert }] : [])]
      : [{ name: "40001", values: ["40011"] }];
    const inventoryItem = {
      availability: { shipToLocationAvailability: { quantity: 1 } },
      condition: conditionId, conditionDescriptors,
      product: {
        title, description,
        aspects: { Sport: [card.sport], "Player/Athlete": [card.player], Team: [card.team], Year: [card.year.toString()], Manufacturer: [card.brand], Set: [card.set], "Card Number": [card.card_number], ...(card.is_rc ? { Features: ["Rookie"] } : {}), ...(card.is_auto ? { Autographed: ["Yes"] } : {}), ...(card.parallel !== "Base" ? { "Parallel/Variety": [card.parallel] } : {}) },
        ...(images?.length > 0 ? { imageUrls: images } : {}),
      },
    };
    await ebayFetch("/sell/inventory/v1/inventory_item/" + sku, "PUT", inventoryItem);
    const offer = {
      sku, marketplaceId: "EBAY_US", format: "FIXED_PRICE", listingDescription: description, availableQuantity: 1,
      categoryId: "261328",
      pricingSummary: { price: { value: price.toFixed(2), currency: "USD" } },
      listingPolicies: { fulfillmentPolicyId: fulfillment_policy_id || process.env.EBAY_FULFILLMENT_POLICY_ID, paymentPolicyId: payment_policy_id || process.env.EBAY_PAYMENT_POLICY_ID, returnPolicyId: return_policy_id || process.env.EBAY_RETURN_POLICY_ID },
    };
    const offerResult = await ebayFetch("/sell/inventory/v1/offer", "POST", offer);
    const offerId = offerResult.offerId;
    if (!offerId) return NextResponse.json({ error: "Failed to create offer", details: offerResult }, { status: 500 });
    const publishResult = await ebayFetch("/sell/inventory/v1/offer/" + offerId + "/publish", "POST");
    return NextResponse.json({ success: true, ebay_listing_id: publishResult.listingId, ebay_offer_id: offerId, ebay_sku: sku, url: "https://www.ebay.com/itm/" + publishResult.listingId });
  } catch (error: any) {
    return NextResponse.json({ error: "eBay listing failed", message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { ebay_offer_id, ebay_sku } = await request.json();
    if (ebay_offer_id) await ebayFetch("/sell/inventory/v1/offer/" + ebay_offer_id, "DELETE");
    else if (ebay_sku) await ebayFetch("/sell/inventory/v1/inventory_item/" + ebay_sku, "DELETE");
    else return NextResponse.json({ error: "Need offer_id or sku" }, { status: 400 });
    return NextResponse.json({ success: true, status: "delisted" });
  } catch (error: any) {
    return NextResponse.json({ error: "eBay delist failed", message: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { ebay_offer_id, price } = await request.json();
    if (!ebay_offer_id || price === undefined) return NextResponse.json({ error: "Need offer_id and price" }, { status: 400 });
    const currentOffer = await ebayFetch("/sell/inventory/v1/offer/" + ebay_offer_id, "GET");
    if (!currentOffer || currentOffer.errors) return NextResponse.json({ error: "Could not fetch current offer", details: currentOffer }, { status: 500 });
    currentOffer.pricingSummary = { ...currentOffer.pricingSummary, price: { value: price.toFixed(2), currency: "USD" } };
    delete currentOffer.offerId; delete currentOffer.status; delete currentOffer.listing;
    await ebayFetch("/sell/inventory/v1/offer/" + ebay_offer_id, "PUT", currentOffer);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "eBay price update failed", message: error.message }, { status: 500 });
  }
}

function getGraderValueId(company: string): string {
  const map: Record<string, string> = { PSA: "27511", BGS: "27512", CGC: "27513", SGC: "27514" };
  return map[company] || "27511";
}
function getGradeValueId(grade: string): string {
  const map: Record<string, string> = { "10": "27521", "9.5": "27520", "9": "27519", "8.5": "27518", "8": "27517", "7": "27515" };
  return map[grade] || "27519";
}
