"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { GradedComps, GradedCompsOutcome } from "@/lib/ppt/client";

export type CompsState =
  | { kind: "loading" }
  | { kind: "ok"; comps: GradedComps }
  | { kind: "not_found" }
  | { kind: "timeout" }
  | { kind: "rate_limited"; retryAfterSeconds?: number }
  | { kind: "error"; message?: string };

// 800ms client-side timeout — UI gives up fast at the show floor; the
// server's 5s PPT call still completes and populates the cache for the
// next caller. Failures are graceful: ShowModeResult renders nothing,
// ResultScreen shows a Retry button.
const CLIENT_TIMEOUT_MS = 800;

interface Args {
  name?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
}

export function useGradedComps(args: Args): { state: CompsState; retry: () => void } {
  const [state, setState] = useState<CompsState>({ kind: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken(t => t + 1), []);

  useEffect(() => {
    if (!args.name || !args.setName || !args.cardNumber) {
      setState({ kind: "not_found" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    (async () => {
      try {
        const sb = createClient();
        const { data: session } = await sb.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) {
          if (!cancelled) setState({ kind: "error", message: "not authenticated" });
          return;
        }
        const params = new URLSearchParams({
          name: args.name!,
          setName: args.setName!,
          cardNumber: args.cardNumber!,
        });
        const res = await fetch(`/api/tcg/graded-comps?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 429) setState({ kind: "rate_limited" });
          else setState({ kind: "error", message: `HTTP ${res.status}` });
          return;
        }
        const body = await res.json();
        const outcome: GradedCompsOutcome | undefined = body?.outcome;
        if (cancelled) return;
        if (!outcome) {
          setState({ kind: "error", message: "no outcome" });
          return;
        }
        switch (outcome.status) {
          case "ok": setState({ kind: "ok", comps: outcome.comps }); break;
          case "not_found": setState({ kind: "not_found" }); break;
          case "timeout": setState({ kind: "timeout" }); break;
          case "rate_limited": setState({ kind: "rate_limited", retryAfterSeconds: outcome.retryAfterSeconds }); break;
          case "error": setState({ kind: "error", message: outcome.message }); break;
        }
      } catch (err) {
        if (cancelled) return;
        if ((err as { name?: string })?.name === "AbortError" || controller.signal.aborted) {
          setState({ kind: "timeout" });
        } else {
          setState({ kind: "error", message: err instanceof Error ? err.message : "fetch failed" });
        }
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [args.name, args.setName, args.cardNumber, retryToken]);

  return { state, retry };
}
