"use client";
import { useState } from "react";
import { bg, surface, border, borderMed, text, green, red, accent, accentLight, muted, secondary, font } from "./styles";

export function LoginScreen({ signIn, signUp }: { signIn: (e: string, p: string) => Promise<{ error: any }>; signUp: (e: string, p: string) => Promise<{ error: any }> }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", maxWidth: 500, margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>
          <span style={{ color: accent, opacity: 0.7 }}>♦ </span>
          <span style={{ background: "linear-gradient(135deg, " + accent + ", " + accentLight + ")", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>GRAILCHASER</span>
        </div>
        <div style={{ fontSize: 11, color: muted, marginTop: 10, textTransform: "uppercase", letterSpacing: 4, fontWeight: 600 }}>Sports Card Optimizer</div>
      </div>
      <div style={{ background: surface, border: "1px solid " + border, borderRadius: 16, padding: "32px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
        <form onSubmit={handleAuth}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8, fontWeight: 600 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "none", borderBottom: "2px solid " + borderMed, borderRadius: 0, padding: "14px 0", color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderBottomColor = accent} onBlur={e => e.target.style.borderBottomColor = borderMed} />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8, fontWeight: 600 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "none", borderBottom: "2px solid " + borderMed, borderRadius: 0, padding: "14px 0", color: text, fontFamily: font, fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderBottomColor = accent} onBlur={e => e.target.style.borderBottomColor = borderMed} />
          </div>
          {error && <div style={{ fontSize: 13, color: error.includes("Check your email") ? green : red, textAlign: "center", marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={submitting} style={{ width: "100%", padding: "14px", height: 48, background: "linear-gradient(135deg, " + accent + ", " + accentLight + ")", border: "none", borderRadius: 12, color: bg, fontFamily: font, fontSize: 15, fontWeight: 700, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.6 : 1 }}>{submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}</button>
        </form>
      </div>
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} style={{ background: "none", border: "none", color: secondary, fontFamily: font, fontSize: 13, cursor: "pointer" }}>{mode === "login" ? "Don't have an account? " : "Already have an account? "}<span style={{ color: accent }}>{mode === "login" ? "Sign up" : "Sign in"}</span></button>
      </div>
    </div>
  );
}
