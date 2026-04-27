"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { ShowStats } from "@/lib/types";

/**
 * Fetches aggregated stats for a single show via GET /api/tcg/shows/[id]/stats.
 *
 * No polling. Refetch on mount, when showId changes, and on demand (called by
 * the parent after a decision lands).
 */
export function useShowStats(showId: string | null | undefined) {
  const [stats, setStats] = useState<ShowStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!showId) { setStats(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const sb = createClient();
      const { data: session } = await sb.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setStats(null); setLoading(false); return; }
      const res = await fetch(`/api/tcg/shows/${showId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setStats(null);
        return;
      }
      const data = await res.json();
      setStats((data?.stats as ShowStats) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load show stats");
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { stats, loading, error, refetch };
}
