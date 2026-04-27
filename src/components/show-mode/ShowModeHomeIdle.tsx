"use client";
import { useState } from "react";
import { Shell } from "@/components/shell/Shell";
import { ActionButton } from "@/components/atoms/ActionButton";
import { SectionHeader } from "@/components/atoms/SectionHeader";
import { PastShowsList } from "./PastShowsList";
import { StartShowModal } from "./StartShowModal";
import type { Show } from "@/lib/types";

/**
 * ShowModeHomeIdle — landing screen when there's no active show.
 *
 *   - Hero CTA: "Start a Show"
 *   - Past Shows list below (read-only summary rows)
 */

interface Props {
  userId: string;
  onBack: () => void;
  /** Called after a show is successfully started. Caller refetches active show + flips to ShowModeHomeActive. */
  onStarted: (show: Show) => void;
}

export function ShowModeHomeIdle({ userId, onBack, onStarted }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Shell title="Show Mode" back={onBack}>
        <div className="font-gc-ui" style={{ paddingTop: 24 }}>
          {/* Hero CTA */}
          <div
            style={{
              background: "color-mix(in srgb, var(--gc-zone-show-500) 8%, var(--gc-bg-surface-1))",
              border: "1px solid color-mix(in srgb, var(--gc-zone-show-500) 35%, transparent)",
              borderRadius: "var(--gc-radius-lg)",
              padding: 24,
              textAlign: "center",
              marginBottom: 24,
              boxShadow: "var(--gc-glow-show)",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gc-text-primary)", marginBottom: 6 }}>
              Start a Show
            </div>
            <div style={{ fontSize: 13, color: "var(--gc-text-secondary)", marginBottom: 20, maxWidth: 280, margin: "0 auto 20px" }}>
              Track every walk, negotiation, and buy. Live verdict math on each scan.
            </div>
            <ActionButton
              variant="negotiate"
              label="START SHOW"
              size="lg"
              onClick={() => setModalOpen(true)}
            />
          </div>

          <SectionHeader label="Past Shows" />
          <PastShowsList userId={userId} />
        </div>
      </Shell>

      <StartShowModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onStarted={(show) => { setModalOpen(false); onStarted(show); }}
      />
    </>
  );
}
