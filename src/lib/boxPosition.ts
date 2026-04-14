/**
 * Server-authoritative box position lookup.
 * Queries the DB directly for MAX(storage_position) + 1.
 *
 * TODO: This reduces but doesn't eliminate race conditions — two rapid moves
 * can both read the same MAX. For full safety, migrate to a server-side RPC
 * with an advisory lock (like insert_collection_item).
 */
import { createClient } from "@/lib/supabase";

export async function getFreshNextPosition(boxName: string): Promise<number> {
  if (boxName === "PENDING") return 1;
  const supabase = createClient();
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !sessionData?.session?.user?.id) {
    throw new Error("Auth session expired. Please sign in again.");
  }
  const userId = sessionData.session.user.id;
  const { data, error } = await supabase
    .from("cards")
    .select("storage_position")
    .eq("user_id", userId)
    .eq("storage_box", boxName);
  if (error) {
    throw new Error(`Position lookup failed: ${error.message}`);
  }
  if (!data || data.length === 0) return 1;
  return Math.max(...data.map((c: any) => c.storage_position || 0)) + 1;
}
