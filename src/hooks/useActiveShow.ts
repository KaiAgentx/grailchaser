"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Show } from "@/lib/types";

/**
 * Fetches the user's currently-active show via GET /api/tcg/shows/active.
 *
 * Returns the row when ended_at IS NULL; null otherwise. No polling — refetch
 * on mount and on demand (start/end transitions). Callers trigger refetch
 * after POST /shows or PATCH /shows/[id].
 */
export function useActiveShow() {
  const [activeShow, setActiveShow] = useState<Show | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = createClient();
      const { data: session } = await sb.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setActiveShow(null); setLoading(false); return; }
      const res = await fetch("/api/tcg/shows/active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setActiveShow(null);
        return;
      }
      const data = await res.json();
      setActiveShow((data?.show as Show | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load active show");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { activeShow, loading, error, refetch };
}
