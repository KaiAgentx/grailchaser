"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoginScreen } from "@/components/LoginScreen";
import { AppShell } from "@/components/shell/AppShell";
import { Shell } from "@/components/shell/Shell";

import { ActionButton, type ActionVariant } from "@/components/atoms/ActionButton";
import { VerdictStrip } from "@/components/atoms/VerdictStrip";
import { PricePill } from "@/components/atoms/PricePill";
import { TrendIndicator } from "@/components/atoms/TrendIndicator";
import { StatCard } from "@/components/atoms/StatCard";
import { Sparkline } from "@/components/atoms/Sparkline";
import { Chip } from "@/components/atoms/Chip";
import { MoneyInput } from "@/components/atoms/MoneyInput";
import { TierBadge } from "@/components/atoms/TierBadge";
import { GameBadge } from "@/components/atoms/GameBadge";
import { RarityBadge } from "@/components/atoms/RarityBadge";
import { StatusPill } from "@/components/atoms/StatusPill";
import { ConfidenceBandBadge } from "@/components/atoms/ConfidenceBandBadge";
import { DecisionBadge } from "@/components/atoms/DecisionBadge";
import { EmptyState } from "@/components/atoms/EmptyState";
import { LoadingSkeleton } from "@/components/atoms/LoadingSkeleton";
import { ErrorBanner } from "@/components/atoms/ErrorBanner";
import { Toast } from "@/components/atoms/Toast";
import { BottomSheet } from "@/components/atoms/BottomSheet";
import { SectionHeader } from "@/components/atoms/SectionHeader";

/**
 * /design-system — auth-gated atom showcase. Dev-only utility; not linked
 * from BottomNav. Devs hit /design-system directly.
 *
 * This is the ONE exception to path-(b) routing — uses Next file-based
 * routing because it lives outside page.tsx's screen-state machine.
 *
 * BottomNav still renders via AppShell. Tab taps `router.push("/")` to
 * land on the main app; navProps' currentScreen doesn't match any tab,
 * so no tab is highlighted (intentional — the design-system route isn't
 * a real destination).
 */

const ACTION_VARIANTS: ActionVariant[] = [
  "buy", "walk", "negotiate", "grade", "move", "sell", "watch", "pull", "list",
];

