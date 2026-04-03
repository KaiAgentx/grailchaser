"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

export interface Lot {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  source_box: string;
  status: "draft" | "listed" | "sold" | "shipped";
  platform: string | null;
  asking_price: number | null;
  sold_price: number | null;
  shipping_cost: number | null;
  listed_date: string | null;
  sold_date: string | null;
  shipped_date: string | null;
  tracking_number: string | null;
  card_count: number;
  total_raw_value: number;
  total_cost_basis: number;
  created_at: string;
}

export function useLots(userId?: string) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchLots = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("lots").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) console.error("fetchLots error:", error);
    if (!error && data) setLots(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  const today = () => new Date().toISOString().slice(0, 10);

  const createLot = async (title: string, description: string, sourceBox: string, cardIds: string[], askingPrice: number, totalRawValue: number, totalCostBasis: number) => {
    if (!userId) return { data: null, error: { message: "Not logged in" } };
    const { data, error } = await supabase.from("lots").insert({
      user_id: userId, title, description, source_box: sourceBox,
      card_count: cardIds.length, total_raw_value: totalRawValue, total_cost_basis: totalCostBasis,
      asking_price: askingPrice, status: "draft",
    }).select().single();
    if (error) return { data: null, error };
    // Tag cards
    for (const cid of cardIds) {
      await supabase.from("cards").update({ lot_id: data.id }).eq("id", cid);
    }
    setLots(prev => [data, ...prev]);
    return { data, error: null };
  };

  const updateLot = async (id: string, updates: Partial<Lot>) => {
    const { error } = await supabase.from("lots").update(updates).eq("id", id);
    if (!error) setLots(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    return { error };
  };

  const deleteLot = async (id: string) => {
    const lot = lots.find(l => l.id === id);
    if (lot && lot.status !== "draft") return { error: { message: "Only draft lots can be deleted" } };
    // Clear lot_id from cards
    await supabase.from("cards").update({ lot_id: null }).eq("lot_id", id);
    const { error } = await supabase.from("lots").delete().eq("id", id);
    if (!error) setLots(prev => prev.filter(l => l.id !== id));
    return { error };
  };

  const markLotListed = async (id: string, platform: string, askingPrice: number) => {
    return updateLot(id, { status: "listed", platform, asking_price: askingPrice, listed_date: today() } as any);
  };

  const markLotSold = async (id: string, soldPrice: number, platform: string) => {
    const lot = lots.find(l => l.id === id);
    if (!lot) return { error: { message: "Lot not found" } };
    const result = await updateLot(id, { status: "sold", sold_price: soldPrice, sold_date: today(), platform } as any);
    // Mark all cards as sold
    const perCard = +(soldPrice / lot.card_count).toFixed(2);
    const { data: lotCards } = await supabase.from("cards").select("id").eq("lot_id", id);
    if (lotCards) {
      for (const c of lotCards) {
        await supabase.from("cards").update({ status: "sold", sold: true, sold_price: perCard, sold_date: today(), sold_platform: platform }).eq("id", c.id);
      }
    }
    return result;
  };

  const markLotShipped = async (id: string, shippingCost: number, trackingNumber: string) => {
    const result = await updateLot(id, { status: "shipped", shipping_cost: shippingCost, shipped_date: today(), tracking_number: trackingNumber } as any);
    const { data: lotCards } = await supabase.from("cards").select("id").eq("lot_id", id);
    if (lotCards) {
      for (const c of lotCards) {
        await supabase.from("cards").update({ status: "shipped", shipped_date: today(), tracking_number: trackingNumber }).eq("id", c.id);
      }
    }
    return result;
  };

  return { lots, loading, fetchLots, createLot, updateLot, deleteLot, markLotListed, markLotSold, markLotShipped };
}
