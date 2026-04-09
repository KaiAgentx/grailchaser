/**
 * POST /api/sports/collection-items
 * Idempotent, JWT-authenticated endpoint to add a sports card to a user's collection.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  extractUserId, isValidUuid, canonicalHash,
  checkIdempotency, writeIdempotency,
  serviceRoleClient, TCG_GAME_VALUES,
} from "@/lib/collectionItemsApi";
import { calcTier, shouldFlagForGrading } from "@/lib/utils";

const ROUTE = "/api/sports/collection-items";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const userId = await extractUserId(req.headers.get("authorization"));
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // 2. Idempotency key
    const idemKey = req.headers.get("idempotency-key");
    if (!idemKey || !isValidUuid(idemKey)) {
      return NextResponse.json({ error: "missing_idempotency" }, { status: 400 });
    }

    // 3. Body validation
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body", details: "Invalid JSON" }, { status: 400 }); }

    const missing: string[] = [];
    if (!body.player) missing.push("player");
    if (!body.sport) missing.push("sport");
    if (missing.length > 0) return NextResponse.json({ error: "invalid_body", details: `Missing: ${missing.join(", ")}` }, { status: 400 });
    if (body.game && TCG_GAME_VALUES.includes(body.game)) {
      return NextResponse.json({ error: "invalid_body", details: "TCG games must use /api/tcg/collection-items" }, { status: 400 });
    }

    // 4. Request hash
    const reqHash = canonicalHash(body);

    // 5. Idempotency check
    const idem = await checkIdempotency(userId, idemKey, ROUTE, reqHash);
    if (idem.found && !idem.expired) {
      if (idem.match) return NextResponse.json({ ...idem.responseBody, replay: true }, { status: 200 });
      return NextResponse.json({ error: "idempotency_mismatch" }, { status: 409 });
    }

    // 6. Build card_data
    const rawVal = body.raw_value || 0;
    const gemProb = body.gem_probability || Math.random() * 0.6 + 0.1;
    const cardData: Record<string, any> = {
      game: body.game || "sports",
      player: body.player,
      sport: body.sport,
      team: body.team || "",
      year: body.year || new Date().getFullYear(),
      brand: body.brand || "Topps",
      set: body.set || "Base",
      parallel: body.parallel || "Base",
      card_number: body.card_number || "#1",
      is_rc: body.is_rc || false,
      is_auto: body.is_auto || false,
      is_numbered: body.is_numbered || false,
      numbered_to: body.numbered_to || null,
      condition: body.condition || "NM",
      raw_value: rawVal,
      cost_basis: body.cost_basis || 0,
      tier: calcTier(rawVal),
      gem_probability: +gemProb.toFixed(2),
      graded_values: body.graded_values || {
        "10": +(rawVal * (2.5 + Math.random() * 3)).toFixed(2),
        "9": +(rawVal * (1.5 + Math.random())).toFixed(2),
        "8": +(rawVal * (1.1 + Math.random() * 0.3)).toFixed(2),
        "7": +(rawVal * (0.9 + Math.random() * 0.2)).toFixed(2),
      },
      status: "raw",
      watchlist: body.watchlist || false,
      grade_candidate: shouldFlagForGrading(rawVal, gemProb),
      notes: body.notes || "",
      date_added: new Date().toISOString().slice(0, 10),
      purchase_source: body.purchase_source || null,
      purchase_intent: body.purchase_intent || null,
    };
    if (body.scan_image_url) cardData.scan_image_url = body.scan_image_url;
    if (body.metadata) cardData.metadata = body.metadata;

    // 7. RPC call
    const svc = serviceRoleClient();
    const { data, error } = await svc.rpc("insert_collection_item", {
      p_user_id: userId,
      p_storage_box: body.storage_box || "PENDING",
      p_card_data: cardData,
    });

    if (error) {
      console.error("[sports/collection-items] RPC error:", error.message);
      return NextResponse.json({ error: "server_error", details: error.message }, { status: 500 });
    }

    const responseBody = { card: data };
    await writeIdempotency(userId, idemKey, ROUTE, reqHash, 201, responseBody);
    return NextResponse.json(responseBody, { status: 201 });
  } catch (err: any) {
    console.error("[sports/collection-items] unhandled:", err.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
