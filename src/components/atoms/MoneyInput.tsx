"use client";
import { useState, useEffect } from "react";

/**
 * MoneyInput — USD-formatted numeric input.
 *
 *   - $ prefix rendered as a span outside the input
 *   - Formats thousands separators as user types ("1250" → "1,250")
 *   - Up to 2 decimal places, clamped to [0, 999,999.99]
 *   - Rejects non-numeric characters
 *   - 56px tall (1.27 × touch target)
 *   - number.lg typography
 *   - onChange returns the numeric value (0 when empty)
 *
 * Designed for ShowModeResult's Dealer Ask input and NegotiateModal.
 */

const MAX_VALUE = 999_999.99;

interface Props {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

function formatDisplay(s: string): string {
  // s is the user's raw text, possibly with a trailing "." or partial decimal.
  // Format the integer portion with thousands; preserve any decimal tail as-is.
  if (!s) return "";
  const [intPart, decPart] = s.split(".");
  const intClean = intPart.replace(/[^0-9]/g, "");
  const intFormatted = intClean ? Number(intClean).toLocaleString("en-US") : "";
  if (decPart === undefined) return intFormatted;
  return `${intFormatted}.${decPart}`;
}

function sanitize(raw: string): string {
  // Allow digits and a single period; cap decimals at 2 places.
  let cleaned = raw.replace(/[^0-9.]/g, "");
  // Keep only the first period.
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  // Cap decimals to 2 places.
  const dot = cleaned.indexOf(".");
  if (dot !== -1 && cleaned.length - dot > 3) {
    cleaned = cleaned.slice(0, dot + 3);
  }
  return cleaned;
}

export function MoneyInput({ value, onChange, placeholder = "0.00", disabled, autoFocus }: Props) {
  // Internal text state holds the user-visible string (with formatting).
  // `value` prop drives the initial state and external resets.
  const [text, setText] = useState(() => (value > 0 ? formatDisplay(String(value)) : ""));

  useEffect(() => {
    // Sync when parent passes a different value (e.g. reset to 0)
    const numeric = Number(text.replace(/,/g, "")) || 0;
    if (Math.abs(numeric - value) > 0.001) {
      setText(value > 0 ? formatDisplay(String(value)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (raw: string) => {
    const noCommas = raw.replace(/,/g, "");
    const cleaned = sanitize(noCommas);
    const numeric = Number(cleaned) || 0;
    if (numeric > MAX_VALUE) return;
    setText(formatDisplay(cleaned));
    onChange(numeric);
  };

  return (
    <div
      className="font-gc-ui"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        background: "var(--gc-bg-surface-2)",
        border: "1px solid var(--gc-border-subtle)",
        borderRadius: "var(--gc-radius-md)",
        height: 56,
        padding: "0 16px 0 36px",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 22,
          fontWeight: 700,
          color: "var(--gc-text-muted)",
          pointerEvents: "none",
        }}
      >
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        disabled={disabled}
        value={text}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        className="font-gc-mono"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          color: "var(--gc-text-primary)",
          fontSize: 24,
          fontWeight: 700,
          outline: "none",
          width: "100%",
        }}
      />
    </div>
  );
}
