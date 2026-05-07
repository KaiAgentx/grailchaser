"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { Game, ScanDecision } from "@/lib/types";

/**
 * useHomeData — owns the home screen's data fetch.
 *
 * Three queries fired in parallel:
 *   1. cards (count + raw_value sum + last 5 thumbs) — collection summary + Recently Added
 *   2. scan_results (last 10) — Recent Activity feed; decision fields are
 *      columns on scan_results itself, no JOIN needed
 *   3. cards-by-scan_result_id — to know which activity rows resolved into
 *      saved cards (purchased rows that are tappable in the feed)
 */

export interface RecentlyAddedCard {
  id: string;
  player: string | null;
  set: string | null;
  card_number: string | null;
  raw_value: number | null;
  scan_image_url: string | null;
  created_at: string;
}

export interface HomeActivityItem {
  scanResultId: string;
  cardName: string;
  decision: ScanDecision | null;
  finalPriceUsd: number | null;
  createdAt: string;
  /** Set when the scan resolved into a saved card row. Tappable activity
   *  rows pass this id back to the parent for goToCardDetail navigation. */
  resolvedCardId: string | null;
}

export interface HomeData {
  cardCount: number | null;
  totalValue: number;
  /** Count of cards with status='graded'. */
  gradedCount: number;
  /** Portfolio-weighted ROI percent: (sum(raw)-sum(cost))/sum(cost)*100,
   *  computed only over cards with cost_basis > 0. null when no eligible. */
  roiPct: number | null;
  /** totalValue / cardCount; 0 when cardCount is 0. */
  avgCardValue: number;
  recentlyAdded: RecentlyAddedCard[];
  recentActivity: HomeActivityItem[];
  loading: boolean;
}

export function useHomeData(userId: string | null | undefined, activeGame: Game | null | undefined): HomeData {
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [gradedCount, setGradedCount] = useState<number>(0);
  const [roiPct, setRoiPct] = useState<number | null>(null);
  const [avgCardValue, setAvgCardValue] = useState<number>(0);
  const [recentlyAdded, setRecentlyAdded] = useState<RecentlyAddedCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<HomeActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId || !activeGame) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      try {
        const [statsRes, recentlyAddedRes, activityRes] = await Promise.allSettled([
          supabase.from("cards").select("id, raw_value, cost_basis, status", { count: "exact" }).eq("user_id", userId).eq("game", activeGame),
          supabase.from("cards").select("id, player, set, card_number, raw_value, scan_image_url, created_at").eq("user_id", userId).eq("game", activeGame).order("created_at", { ascending: false }).limit(5),
          supabase.from("scan_results").select("id, catalog_match_name, final_catalog_name, user_decision, final_price_usd, created_at").eq("user_id", userId).eq("game", activeGame).order("created_at", { ascending: false }).limit(10),
        ]);
        if (cancelled) return;

        if (statsRes.status === "fulfilled") {
          const rows: { raw_value: number | null; cost_basis: number | null; status: string | null }[] = statsRes.value.data || [];
          const count = statsRes.value.count ?? rows.length;
          const total = rows.reduce((s, r) => s + (Number(r.raw_value) || 0), 0);
          setCardCount(count);
          setTotalValue(total);
          setGradedCount(rows.filter(r => r.status === "graded").length);
          setAvgCardValue(count > 0 ? total / count : 0);

          // Portfolio-weighted ROI over cards with cost_basis > 0.
          // (sum(raw) - sum(cost)) / sum(cost) * 100. null when no eligible cards.
          const eligible = rows.filter(r => r.cost_basis != null && Number(r.cost_basis) > 0);
          if (eligible.length === 0) {
            setRoiPct(null);
          } else {
            const sumRaw = eligible.reduce((s, r) => s + (Number(r.raw_value) || 0), 0);
            const sumCost = eligible.reduce((s, r) => s + (Number(r.cost_basis) || 0), 0);
            setRoiPct(sumCost > 0 ? ((sumRaw - sumCost) / sumCost) * 100 : null);
          }
        } else {
          console.error("[useHomeData] stats query failed:", statsRes.reason);
          setCardCount(0);
          setTotalValue(0);
          setGradedCount(0);
          setAvgCardValue(0);
          setRoiPct(null);
        }

        if (recentlyAddedRes.status === "fulfilled") {
          setRecentlyAdded((recentlyAddedRes.value.data as RecentlyAddedCard[]) || []);
        } else {
          console.error("[useHomeData] recently-added query failed:", recentlyAddedRes.reason);
          setRecentlyAdded([]);
        }

        if (activityRes.status === "fulfilled") {
          const rows = (activityRes.value.data as Array<{
            id: string;
            catalog_match_name: string | null;
            final_catalog_name: string | null;
            user_decision: ScanDecision | null;
            final_price_usd: number | null;
            created_at: string;
          }>) || [];

          // Second query: which scan_result_ids resolved into saved cards?
          // Tappable rows in the feed need a card id to route to detail.
          const scanResultIds = rows.map(r => r.id);
          let cardByScanResult = new Map<string, string>();
          if (scanResultIds.length > 0) {
            const { data: linkedCards } = await supabase
              .from("cards")
              .select("id, scan_result_id")
              .eq("user_id", userId)
              .in("scan_result_id", scanResultIds);
            if (cancelled) return;
            for (const c of (linkedCards as { id: string; scan_result_id: string | null }[] | null) || []) {
              if (c.scan_result_id) cardByScanResult.set(c.scan_result_id, c.id);
            }
          }

          setRecentActivity(rows.map(r => ({
            scanResultId: r.id,
            cardName: r.final_catalog_name || r.catalog_match_name || "Unknown card",
            decision: r.user_decision,
            finalPriceUsd: r.final_price_usd,
            createdAt: r.created_at,
            resolvedCardId: cardByScanResult.get(r.id) ?? null,
          })));
        } else {
          console.error("[useHomeData] activity query failed:", activityRes.reason);
          setRecentActivity([]);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[useHomeData] threw:", err);
        setCardCount(0);
        setTotalValue(0);
        setGradedCount(0);
        setAvgCardValue(0);
        setRoiPct(null);
        setRecentlyAdded([]);
        setRecentActivity([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, activeGame]);

  return { cardCount, totalValue, gradedCount, roiPct, avgCardValue, recentlyAdded, recentActivity, loading };
}
