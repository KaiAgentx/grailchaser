"use client";
import { useState } from "react";
import { Shell } from "@/components/shell/Shell";
import { ActionButton } from "@/components/atoms/ActionButton";
import { StatCard } from "@/components/atoms/StatCard";
import { SectionHeader } from "@/components/atoms/SectionHeader";
import { DecisionBadge } from "@/components/atoms/DecisionBadge";
import { LoadingSkeleton } from "@/components/atoms/LoadingSkeleton";
import { EmptyState } from "@/components/atoms/EmptyState";
import { EndShowModal } from "./EndShowModal";
import { useShowStats } from "@/hooks/useShowStats";
import { createClient } from "@/lib/supabase";
import type { Show, ShowDecisionTimelineEntry } from "@/lib/types";

/**
 * ShowModeHomeActive — landing screen when a show is active.
 *
 *   - Header: show name + relative elapsed time + "End Show" right-action
 *   - Stats row: bought / walked / negotiated / total spent
 *   - Big "Open Camera" CTA → routes to ScanScreen with scanIntent="show_mode"
 *     (Commit 5 wires the post-recognize redirect into ShowModeResult; for
 *     Commit 4 the scan flow falls through to the existing ResultScreen)
 *   - Decision timeline feed (latest first)
 *   - Dev-only injection field for ShowModeResult — pastes a UUID or "latest"
 *
 * No polling. Stats refetch on mount. Caller triggers refetch after
 * decisions land (in Commit 5).
 */

interface Props {
  show: Show;
  onBack: () => void;
  onOpenCamera: () => void;
  onEnded: () => void;
  onTestInjectScanResult: (scanResultId: string) => void;
}

const fmtUsd = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function fmtElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just started";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  return mr > 0 ? `${h}h ${mr}m ago` : `${h}h ago`;
}

export function ShowModeHomeActive({ show, onBack, onOpenCamera, onEnded, onTestInjectScanResult }: Props) {
  const { stats, loading: statsLoading } = useShowStats(show.id);
  const [endOpen, setEndOpen] = useState(false);

  return (
    <>
      <Shell title={show.name || "Active Show"} back={onBack}>
        <div className="font-gc-ui" style={{ paddingTop: 12 }}>
          {/* Header strip */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "var(--gc-text-muted)" }}>
              Started {fmtElapsed(show.started_at)}
            </span>
            <button
              onClick={() => setEndOpen(true)}
              className="font-gc-ui"
              style={{
                padding: "6px 12px",
                minHeight: 32,
                background: "transparent",
                border: "1px solid color-mix(in srgb, var(--gc-semantic-danger) 40%, transparent)",
                borderRadius: "var(--gc-radius-pill)",
                color: "var(--gc-semantic-danger)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              End Show
            </button>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <StatCard label="Bought" value={stats?.bought_count ?? 0} />
            <StatCard label="Walked" value={stats?.walked_count ?? 0} />
            <StatCard label="Negotiated" value={stats?.negotiated_count ?? 0} />
            <StatCard label="Total Spent" value={stats ? fmtUsd(stats.total_spent_usd) : "$0"} emphasis="gold" />
          </div>

          {/* Open Camera CTA */}
          <button
            onClick={onOpenCamera}
            className="font-gc-ui"
            style={{
              width: "100%",
              padding: "20px 24px",
              minHeight: 80,
              background: "color-mix(in srgb, var(--gc-zone-scan-500) 12%, var(--gc-bg-surface-1))",
              border: "1px solid color-mix(in srgb, var(--gc-zone-scan-500) 40%, transparent)",
              borderRadius: "var(--gc-radius-lg)",
              color: "var(--gc-text-primary)",
              cursor: "pointer",
              marginBottom: 24,
              boxShadow: "var(--gc-glow-scan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 0.3,
            }}
          >
            <span style={{ fontSize: 22 }}>📷</span>
            <span>OPEN CAMERA</span>
          </button>

          {/* Dev-only test inject */}
          {process.env.NODE_ENV === "development" && (
            <DevInjectScanResult onInject={onTestInjectScanResult} />
          )}

          {/* Decision feed */}
          <SectionHeader
            label="Decisions"
            rightSlot={
              <span style={{ fontSize: 11, color: "var(--gc-text-muted)" }}>
                {stats ? `${stats.decisions.length} total` : ""}
              </span>
            }
          />
          {statsLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <LoadingSkeleton height={56} borderRadius={12} />
              <LoadingSkeleton height={56} borderRadius={12} />
            </div>
          )}
          {!statsLoading && stats && stats.decisions.length === 0 && (
            <EmptyState
              icon="🎴"
              title="No decisions yet"
              description="Open the camera and scan a card to record your first decision."
            />
          )}
          {!statsLoading && stats && stats.decisions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...stats.decisions].reverse().map((d) => (
                <DecisionRow key={d.scan_result_id} entry={d} />
              ))}
            </div>
          )}
        </div>
      </Shell>

      <EndShowModal
        open={endOpen}
        show={show}
        stats={stats}
        onClose={() => setEndOpen(false)}
        onEnded={() => { setEndOpen(false); onEnded(); }}
      />
    </>
  );
}

