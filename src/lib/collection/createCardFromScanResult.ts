/**
 * createCardFromScanResult — creates a card row from a recognized scan.
 *
 * Called by the show-mode decision endpoint when decision='purchased'.
 * Resolves the catalog row from scanResult.final_catalog_id (or fallback to
 * catalog_match_id), enriches with player/set/etc., builds a CardDataInput,
 * and invokes the shared buildCardData + insertCollectionItem primitives.
 *
 * Idempotency: the cards table has a partial unique index on
 *   (user_id, scan_result_id) WHERE scan_result_id IS NOT NULL
 * so a race between two POSTs for the same scan_result will produce a
 * Postgres unique violation (23505) on the second insert. This function
 * catches that and queries for the existing card, returning it as if the
 * insert had succeeded — making the operation effectively idempotent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, ScanResult } from "@/lib/types";
import { buildCardData, resolveReleaseYear } from "./buildCardData";
import { insertCollectionItem, defaultStorageBoxName } from "./insertCollectionItem";

export interface CreateCardFromScanResultArgs {
  userId: string;
  scanResult: ScanResult;
  costBasisUsd: number;
  /** If null/undefined, defaults to "{Game} Show Pickups" when scan has show_id, else "{Game} Unsorted". */
  storageBoxName?: string | null;
  supabase: SupabaseClient;
}

export type CreateCardFromScanResultResult =
  | { card: Card }
  | { error: string; errorCode?: string | null; errorDetails?: string | null };

const PG_UNIQUE_VIOLATION = "23505";

/**
 * Look up an existing card by (user_id, scan_result_id). Used as the
 * recovery path when the unique-violation race fires.
 */
async function findExistingByScanResult(
  supabase: SupabaseClient,
  userId: string,
  scanResultId: string,
): Promise<Card | null> {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("user_id", userId)
    .eq("scan_result_id", scanResultId)
    .maybeSingle();
  if (error) {
    console.warn("[createCardFromScanResult] findExisting failed:", error.message);
    return null;
  }
  return (data as Card) ?? null;
}

/**
 * Create a card from a scan_result. See file header for idempotency notes.
 *
 * @example
 *   const r = await createCardFromScanResult({
 *     userId: "uuid",
 *     scanResult: scanResultRow,
 *     costBasisUsd: 25.00,
 *     storageBoxName: null, // → "Pokémon Show Pickups" (show_id present)
 *     supabase: serviceRoleClient(),
 *   });
 *   if ("error" in r) return errorResponse(r);
 *   // r.card.id is the new (or pre-existing) card row
 */
export async function createCardFromScanResult(
  args: CreateCardFromScanResultArgs,
): Promise<CreateCardFromScanResultResult> {
  const { userId, scanResult, costBasisUsd, storageBoxName, supabase } = args;

  // Pick the catalog id: post-correction wins, fall back to the original match.
  const catalogCardId = scanResult.final_catalog_id ?? scanResult.catalog_match_id;
  if (!catalogCardId) {
    return { error: "scan_result has no catalog_match_id or final_catalog_id" };
  }

  // Resolve catalog row → release year + enrichment fields (player/set/etc.)
  const yearResult = await resolveReleaseYear(catalogCardId, supabase);
  if ("error" in yearResult) return { error: yearResult.error };

  // Fetch full catalog row for the enrichment fields the decision endpoint
  // doesn't pass through (player name, set_name, set_code, card_number,
  // rarity, image url). resolveReleaseYear already validated the row exists.
  const [setCode, ...numParts] = catalogCardId.split("-");
  const cardNumber = numParts.join("-");
  const { data: catalogRow, error: catalogErr } = await supabase
    .from("catalog_cards")
    .select("name, set_name, set_code, card_number, rarity, image_large_url, image_small_url")
    .eq("set_code", setCode)
    .eq("card_number", cardNumber)
    .limit(1)
    .maybeSingle();
  if (catalogErr || !catalogRow) {
    return { error: catalogErr?.message ?? "Card not found in catalog" };
  }

  const isShowPurchase = scanResult.show_id != null;
  const boxName = storageBoxName ?? defaultStorageBoxName({ game: scanResult.game, isShowPurchase });

  const cardData = buildCardData({
    catalogCardId,
    game: scanResult.game,
    player: scanResult.final_catalog_name ?? scanResult.catalog_match_name ?? catalogRow.name,
    releaseYear: yearResult.releaseYear,
    set: catalogRow.set_name,
    set_name: catalogRow.set_name,
    set_code: catalogRow.set_code,
    card_number: catalogRow.card_number,
    rarity: catalogRow.rarity,
    cost_basis: costBasisUsd,
    scan_image_url: catalogRow.image_large_url ?? catalogRow.image_small_url ?? null,
    purchase_source: isShowPurchase ? "show" : null,
    purchase_date: new Date().toISOString().slice(0, 10),
    scan_result_id: scanResult.id,
  });

  const insertResult = await insertCollectionItem({
    userId,
    storageBoxName: boxName,
    cardData,
    supabase,
  });

  // On the unique-violation race (two POSTs for the same scan_result),
  // recover by returning the row that won the race.
  if ("error" in insertResult && insertResult.errorCode === PG_UNIQUE_VIOLATION) {
    console.info("[createCardFromScanResult] unique race; returning existing card for scan_result", scanResult.id);
    const existing = await findExistingByScanResult(supabase, userId, scanResult.id);
    if (existing) return { card: existing };
    // Fall through to the original error if we somehow can't find it.
  }

  return insertResult;
}
