"use client";
import { useState } from "react";
import { Card } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { today } from "@/lib/utils";

export function useListings() {
  const [listing, setListing] = useState(false);
  const supabase = createClient();

  const listOnEbay = async (card: Card, price: number, images?: string[]) => {
    setListing(true);
    try {
      const res = await fetch("/api/ebay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card, price, images }),
      });
      const data = await res.json();
      if (data.success) {
        await supabase.from("cards").update({
          ebay_listing_id: data.ebay_listing_id,
          ebay_offer_id: data.ebay_offer_id,
          ebay_sku: data.ebay_sku,
          ebay_url: data.url,
          ebay_price: price,
          ebay_listed_date: today(),
          status: "listed",
        }).eq("id", card.id);
      }
      return data;
    } finally { setListing(false); }
  };

  const delistFromEbay = async (card: Card) => {
    const res = await fetch("/api/ebay", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ebay_offer_id: card.ebay_offer_id, ebay_sku: card.ebay_sku }),
    });
    const data = await res.json();
    if (data.success) {
      await supabase.from("cards").update({
        ebay_listing_id: null, ebay_offer_id: null, ebay_sku: null, ebay_url: null, ebay_price: null, ebay_listed_date: null,
      }).eq("id", card.id);
    }
    return data;
  };

  const listOnShopify = async (card: Card, price: number, images?: string[]) => {
    setListing(true);
    try {
      const res = await fetch("/api/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card, price, images }),
      });
      const data = await res.json();
      if (data.success) {
        await supabase.from("cards").update({
          shopify_product_id: data.shopify_product_id,
          shopify_variant_id: data.shopify_variant_id,
          shopify_url: data.url,
          shopify_price: price,
          shopify_listed_date: today(),
          status: "listed",
        }).eq("id", card.id);
      }
      return data;
    } finally { setListing(false); }
  };

  const delistFromShopify = async (card: Card) => {
    const res = await fetch("/api/shopify", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopify_product_id: card.shopify_product_id }),
    });
    const data = await res.json();
    if (data.success) {
      await supabase.from("cards").update({
        shopify_product_id: null, shopify_variant_id: null, shopify_url: null, shopify_price: null, shopify_listed_date: null,
      }).eq("id", card.id);
    }
    return data;
  };

  const listOnMultiple = async (card: Card, price: number, platforms: string[], images?: string[]) => {
    const results: Record<string, any> = {};
    for (const platform of platforms) {
      if (platform === "eBay") results.ebay = await listOnEbay(card, price, images);
      if (platform === "Shopify") results.shopify = await listOnShopify(card, price, images);
      if (platform === "Mercari") {
        await supabase.from("cards").update({ mercari_listed: true }).eq("id", card.id);
        results.mercari = { success: true, manual: true };
      }
      if (platform === "Facebook") {
        await supabase.from("cards").update({ facebook_listed: true }).eq("id", card.id);
        results.facebook = { success: true, manual: true };
      }
    }
    return results;
  };

  const delistEverywhere = async (card: Card) => {
    if (card.ebay_offer_id) await delistFromEbay(card);
    if (card.shopify_product_id) await delistFromShopify(card);
    await supabase.from("cards").update({
      mercari_listed: false, facebook_listed: false, tcgplayer_listed: false,
      status: "raw",
    }).eq("id", card.id);
  };

  const updatePriceEverywhere = async (
    card: Card & { ebay_offer_id?: string; shopify_product_id?: string; shopify_variant_id?: string },
    newPrice: number
  ) => {
    const results: Record<string, boolean> = {};
    if (card.ebay_offer_id) {
      try {
        const res = await fetch("/api/ebay", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ebay_offer_id: card.ebay_offer_id, price: newPrice }),
        });
        results.ebay = (await res.json()).success || false;
      } catch { results.ebay = false; }
    }
    if (card.shopify_product_id) {
      try {
        const res = await fetch("/api/shopify", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopify_product_id: card.shopify_product_id,
            shopify_variant_id: card.shopify_variant_id,
            price: newPrice,
          }),
        });
        results.shopify = (await res.json()).success || false;
      } catch { results.shopify = false; }
    }
    return results;
  };

  const getListingStatus = (card: Card) => {
    const platforms: string[] = [];
    if (card.ebay_listing_id) platforms.push("eBay");
    if (card.shopify_product_id) platforms.push("Shopify");
    if (card.whatnot_listing_id) platforms.push("Whatnot");
    if (card.mercari_listed) platforms.push("Mercari");
    if (card.facebook_listed) platforms.push("Facebook");
    if (card.tcgplayer_listed) platforms.push("TCGPlayer");
    return { platforms, count: platforms.length, isListed: platforms.length > 0 };
  };

  return {
    listing, listOnEbay, delistFromEbay, listOnShopify, delistFromShopify,
    listOnMultiple, delistEverywhere, updatePriceEverywhere, getListingStatus,
  };
}
