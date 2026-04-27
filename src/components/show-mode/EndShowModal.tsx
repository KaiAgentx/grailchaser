"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { BottomSheet } from "@/components/atoms/BottomSheet";
import { ModalTopBar } from "@/components/shell/ModalTopBar";
import { ActionButton } from "@/components/atoms/ActionButton";
import { StatCard } from "@/components/atoms/StatCard";
import { ErrorBanner } from "@/components/atoms/ErrorBanner";
import type { Show, ShowStats } from "@/lib/types";

/**
 * EndShowModal — bottom sheet for ending the active show.
 *
 * Renders a summary of the show's stats and an optional notes field.
 * Submit calls PATCH /api/tcg/shows/[id] with ended_at + notes.
 */

interface Props {
  open: boolean;
  show: Show;
  stats: ShowStats | null;
  onClose: () => void;
  /** Called when the show is successfully ended. Caller refetches active show + navigates. */
  onEnded: (updatedShow: Show) => void;
}

const inputStyle = {
  background: "var(--gc-bg-surface-2)",
  border: "1px solid var(--gc-border-subtle)",
  borderRadius: "var(--gc-radius-md)",
  padding: "12px 14px",
  color: "var(--gc-text-primary)",
  fontFamily: "var(--gc-font-ui)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box" as const,
  width: "100%",
  resize: "vertical" as const,
  minHeight: 80,
};

const fmtUsd = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function EndShowModal({ open, show, stats, onClose, onEnded }: Props) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setNotes("");
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const sb = createClient();
      const { data: session } = await sb.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setError("Not signed in."); setSubmitting(false); return; }
      const body: Record<string, unknown> = { ended_at: new Date().toISOString() };
      if (notes.trim()) body.notes = notes.trim();
      const res = await fetch(`/api/tcg/shows/${show.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.details || data?.message || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      onEnded((data?.show as Show) ?? show);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} ariaLabel="End show">
      <ModalTopBar title="End Show" onClose={handleClose} />
      <div className="font-gc-ui" style={{ padding: "16px 20px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
            Summary
          </div>
          <div style={{ fontSize: 14, color: "var(--gc-text-secondary)", marginBottom: 12 }}>
            {show.name || "Untitled show"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <StatCard label="Bought" value={stats?.bought_count ?? 0} />
            <StatCard label="Walked" value={stats?.walked_count ?? 0} />
            <StatCard label="Total Spent" value={stats ? fmtUsd(stats.total_spent_usd) : "$0"} emphasis="gold" />
            <StatCard label="Avg Discount" value={stats ? `${stats.avg_discount_pct.toFixed(1)}%` : "—"} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>
          Notes (optional)
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Anything to remember about this show?"
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        {error && (
          <div style={{ marginBottom: 14 }}>
            <ErrorBanner message="Couldn’t end show" detail={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <ActionButton
          variant="walk"
          label="END SHOW"
          size="lg"
          onClick={handleConfirm}
          loading={submitting}
          disabled={submitting}
        />
      </div>
    </BottomSheet>
  );
}