export function DesignSystemView() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const router = useRouter();

  const [askPrice, setAskPrice] = useState(0);
  const [chipActive, setChipActive] = useState("a");
  const [toastOn, setToastOn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (authLoading) {
    return (
      <div style={{ background: "var(--gc-bg-canvas)", minHeight: "100vh", color: "var(--gc-text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading…
      </div>
    );
  }
  if (!user) return <LoginScreen signIn={signIn} signUp={signUp} />;

  // "__none__" sentinel: doesn't match any tab id in BottomNav's tabScreenMap,
  // so no active tab highlights — design-system isn't a real destination.
  const navProps = {
    currentScreen: "__none__",
    prevScreen: "__none__",
    onNavigate: () => router.push("/"),
  };

  const sparkData = [12.4, 13.1, 12.8, 14.0, 15.2, 14.6, 16.3, 17.1, 16.8, 18.4]
    .map((v, i) => ({ captured_at: new Date(Date.now() - (10 - i) * 86400000).toISOString(), value_usd: v }));

  return (
    <AppShell {...navProps}>
      <Shell title="Design System" back={() => router.push("/")}>
        <div className="font-gc-ui" style={{ paddingTop: 16, paddingBottom: 80, color: "var(--gc-text-primary)" }}>

          {/* ─── Action Engine ─── */}
          <H2>Action Engine</H2>
          <Grid cols={3}>
            {ACTION_VARIANTS.map((v) => (
              <ActionButton key={v} variant={v} onClick={() => {}} />
            ))}
          </Grid>
          <Note>Sizes (using buy variant):</Note>
          <Row>
            <ActionButton variant="buy" size="sm" />
            <ActionButton variant="buy" size="md" />
            <ActionButton variant="buy" size="lg" />
          </Row>
          <Note>States:</Note>
          <Row>
            <ActionButton variant="negotiate" loading />
            <ActionButton variant="walk" disabled />
          </Row>

          {/* ─── Pricing & Stats ─── */}
          <H2>Pricing & Stats</H2>
          <Row>
            <PricePill label="Market" value={1248} />
            <PricePill label="Ask" value={1350} />
            <PricePill label="Max" value={1250} />
            <PricePill label="PSA 10" value={2890} lastUpdated="Updated 2h ago" />
          </Row>
          <Note>Trend states:</Note>
          <Row>
            <TrendIndicator direction="up" pct={6.8} period="7D" />
            <TrendIndicator direction="down" pct={3.2} period="30D" />
            <TrendIndicator direction="flat" pct={0} period="7D" />
          </Row>
          <Grid cols={3}>
            <StatCard label="Total Value" value="$2,491" emphasis="gold" delta={<TrendIndicator direction="up" pct={4.1} period="7D" />} />
            <StatCard label="Cards" value={87} />
            <StatCard label="PSA 10s" value={4} delta="Avg ROI 142%" />
          </Grid>
          <Note>Sparkline (10 points, 30D price history):</Note>
          <Row>
            <Sparkline points={sparkData} width={120} height={32} />
            <Sparkline points={sparkData} color="var(--gc-semantic-success)" />
            <Sparkline points={sparkData} color="var(--gc-brand-gold-500)" width={160} height={48} />
          </Row>

          {/* ─── Inputs ─── */}
          <H2>Inputs</H2>
          <Note>MoneyInput (Dealer Ask):</Note>
          <div style={{ maxWidth: 280 }}>
            <MoneyInput value={askPrice} onChange={setAskPrice} />
          </div>
          <Note>Chip (selectable):</Note>
          <Row>
            {(["a", "b", "c"] as const).map((id) => (
              <Chip key={id} active={chipActive === id} onClick={() => setChipActive(id)}>
                {id === "a" ? "Pokémon" : id === "b" ? "MTG" : "One Piece"}
              </Chip>
            ))}
            <Chip disabled>Disabled</Chip>
          </Row>

          {/* ─── Badges ─── */}
          <H2>Badges</H2>
          <Note>TierBadge:</Note>
          <Row>
            <TierBadge tier="Bulk" />
            <TierBadge tier="Low" />
            <TierBadge tier="Mid" />
            <TierBadge tier="High" />
            <TierBadge tier="Unpriced" />
          </Row>
          <Note>GameBadge:</Note>
          <Row>
            <GameBadge game="pokemon" />
            <GameBadge game="mtg" />
            <GameBadge game="one_piece" />
          </Row>
          <Note>RarityBadge:</Note>
          <Row>
            <RarityBadge rarity="Common" />
            <RarityBadge rarity="Uncommon" />
            <RarityBadge rarity="Rare" />
            <RarityBadge rarity="Rare Holo" />
            <RarityBadge rarity="Rare Ultra" />
            <RarityBadge rarity="Rare Secret" />
            <RarityBadge rarity="Rainbow Rare" />
            <RarityBadge rarity="Promo" />
            <RarityBadge rarity="Hyper Rare" />
            <RarityBadge rarity="Some Unknown Future Value" />
          </Row>
          <Note>StatusPill:</Note>
          <Row>
            <StatusPill status="raw" />
            <StatusPill status="listed" />
            <StatusPill status="sold" />
            <StatusPill status="shipped" />
            <StatusPill status="grading" />
            <StatusPill status="graded" />
          </Row>
          <Note>ConfidenceBandBadge:</Note>
          <Row>
            <ConfidenceBandBadge band="exact" />
            <ConfidenceBandBadge band="likely" />
            <ConfidenceBandBadge band="choose_version" />
            <ConfidenceBandBadge band="unclear" />
          </Row>
          <Note>DecisionBadge:</Note>
          <Row>
            <DecisionBadge decision="walked" />
            <DecisionBadge decision="negotiated" />
            <DecisionBadge decision="purchased" />
          </Row>

          {/* ─── Layout ─── */}
          <H2>Layout</H2>
          <SectionHeader label="Recent Activity" rightSlot={<Chip>See all</Chip>} />
          <Note>VerdictStrip — three states:</Note>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            <VerdictStrip state="below_max" detail="18% off Market Value" />
            <VerdictStrip state="at_max" detail="Right at your ceiling" />
            <VerdictStrip state="above_max" detail="$50 above Max Buy" />
          </div>

          {/* ─── Feedback ─── */}
          <H2>Feedback</H2>
          <Note>EmptyState:</Note>
          <EmptyState
            icon="🎴"
            title="No cards yet"
            description="Tap Scan to add your first card. Recognition handles the rest."
            action={<ActionButton variant="buy" label="GET STARTED" onClick={() => {}} />}
          />
          <Note>LoadingSkeleton:</Note>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <LoadingSkeleton width="100%" height={20} />
            <LoadingSkeleton width="80%" height={16} />
            <LoadingSkeleton width="60%" height={16} />
          </div>
          <Note>ErrorBanner:</Note>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            <ErrorBanner message="Couldn't refresh price" detail="The pricing service didn't respond." onRetry={() => {}} />
            <ErrorBanner message="Offline — N queued" onDismiss={() => {}} />
          </div>
          <Note>Toast (transient):</Note>
          <Row>
            <ActionButton variant="grade" label="SHOW TOAST" onClick={() => setToastOn(true)} />
          </Row>
          <Toast visible={toastOn} message="Card added to Show Pickups" variant="success" onDismiss={() => setToastOn(false)} />
          <Note>BottomSheet:</Note>
          <Row>
            <ActionButton variant="negotiate" label="OPEN SHEET" onClick={() => setSheetOpen(true)} />
          </Row>
          <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} ariaLabel="Demo bottom sheet">
            <div style={{ padding: 24 }}>
              <H3>Bottom Sheet Demo</H3>
              <p style={{ fontSize: 14, color: "var(--gc-text-secondary)", lineHeight: 1.5 }}>
                Slides up from the bottom. Tap the scrim or press Escape to close.
              </p>
              <ActionButton variant="walk" label="CLOSE" onClick={() => setSheetOpen(false)} />
            </div>
          </BottomSheet>
        </div>
      </Shell>
    </AppShell>
  );
}

// ─── Local presentational helpers (page-only; not exported) ───
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--gc-brand-gold-500)", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 32, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid var(--gc-border-subtle)" }}>{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--gc-text-primary)", marginBottom: 8 }}>{children}</h3>;
}
function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "var(--gc-text-muted)", marginBottom: 8, marginTop: 16 }}>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>{children}</div>;
}
function Grid({ cols, children }: { cols: number; children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>{children}</div>;
}
