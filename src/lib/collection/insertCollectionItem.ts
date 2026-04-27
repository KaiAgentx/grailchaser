/**
 * Inserts a card row via the insert_collection_item RPC, auto-creating the
 * named storage box if it doesn't exist for this user.
 *
 * Both /api/tcg/collection-items and createCardFromScanResult call this.
 * Box auto-create is idempotent (ON CONFLICT DO NOTHING relies on the
 * unique(user_id, name) constraint from migration 20260421120000).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, Card } from "@/lib/types";

export interface InsertCollectionItemArgs {
  userId: string;
  storageBoxName: string;
  cardData: Record<string, unknown>;
  supabase: SupabaseClient;
}

export interface InsertCollectionItemSuccess {
  card: Card;
}
export interface InsertCollectionItemFailure {
  error: string;
  errorCode?: string | null;
  errorDetails?: string | null;
}

export type InsertCollectionItemResult = InsertCollectionItemSuccess | InsertCollectionItemFailure;

/**
 * Ensure a box row exists for (userId, name). No-op when one already exists.
 * Defaults: 1 row, 50 dividers, "singles" type, mode "tcg" — matches
 * ResultScreen.ensureShowPickupsBox.
 */
async function ensureBox(supabase: SupabaseClient, userId: string, name: string): Promise<void> {
  const { error } = await supabase.from("boxes").upsert(
    {
      user_id: userId,
      name,
      num_rows: 1,
      divider_size: 50,
      box_type: "singles",
      mode: "tcg",
    },
    { onConflict: "user_id,name", ignoreDuplicates: true },
  );
  if (error) {
    // Non-fatal: the card insert will succeed even without a row in boxes
    // (cards.storage_box is just a text reference). Log and proceed.
    console.warn("[insertCollectionItem] ensureBox failed:", error.message);
  }
}

/**
 * Default storage box name for a card based on game + show context.
 *
 * @example
 *   defaultStorageBoxName({ game: 'pokemon', isShowPurchase: true })
 *     → "Pokémon Show Pickups"
 *   defaultStorageBoxName({ game: 'mtg', isShowPurchase: false })
 *     → "MTG Unsorted"
 */
export function defaultStorageBoxName(opts: { game: Game; isShowPurchase: boolean }): string {
  const gamePrefix: Record<Game, string> = {
    pokemon: "Pokémon",
    mtg: "MTG",
    one_piece: "One Piece",
  };
  const suffix = opts.isShowPurchase ? "Show Pickups" : "Unsorted";
  return `${gamePrefix[opts.game]} ${suffix}`;
}

/**
 * Insert a card via the insert_collection_item RPC. Auto-creates the
 * named box, then calls the RPC, then returns the new card row.
 *
 * @example
 *   const result = await insertCollectionItem({
 *     userId: "...",
 *     storageBoxName: "Pokémon Show Pickups",
 *     cardData: buildCardData({...}),
 *     supabase,
 *   });
 *   if ("error" in result) console.error(result.error);
 *   else console.log("inserted", result.card.id);
 */
export async function insertCollectionItem(
  args: InsertCollectionItemArgs,
): Promise<InsertCollectionItemResult> {
  const { userId, storageBoxName, cardData, supabase } = args;

  await ensureBox(supabase, userId, storageBoxName);

  const { data: rpcData, error: rpcError } = await supabase.rpc("insert_collection_item", {
    p_user_id: userId,
    p_storage_box: storageBoxName,
    p_card_data: cardData,
  });

  if (rpcError) {
    console.error(
      "[insertCollectionItem] RPC FAILED:",
      JSON.stringify({
        userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catalogCardId: (cardData as any)?.catalog_card_id ?? null,
        rpc_error_message: (rpcError as { message?: string }).message ?? null,
        rpc_error_code: (rpcError as { code?: string }).code ?? null,
        rpc_error_details: (rpcError as { details?: string }).details ?? null,
        rpc_error_hint: (rpcError as { hint?: string }).hint ?? null,
      }),
    );
    return {
      error: "Could not save card to collection. Please try again.",
      errorCode: (rpcError as { code?: string }).code ?? null,
      errorDetails: (rpcError as { details?: string }).details ?? null,
    };
  }

  return { card: rpcData as Card };
}
