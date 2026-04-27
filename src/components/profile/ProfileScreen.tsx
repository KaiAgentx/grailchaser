"use client";
import { Shell } from "../shell/Shell";
import { createClient } from "@/lib/supabase";

/**
 * Profile tab stub.
 *
 * Per locked decisions, Profile contains: Past Shows, Sales History, Imports,
 * Settings, Account. For B-ui-1 we render a minimal stub that preserves the
 * three flows orphaned by removing the legacy "More" overlay:
 *   - Sign Out (working)
 *   - Import CSV → batchImport screen (working)
 *   - Account email display (working — pulled from auth)
 * Plus 3 "Coming soon" tiles for Past Shows / Sales History / Settings.
 */

interface Props {
  email: string | null;
  onNavigate: (screen: string) => void;
}

export function ProfileScreen({ email, onNavigate }: Props) {
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const sectionStyle = {
    background: "var(--gc-bg-surface-1)",
    border: "1px solid var(--gc-border-subtle)",
    borderRadius: "var(--gc-radius-lg)",
    padding: 16,
    marginBottom: 12,
  };

  return (
    <Shell title="Profile">
      <div style={{ paddingTop: 16 }}>
        {/* Account section */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
            Account
          </div>
          {email && (
            <div style={{ fontSize: 14, color: "var(--gc-text-primary)", marginBottom: 12, wordBreak: "break-all" }}>
              {email}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="font-gc-ui"
            style={{
              width: "100%",
              padding: 12,
              minHeight: 44,
              background: "transparent",
              border: "1px solid var(--gc-semantic-danger)",
              borderRadius: "var(--gc-radius-md)",
              color: "var(--gc-semantic-danger)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Working tiles */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
            Imports
          </div>
          <button
            onClick={() => onNavigate("batchImport")}
            className="font-gc-ui"
            style={{
              width: "100%",
              padding: "14px 16px",
              minHeight: 44,
              background: "var(--gc-bg-surface-2)",
              border: "1px solid var(--gc-border-subtle)",
              borderRadius: "var(--gc-radius-md)",
              color: "var(--gc-text-primary)",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 600,
            }}
          >
            ⬆ Import Batch
          </button>
        </div>

        {/* Coming soon */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 11, color: "var(--gc-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 12 }}>
            Coming soon
          </div>
          {["Past Shows", "Sales History", "Settings"].map((label) => (
            <div
              key={label}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid var(--gc-border-subtle)",
                color: "var(--gc-text-muted)",
                fontSize: 14,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