function DecisionRow({ entry }: { entry: ShowDecisionTimelineEntry }) {
  const fmtPrice = (v: number | null) => v != null ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—";
  return (
    <div
      className="font-gc-ui"
      style={{
        background: "var(--gc-bg-surface-1)",
        border: "1px solid var(--gc-border-subtle)",
        borderRadius: "var(--gc-radius-md)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gc-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.player ?? "Unknown card"}
        </div>
        <div style={{ fontSize: 11, color: "var(--gc-text-muted)", marginTop: 2 }}>
          Ask {fmtPrice(entry.ask_price_usd)}
          {entry.final_price_usd != null && ` · Paid ${fmtPrice(entry.final_price_usd)}`}
        </div>
      </div>
      <DecisionBadge decision={entry.decision} size="sm" />
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dev-only field. Accepts a scan_result UUID or the literal "latest"
 * (which queries the user's most recent scan_results row).
 */
function DevInjectScanResult({ onInject }: { onInject: (scanResultId: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    const v = text.trim();
    if (!v) return;
    if (UUID_RE.test(v)) {
      onInject(v);
      return;
    }
    if (v === "latest") {
      setBusy(true);
      try {
        const sb = createClient();
        const { data: session } = await sb.auth.getSession();
        const userId = session?.session?.user.id;
        if (!userId) { setBusy(false); return; }
        const { data } = await sb
          .from("scan_results")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) onInject(data.id as string);
      } finally {
        setBusy(false);
      }
      return;
    }
    // Otherwise: invalid input, clear visual cue
    setText("");
  };

  return (
    <div
      className="font-gc-ui"
      style={{
        background: "var(--gc-bg-surface-2)",
        border: "1px dashed var(--gc-border-strong)",
        borderRadius: "var(--gc-radius-md)",
        padding: "12px 14px",
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 10, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>
        Dev: inject scan result
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="UUID or 'latest'"
          style={{
            flex: 1,
            background: "var(--gc-bg-surface-1)",
            border: "1px solid var(--gc-border-subtle)",
            borderRadius: "var(--gc-radius-sm)",
            padding: "8px 10px",
            fontSize: 12,
            color: "var(--gc-text-primary)",
            fontFamily: "var(--gc-font-mono)",
            outline: "none",
          }}
        />
        <button
          onClick={handle}
          disabled={busy || !text.trim()}
          style={{
            padding: "8px 14px",
            background: "var(--gc-zone-actions-500)",
            border: "none",
            borderRadius: "var(--gc-radius-sm)",
            color: "#0a0a12",
            fontSize: 12,
            fontWeight: 600,
            cursor: text.trim() && !busy ? "pointer" : "not-allowed",
            opacity: text.trim() && !busy ? 1 : 0.5,
          }}
        >
          {busy ? "…" : "INJECT"}
        </button>
      </div>
    </div>
  );
}
