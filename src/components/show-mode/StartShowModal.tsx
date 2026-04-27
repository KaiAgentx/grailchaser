"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { BottomSheet } from "@/components/atoms/BottomSheet";
import { ModalTopBar } from "@/components/shell/ModalTopBar";
import { ActionButton } from "@/components/atoms/ActionButton";
import { ErrorBanner } from "@/components/atoms/ErrorBanner";
import type { Show } from "@/lib/types";

/**
 * StartShowModal — bottom sheet to start a new show.
 *
 * Two visible inputs (Show Name + Venue) collapsed into the single `name`
 * field on the server: "{Name} · {Venue}" when venue provided. The shows
 * table has no venue column — flagged as a future migration if we need
 * to query by venue independently.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the newly-created Show on success. Caller refetches the active show. */
  onStarted: (show: Show) => void;
}

const inputStyle = {
  background: "var(--gc-bg-surface-2)",
  border: "1px solid var(--gc-border-subtle)",
  borderRadius: "var(--gc-radius-md)",
  padding: "12px 14px",
  minHeight: 44,
  color: "var(--gc-text-primary)",
  fontFamily: "var(--gc-font-ui)",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box" as const,
  width: "100%",
};

export function StartShowModal({ open, onClose, onStarted }: Props) {
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setName(""); setVenue(""); setError(null); setSubmitting(false); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const sb = createClient();
      const { data: session } = await sb.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setError("Not signed in."); setSubmitting(false); return; }
      const trimmedName = name.trim();
      const trimmedVenue = venue.trim();
      const finalName = trimmedVenue ? `${trimmedName || "Show"} · ${trimmedVenue}` : (trimmedName || null);
      const res = await fetch("/api/tcg/shows", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: finalName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "show_already_active") {
          setError("You already have an active show. End it before starting a new one.");
        } else {
          setError(data?.details || data?.message || `HTTP ${res.status}`);
        }
        setSubmitting(false);
        return;
      }
      const show = data?.show as Show | undefined;
      if (!show) { setError("Server returned no show."); setSubmitting(false); return; }
      reset();
      onStarted(show);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} ariaLabel="Start show">
      <ModalTopBar title="Start Show" onClose={handleClose} />
      <div className="font-gc-ui" style={{ padding: "16px 20px 24px" }}>
        <Label>Show Name</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Capital Card Show"
          maxLength={80}
          style={{ ...inputStyle, marginBottom: 14 }}
          autoFocus
        />
        <Label>Venue (optional)</Label>
        <input
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Frank & Sons"
          maxLength={80}
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        {error && (
          <div style={{ marginBottom: 14 }}>
            <ErrorBanner message="Couldn’t start show" detail={error} onDismiss={() => setError(null)} />
          </div>
        )}
        <ActionButton
          variant="buy"
          label="START SHOW"
          size="lg"
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting}
        />
      </div>
    </BottomSheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>{children}</div>;
}
