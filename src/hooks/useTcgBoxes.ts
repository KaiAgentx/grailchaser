"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Box, BoxType } from "./useBoxes";

/**
 * TCG-specific boxes hook.
 *
 * Hardcodes mode='tcg' filter at the query level so TCG screens never
 * receive sports boxes (Closes BUG-001 in the boxes domain).
 *
 * addBox always inserts mode='tcg' — sports boxes are created via
 * the legacy useBoxes hook.
 */
export function useTcgBoxes(userId?: string, cards?: any[]) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchBoxes = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("boxes")
      .select("*")
      .eq("user_id", userId)
      .eq("mode", "tcg")
      .order("created_at", { ascending: true });
    if (error) console.error("fetchTcgBoxes error:", error);
    if (!error && data) setBoxes(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchBoxes(); }, [fetchBoxes]);

  // Enrich boxes with card counts from the cards array
  const enrichedBoxes = boxes.map(b => ({
    ...b,
    card_count: cards ? cards.filter(c => c.storage_box === b.name).length : 0,
  }));

  const addBox = async (name: string, num_rows: number, divider_size: number, box_type: BoxType) => {
    if (!userId) return { error: { message: "Not logged in" } };
    const row: any = { user_id: userId, name, num_rows, divider_size, box_type, mode: "tcg" };
    const { data, error } = await supabase
      .from("boxes")
      .insert(row)
      .select()
      .single();
    if (error) console.error("addTcgBox error:", error);
    if (!error && data) setBoxes(prev => [...prev, data]);
    return { data, error };
  };

  const updateBox = async (id: string, updates: Partial<Pick<Box, "name" | "num_rows" | "divider_size" | "box_type">>) => {
    const { error } = await supabase.from("boxes").update(updates).eq("id", id);
    if (!error) setBoxes(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    return { error };
  };

  const deleteBox = async (id: string) => {
    const { error } = await supabase.from("boxes").delete().eq("id", id);
    if (!error) setBoxes(prev => prev.filter(b => b.id !== id));
    return { error };
  };

  const getNextPosition = (boxName: string): number => {
    if (!cards) return 1;
    const boxCards = cards.filter((c: any) => c.storage_box === boxName);
    if (boxCards.length === 0) return 1;
    return Math.max(...boxCards.map((c: any) => c.storage_position || 0)) + 1;
  };

  const getBoxCards = (boxName: string) => {
    if (!cards) return [];
    return cards
      .filter((c: any) => c.storage_box === boxName)
      .sort((a: any, b: any) => (a.storage_row || 1) - (b.storage_row || 1) || (a.storage_position || 0) - (b.storage_position || 0));
  };

  return { boxes: enrichedBoxes, loading, fetchBoxes, addBox, updateBox, deleteBox, getNextPosition, getBoxCards };
}
