"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Card } from "@/lib/types";
import { calcTier, today } from "@/lib/utils";

/**
 * TCG-specific cards hook.
 *
 * Mirrors the shape of useCards, but filters at the query level so that
 * TCG screens never receive sports cards in their data array (Closes
 * BUG-001 in the TCG → Sports leak direction at the query layer).
 *
 * Mutations that are sports-specific (addCard, addCards, submitForGrading,
 * returnFromGrading) are intentionally omitted — TCG saves go through
 * /api/tcg/collection-items directly, and TCG cards are not graded.
 *
 * @param userId  authenticated user id
 * @param game    optional narrowing — if provided, filters to a single
 *                TCG game (e.g., 'pokemon'). When omitted, all TCG games
 *                are returned (game IN ('pokemon','mtg','one_piece')).
 */
export function useCards(userId?: string, game?: 'pokemon' | 'mtg' | 'one_piece') {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchCards = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    let query = supabase
      .from("cards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (game) {
      query = query.eq("game", game);
    } else {
      query = query.in("game", ["pokemon", "mtg", "one_piece"]);
    }
    const { data, error } = await query;
    if (!error && data) setCards(data);
    setLoading(false);
  }, [userId, game]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  /** Push a freshly-saved card row into local state (newest-first). */
  const addCard = (row: Card) => {
    setCards(prev => [row, ...prev]);
  };

  /** Replace a card row in state with a fresh copy from the server. */
  const updateCardPrice = (id: string, updatedRow: Card) => {
    setCards(prev => prev.map(c => c.id === id ? updatedRow : c));
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

  const batchUpdate = async (ids: string[], updates: Partial<Card>) => {
    const { error } = await supabase.from("cards").update(updates).in("id", ids);
    if (!error) setCards(prev => prev.map(c => ids.includes(c.id) ? { ...c, ...updates } : c));
    return { error };
  };

  const getNextPosition = (box: string): { row: number; position: number } => {
    const boxCards = cards.filter(c => c.storage_box === box);
    if (boxCards.length === 0) return { row: 1, position: 1 };
    const maxPos = Math.max(...boxCards.map(c => c.storage_position));
    const maxRow = Math.max(...boxCards.map(c => c.storage_row));
    return maxPos >= 800 ? { row: maxRow + 1, position: 1 } : { row: maxRow, position: maxPos + 1 };
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
    cards, loading, fetchCards, addCard, updateCardPrice,
    updateCard, deleteCard, deleteCards,
    markListed, markSold, markShipped,
    batchUpdate, getNextPosition, renumberBox,
  };
}
