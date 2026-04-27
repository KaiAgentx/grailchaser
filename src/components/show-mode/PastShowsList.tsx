"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { Show } from "@/lib/types";
import { LoadingSkeleton } from "@/components/atoms/LoadingSkeleton";
import { EmptyState } from "@/components/atoms/EmptyState";

/**
 * PastShowsList — read-only summary rows of the user's ended shows.
 *
 * Queries the `shows` table directly via the supabase client (RLS gates
 * to user_id = auth.uid()). No new API endpoint needed. Tap-to-detail
 * navigation deferred to a future commit (PastShowDetailView).
 */

interface Props {
  userId: string;
}

export function PastShowsList({ userId }: Props) {
  const [shows, setShows] = useState<Show[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("shows")
        .select("*")
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) {
        console.error("[PastShowsList] query failed:", error.message);
        setShows([]);
      } else {
        setShows((data as Show[]) ?? []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <LoadingSkeleton height={64} borderRadius={14} />
        <LoadingSkeleton height={64} borderRadius={14} />
        <LoadingSkeleton height={64} borderRadius={14} />
      </div>
    );
  }
  if (!shows || shows.length === 0) {
    return (
      <EmptyState
        icon="📒"
        title="No past shows yet"
        description="Past shows show up here once you end your first show."
      />
    );
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {shows.map((s) => (
        <div
          key={s.id}
          className="font-gc-ui"
          style={{
            background: "var(--gc-bg-surface-1)",
            border: "1px solid var(--gc-border-subtle)",
            borderRadius: "var(--gc-radius-md)",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--gc-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.name || "Untitled show"}
            </div>
            <div style={{ fontSize: 11, color: "var(--gc-text-muted)", marginTop: 2 }}>
              {fmtDate(s.started_at)}
              {s.ended_at && ` → ${fmtDate(s.ended_at)}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
