import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST() {
  const candidates = [
    "claude-sonnet-4-6",
    "claude-sonnet-4-6-20260218",
    "claude-sonnet-4-5",
    "claude-sonnet-4-5-20250929",
  ];
  const results: any[] = [];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  for (const model of candidates) {
    const t0 = Date.now();
    try {
      const r = await client.messages.create({
        model,
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      });
      results.push({
        model,
        ok: true,
        ms: Date.now() - t0,
        response: r.content?.[0],
        actualModel: r.model,
      });
    } catch (e: any) {
      results.push({
        model,
        ok: false,
        ms: Date.now() - t0,
        error: e.status + " " + (e.error?.type || e.message),
        details: e.error?.error?.message?.slice(0, 200),
      });
    }
  }
  return NextResponse.json({ results });
}
