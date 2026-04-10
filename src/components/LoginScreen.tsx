"use client";
import { useState } from "react";
import { green, red, font } from "./styles";

const BUTTON_SHADOW = "0 8px 20px rgba(146,107,23,0.18), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10)";
const BUTTON_SHADOW_HOVER = "0 12px 28px rgba(146,107,23,0.28), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.10)";

export function LoginScreen({ signIn, signUp }: { signIn: (e: string, p: string) => Promise<{ error: any }>; signUp: (e: string, p: string) => Promise<{ error: any }> }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: err } = mode === "login" ? await signIn(email, password) : await signUp(email, password);
    if (err) setError(err.message);
    else if (mode === "signup") setError("Check your email to confirm your account");
    setSubmitting(false);
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: font,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "#c4bfb8",
    display: "block",
    marginBottom: 10,
  };

  const inputBaseStyle: React.CSSProperties = {
    width: "100%",
    height: 56,
    boxSizing: "border-box",
    background: "#151a21",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    color: "#f4f1ea",
    fontSize: 16,
    fontFamily: font,
    fontWeight: 500,
    outline: "none",
    transition: "border-color 180ms ease, box-shadow 180ms ease",
  };

  const isSuccess = error.includes("Check your email");

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        background: "#060606",
        color: "#f4f1ea",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6vh 24px 8vh",
      }}
    >
      {/* Atmosphere layer 1 — warm gold core */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 50% 38%, rgba(200,154,43,0.07) 0%, transparent 55%)" }} />
      {/* Atmosphere layer 2 — edge vignette */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.7) 100%)" }} />

      {/* ─── Content column ─── */}
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Wordmark */}
        <h1
          style={{
            margin: 0,
            marginBottom: 10,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 700,
            fontSize: "clamp(38px, 6vw, 56px)",
            letterSpacing: "0.01em",
            lineHeight: 1,
            whiteSpace: "nowrap",
            textAlign: "center",
            background: "linear-gradient(180deg, #e1c46d 0%, #c89a2b 55%, #9a7421 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "#c89a2b",
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
          }}
        >
          GrailChaser
        </h1>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: font,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.38em",
            color: "#8e887f",
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          Card Intelligence for Serious Collectors
        </div>

        {/* ─── Card ─── */}
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 440,
            boxSizing: "border-box",
            background: "rgba(12,15,20,0.92)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: "30px 28px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <form onSubmit={handleAuth}>
            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Email</label>
              <input
                className="premium-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{ ...inputBaseStyle, padding: "0 16px" }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="premium-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  style={{ ...inputBaseStyle, padding: "0 48px 0 16px" }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(s => !s)}
                  onMouseEnter={e => (e.currentTarget.style.color = "#c7b27a")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#938d86")}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#938d86", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "color 180ms ease" }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: isSuccess ? "rgba(20,80,40,0.25)" : "rgba(80,20,20,0.25)",
                  border: `1px solid ${isSuccess ? "rgba(80,180,120,0.35)" : "rgba(180,80,80,0.35)"}`,
                  color: isSuccess ? green : "#e8c4c4",
                  fontSize: 13,
                  padding: "10px 14px",
                  borderRadius: 10,
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}

            {/* Sign in button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                height: 54,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "linear-gradient(180deg, #d8b14c 0%, #c89a2b 55%, #a67b1f 100%)",
                color: "#111111",
                fontFamily: font,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                boxShadow: BUTTON_SHADOW,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.6 : 1,
                transition: "transform 180ms ease, box-shadow 180ms ease, filter 180ms ease",
              }}
              onMouseEnter={e => {
                if (submitting) return;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.filter = "brightness(1.06)";
                e.currentTarget.style.boxShadow = BUTTON_SHADOW_HOVER;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.filter = "brightness(1)";
                e.currentTarget.style.boxShadow = BUTTON_SHADOW;
              }}
              onMouseDown={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              onFocus={e => { e.currentTarget.style.outline = "2px solid rgba(212,175,82,0.6)"; e.currentTarget.style.outlineOffset = "2px"; }}
              onBlur={e => { e.currentTarget.style.outline = "none"; }}
            >
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>

        {/* Footer toggle */}
        <div style={{ marginTop: 22, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.2)")}
            onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
            style={{ background: "none", border: "none", fontFamily: font, fontSize: 13, color: "#8e887f", cursor: "pointer", transition: "filter 180ms ease", padding: 8 }}
          >
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span style={{ color: "#d1aa48", fontWeight: 600 }}>{mode === "login" ? "Sign up" : "Sign in"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
