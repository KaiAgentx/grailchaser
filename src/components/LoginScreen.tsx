"use client";
import { useState } from "react";
import { bg, surface2, border, text, green, red, cyan, muted, font } from "./styles";

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
    <div style={{ background: bg, color: text, fontFamily: font, minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ background: "linear-gradient(160deg, #b8860b, #f0c040 40%, #daa520 60%, #b8860b)", borderRadius: 16, padding: "28px 20px 22px", position: "relative", overflow: "hidden", boxShadow: "0 4px 24px rgba(184,134,11,0.25), inset 0 1px 0 rgba(255,255,255,0.15)" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)" }} />
          <div style={{ position: "relative", fontSize: 38, fontWeight: 900, color: "#0a0a0f", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 1px 0 rgba(255,255,255,0.3)" }}>GRAILCHASER</div>
          <div style={{ position: "relative", fontSize: 10, color: "#0a0a0f", marginTop: 6, textTransform: "uppercase", letterSpacing: 5, fontWeight: 600, opacity: 0.7 }}>Sports Card Optimizer</div>
          <div style={{ position: "relative", width: 80, height: 1, background: "linear-gradient(90deg, transparent, rgba(10,10,15,0.3), transparent)", margin: "8px auto 0" }} />
        </div>
      </div>
      <form onSubmit={handleAuth}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#f0c040", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 12, padding: "14px 16px", minHeight: 48, color: text, fontFamily: font, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "#f0c040", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" style={{ width: "100%", background: surface2, border: "1px solid " + border, borderRadius: 12, padding: "14px 16px", minHeight: 48, color: text, fontFamily: font, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        </div>
        {error && <div style={{ fontSize: 13, color: error.includes("Check your email") ? green : red, textAlign: "center", marginBottom: 16 }}>{error}</div>}
        <button type="submit" disabled={submitting} style={{ width: "100%", padding: "16px", minHeight: 52, background: green, border: "none", borderRadius: 12, color: "#ffffff", fontFamily: font, fontSize: 17, fontWeight: 700, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.6 : 1 }}>{submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}</button>
      </form>
      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} style={{ background: "none", border: "none", color: cyan, fontFamily: font, fontSize: 14, cursor: "pointer" }}>{mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</button>
      </div>
    </div>
  );
}
