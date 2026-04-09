"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Card, NewCard, CardStatus } from "@/lib/types";
import { calcTier, shouldFlagForGrading, today } from "@/lib/utils";

export function useCards(userId?: string) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchCards = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("cards")
      .select("*")
      .order("created_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (!error && data) setCards(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const addCard = async (card: Partial<NewCard>) => {
    // Use the server-validated /api/sports/collection-items endpoint
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) return { data: null, error: { message: "Not authenticated" } };

      const idemKey = crypto.randomUUID();
      const res = await fetch("/api/sports/collection-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify({
          player: card.player || "Unknown",
          sport: card.sport || "Baseball",
          team: card.team,
          year: card.year,
          brand: card.brand,
          set: card.set,
          parallel: card.parallel,
          card_number: card.card_number,
          is_rc: card.is_rc,
          is_auto: card.is_auto,
          is_numbered: card.is_numbered,
          numbered_to: card.numbered_to,
          condition: card.condition,
          raw_value: card.raw_value,
          cost_basis: card.cost_basis,
          storage_box: card.storage_box,
          notes: card.notes,
          purchase_source: card.purchase_source,
          purchase_intent: card.purchase_intent,
          graded_values: card.graded_values,
          gem_probability: card.gem_probability,
          scan_image_url: card.scan_image_url,
          game: "sports",
        }),
      });
      const result = await res.json();
      if (res.ok && result.card) {
        setCards(prev => [result.card, ...prev]);
        return { data: result.card, error: null };
      }
      return { data: null, error: { message: result.error || result.details || "Save failed" } };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  };

  const addCards = async (cardData: Partial<NewCard>[]) => {
    const inserts = cardData.map(c => {
      const rawVal = c.raw_value || 0;
      const gemProb = Math.random() * 0.6 + 0.1;
      return {
        ...(userId ? { user_id: userId } : {}),
        player: c.player || "Unknown", sport: c.sport || "Baseball", team: c.team || "",
        year: c.year || new Date().getFullYear(), brand: c.brand || "Topps", set: c.set || "Base",
        parallel: c.parallel || "Base", card_number: c.card_number || "#1",
        is_rc: c.is_rc || false, is_auto: c.is_auto || false,
        is_numbered: c.is_numbered || false, numbered_to: c.numbered_to || null,
        condition: c.condition || "NM", raw_value: rawVal, cost_basis: c.cost_basis || 0,
        purchase_source: c.purchase_source || null, purchase_date: c.purchase_date || null, purchase_intent: c.purchase_intent || null,
        tier: calcTier(rawVal), gem_probability: +gemProb.toFixed(2),
        graded_values: { "10": +(rawVal*3).toFixed(2), "9": +(rawVal*1.8).toFixed(2), "8": +(rawVal*1.2).toFixed(2), "7": +(rawVal*0.95).toFixed(2) },
        status: "raw" as CardStatus, watchlist: false, grade_candidate: shouldFlagForGrading(rawVal, gemProb),
        storage_box: c.storage_box || "PENDING", storage_row: c.storage_row || 1, storage_position: c.storage_position || 1,
        scan_image_url: c.scan_image_url || null, scan_image_back_url: c.scan_image_back_url || null,
        notes: c.notes || "", date_added: today(),
        listed_platform: null, listed_price: null, listed_date: null,
        sold: false, sold_price: null, sold_date: null, sold_platform: null,
        shipped_date: null, tracking_number: null,
        grading_company: null, grading_submit_date: null, grading_return_date: null,
        graded_grade: null, grading_cost: null, grading_cert: null,
      };
    });
    const { data, error } = await supabase.from("cards").insert(inserts).select();
    if (!error && data) setCards(prev => [...data, ...prev]);
    return { data, error };
  };

  const updateCard = async (id: string, updates: Partial<Card>) => {
    if (updates.raw_value !== undefined) {
      updates.tier = calcTier(updates.raw_value);
    }
    const { error } = await supabase.from("cards").update(updates).eq("id", id);
    if (!error) setCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    return { error };
  };

  const deleteCard = async (id: string) => {
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (!error) setCards(prev => prev.filter(c => c.id !== id));
    return { error };
  };

  const deleteCards = async (ids: string[]) => {
    const { error } = await supabase.from("cards").delete().in("id", ids);
    if (!error) setCards(prev => prev.filter(c => !ids.includes(c.id)));
    return { error };
  };

  const markListed = async (id: string, platform: string, price: number) => {
    return updateCard(id, { status: "listed", listed_platform: platform, listed_price: price, listed_date: today() });
  };

  const markSold = async (id: string, price: number, platform: string) => {
    const card = cards.find(c => c.id === id);
    const result = await updateCard(id, { status: "sold", sold: true, sold_price: price, sold_date: today(), sold_platform: platform });
    if (card?.listed_platform && card.listed_platform !== platform) {
      return { ...result, delistReminder: card.listed_platform };
    }
    return result;
  };

  const markShipped = async (id: string, tracking?: string) => {
    return updateCard(id, { status: "shipped", shipped_date: today(), tracking_number: tracking || null });
  };

  const submitForGrading = async (id: string, company: string) => {
    const fees: Record<string, number> = { PSA: 24.99, BGS: 14.95, CGC: 15.00, SGC: 9.00 };
    return updateCard(id, { status: "grading", grading_company: company, grading_submit_date: today(), grading_cost: fees[company] || 24.99 });
  };

  const returnFromGrading = async (id: string, grade: string) => {
    const card = cards.find(c => c.id === id);
    return updateCard(id, {
      status: "graded", graded_grade: grade, grading_return_date: today(),
      storage_box: "SLAB-" + (card?.grading_company || "01"),
    });
  };

  const toggleWatchlist = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (card) return updateCard(id, { watchlist: !card.watchlist });
  };

  const toggleGradeCandidate = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (card) return updateCard(id, { grade_candidate: !card.grade_candidate });
  };

  const batchUpdate = async (ids: string[], updates: Partial<Card>) => {
    const { error } = await supabase.from("cards").update(updates).in("id", ids);
    if (!error) setCards(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...updates } : c));
    return { error };
  };

  const updateCardLocation = async (id: string, location: { box: string; row: number; position: number }) => {
    return updateCard(id, { storage_box: location.box, storage_row: location.row, storage_position: location.position });
  };

  const getNextPosition = (box: string): { row: number; position: number } => {
    const boxCards = cards.filter(c => c.storage_box === box);
    if (boxCards.length === 0) return { row: 1, position: 1 };
    const maxPos = Math.max(...boxCards.map(c => c.storage_position));
    const maxRow = Math.max(...boxCards.map(c => c.storage_row));
    return maxPos >= 800 ? { row: maxRow + 1, position: 1 } : { row: maxRow, position: maxPos + 1 };
  };

  const isDuplicate = (card: Card): boolean => {
    return cards.some(c =>
      c.player === card.player && c.year === card.year &&
      c.brand === card.brand && c.set === card.set &&
      c.card_number === card.card_number && c.parallel === card.parallel &&
      c.id !== card.id
    );
  };

  const uploadCardImage = async (cardId: string, file: File, side: "front" | "back" = "front") => {
    const ext = file.name.split(".").pop();
    const path = cardId + "/" + side + "." + ext;
    const { error: uploadError } = await supabase.storage.from("card-images").upload(path, file, { upsert: true });
    if (uploadError) return { error: uploadError };
    const { data: { publicUrl } } = supabase.storage.from("card-images").getPublicUrl(path);
    const field = side === "front" ? "scan_image_url" : "scan_image_back_url";
    return updateCard(cardId, { [field]: publicUrl });
  };

  const renumberBox = async (boxName: string): Promise<number> => {
    const boxCards = cards
      .filter(c => c.storage_box === boxName)
      .sort((a, b) => (a.storage_position || 0) - (b.storage_position || 0));
    let count = 0;
    for (let i = 0; i < boxCards.length; i++) {
      const newPos = i + 1;
      if (boxCards[i].storage_position !== newPos) {
        await supabase.from("cards").update({ storage_position: newPos }).eq("id", boxCards[i].id);
        count++;
      }
    }
    if (count > 0) await fetchCards();
    return count;
  };

  return {
    cards, loading, fetchCards,
    addCard, addCards, updateCard, deleteCard, deleteCards,
    markListed, markSold, markShipped, submitForGrading, returnFromGrading,
    toggleWatchlist, toggleGradeCandidate,
    batchUpdate, getNextPosition, updateCardLocation, isDuplicate, uploadCardImage,
    renumberBox,
  };
}
