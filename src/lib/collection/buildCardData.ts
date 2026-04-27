/**
 * Pure builder for the `cards`-row jsonb passed to insert_collection_item RPC.
 *
 * No DB access. Both /api/tcg/collection-items and createCardFromScanResult
 * call this with their own normalized input. Behavior must match the
 * pre-refactor inline logic in /collection-items/route.ts byte-for-byte.
 */
import { calcTier } from "@/lib/utils";
import type { Game } from "@/lib/types";

const GAME_TO_SPORT: Record<Game, string> = {
  pokemon: "Pokemon",
  mtg: "Magic",
  one_piece: "One Piece",
};

export interface CardDataInput {
  catalogCardId: string;
  game: Game;
  player: string;
  releaseYear: number;
  brand?: string | null;
  set?: string | null;
  set_name?: string | null;
  set_code?: string | null;
  card_number?: string | null;
  rarity?: string | null;
  raw_value?: number | null;
  cost_basis?: number | null;
  scan_image_url?: string | null;
  finish?: string | null;
  language?: string | null;
  metadata?: unknown;
  canonical_card_id?: string | null;
  printing_id?: string | null;
  tcg_condition?: string | null;
  purchase_source?: string | null;
  purchase_date?: string | null;
  scan_result_id?: string | null;
}

/**
 * Build the jsonb passed as p_card_data to insert_collection_item.
 * Adds optional fields only when present so the underlying jsonb_populate_record
 * doesn't overwrite column defaults with NULL.
 */
export function buildCardData(input: CardDataInput): Record<string, unknown> {
  const sportValue = GAME_TO_SPORT[input.game];

  const cardData: Record<string, unknown> = {
    game: input.game,
    player: input.player,
    sport: sportValue,
    year: input.releaseYear,
    brand: input.brand || "Pokémon TCG",
    set: input.set || input.set_name || "",
    card_number: input.card_number || "",
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
    tier: calcTier(input.raw_value ?? null),
    condition: "NM",
    date_added: new Date().toISOString().slice(0, 10),
    storage_row: 1,
    notes: "",
    catalog_card_id: input.catalogCardId,
  };

  if (input.rarity != null) cardData.rarity = input.rarity;
  if (input.raw_value != null) cardData.raw_value = input.raw_value;
  if (input.cost_basis != null) cardData.cost_basis = input.cost_basis;
  if (input.scan_image_url) cardData.scan_image_url = input.scan_image_url;
  if (input.set_code) cardData.set_code = input.set_code;
  if (input.set_name) cardData.set_name = input.set_name;
  if (input.finish) cardData.finish = input.finish;
  if (input.language) cardData.language = input.language;
  if (input.metadata) cardData.metadata = input.metadata;
  if (input.canonical_card_id) cardData.canonical_card_id = input.canonical_card_id;
  if (input.printing_id) cardData.printing_id = input.printing_id;
  if (input.tcg_condition != null) cardData.tcg_condition = input.tcg_condition;
  if (input.purchase_source != null) cardData.purchase_source = input.purchase_source;
  if (input.purchase_date != null) cardData.purchase_date = input.purchase_date;
  if (input.scan_result_id != null) cardData.scan_result_id = input.scan_result_id;

  return cardData;
}

/**
 * Resolve release year from a catalog_card_id (e.g. "sv8-219").
 * Async because it queries catalog_cards. Returns the row's release year
 * derived from release_date, or the current year as fallback.
 *
 * Also serves as a validation step: a missing catalog row means the catalog
 * id is invalid. Returns { error: "Card not found in catalog" } in that case.
 */
export async function resolveReleaseYear(
  catalogCardId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ releaseYear: number } | { error: string }> {
  const [setCode, ...numParts] = catalogCardId.split("-");
  const cardNumber = numParts.join("-");
  if (!setCode || !cardNumber) return { error: "Invalid catalog_card_id format" };

  const { data: catalogRow } = await supabase
    .from("catalog_cards")
    .select("id, release_date")
    .eq("set_code", setCode)
    .eq("card_number", cardNumber)
    .limit(1)
    .maybeSingle();

  if (!catalogRow) {
    console.warn(`[buildCardData] catalog_card_id not found: ${catalogCardId}`);
    return { error: "Card not found in catalog" };
  }

  let releaseYear = new Date().getFullYear();
  if (catalogRow.release_date) {
    const parsedYear = new Date(catalogRow.release_date).getFullYear();
    if (Number.isFinite(parsedYear) && parsedYear > 1900) {
      releaseYear = parsedYear;
    } else {
      console.warn(`[buildCardData] Invalid release_date on catalog row ${catalogCardId}: ${catalogRow.release_date}`);
    }
  } else {
    console.warn(`[buildCardData] No release_date on catalog row ${catalogCardId}`);
  }
  return { releaseYear };
}
