/**
 * POST /api/tcg/collection-items
 * Idempotent, JWT-authenticated endpoint to add a TCG card to a user's collection.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  extractUserId, isValidUuid, canonicalHash,
  checkIdempotency, writeIdempotency,
  serviceRoleClient, TCG_GAME_VALUES,
} from "@/lib/collectionItemsApi";

const ROUTE = "/api/tcg/collection-items";

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
    if (!body.catalogCardId) missing.push("catalogCardId");
    if (!body.game) missing.push("game");
    if (!body.player) missing.push("player");
    if (missing.length > 0) return NextResponse.json({ error: "invalid_body", details: `Missing: ${missing.join(", ")}` }, { status: 400 });
    if (!TCG_GAME_VALUES.includes(body.game)) return NextResponse.json({ error: "invalid_body", details: `game must be one of: ${TCG_GAME_VALUES.join(", ")}` }, { status: 400 });

    // 4. Request hash
    const reqHash = canonicalHash(body);

    // 5. Idempotency check
    const idem = await checkIdempotency(userId, idemKey, ROUTE, reqHash);
    if (idem.found && !idem.expired) {
      if (idem.match) return NextResponse.json({ ...idem.responseBody, replay: true }, { status: 200 });
      return NextResponse.json({ error: "idempotency_mismatch" }, { status: 409 });
    }

    // 6. Build card_data — preserve sports-first NOT NULL defaults
    const cardData: Record<string, any> = {
      game: body.game,
      player: body.player,
      sport: "Pokemon",
      year: new Date().getFullYear(),
      brand: body.brand || "Pokémon TCG",
      set: body.set || body.set_name || "",
      card_number: body.card_number || "",
      team: "",
      parallel: "Base",
      is_rc: false,
      is_auto: false,
      is_numbered: false,
      watchlist: false,
      grade_candidate: false,
      gem_probability: 0.15,
      graded_values: { "10": 0, "9": 0, "8": 0, "7": 0 },
      status: "raw",
      tier: (body.raw_value || 0) >= 100 ? "Gem" : (body.raw_value || 0) >= 25 ? "Star" : (body.raw_value || 0) >= 5 ? "Core" : "Bulk",
      condition: "NM",
      date_added: new Date().toISOString().slice(0, 10),
      notes: `TCG: ${body.game}`,
    };
    // Optional fields
    if (body.rarity != null) cardData.rarity = body.rarity;
    if (body.raw_value != null) cardData.raw_value = body.raw_value;
    if (body.cost_basis != null) cardData.cost_basis = body.cost_basis;
    if (body.scan_image_url) cardData.scan_image_url = body.scan_image_url;
    if (body.set_code) cardData.set_code = body.set_code;
    if (body.set_name) cardData.set_name = body.set_name;
    if (body.finish) cardData.finish = body.finish;
    if (body.language) cardData.language = body.language;
    if (body.metadata) cardData.metadata = body.metadata;
    if (body.catalogCardId) cardData.catalog_card_id = body.catalogCardId;
    if (body.canonical_card_id) cardData.canonical_card_id = body.canonical_card_id;
    if (body.printing_id) cardData.printing_id = body.printing_id;

    // 7. RPC call
    const svc = serviceRoleClient();
    const { data, error } = await svc.rpc("insert_collection_item", {
      p_user_id: userId,
      p_storage_box: body.storage_box || "PENDING",
      p_card_data: cardData,
    });

    // 8. RPC error
    if (error) {
      console.error("[tcg/collection-items] RPC error:", error.message);
      return NextResponse.json({ error: "server_error", details: error.message }, { status: 500 });
    }

    // 9. Success
    const responseBody = { card: data };
    await writeIdempotency(userId, idemKey, ROUTE, reqHash, 201, responseBody);
    return NextResponse.json(responseBody, { status: 201 });
  } catch (err: any) {
    console.error("[tcg/collection-items] unhandled:", err.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
