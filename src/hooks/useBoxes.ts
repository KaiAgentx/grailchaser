"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

export interface Box {
  id: string;
  user_id: string;
  name: string;
  num_rows: number;
  divider_size: number;
  created_at: string;
}

export function useBoxes(userId?: string) {
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
      .order("created_at", { ascending: true });
    if (!error && data) setBoxes(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchBoxes(); }, [fetchBoxes]);

  const addBox = async (name: string, num_rows: number, divider_size: number) => {
    if (!userId) return { error: { message: "Not logged in" } };
    const { data, error } = await supabase
      .from("boxes")
      .insert({ user_id: userId, name, num_rows, divider_size })
      .select()
      .single();
    if (!error && data) setBoxes(prev => [...prev, data]);
    return { data, error };
  };

  const updateBox = async (id: string, updates: Partial<Pick<Box, "name" | "num_rows" | "divider_size">>) => {
    const { error } = await supabase.from("boxes").update(updates).eq("id", id);
    if (!error) setBoxes(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    return { error };
  };

  const deleteBox = async (id: string) => {
    const { error } = await supabase.from("boxes").delete().eq("id", id);
    if (!error) setBoxes(prev => prev.filter(b => b.id !== id));
    return { error };
  };

  return { boxes, loading, fetchBoxes, addBox, updateBox, deleteBox };
}
