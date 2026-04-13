/**
 * Shared helpers for collection-items endpoints (sports + TCG).
 * Handles JWT auth, idempotency, hashing, service-role client.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Re-export from canonical source so existing imports continue to work.
export { TCG_GAME_VALUES } from "@/lib/games";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Clients ───

let _serviceClient: SupabaseClient | null = null;
export function serviceRoleClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return _serviceClient;
}

let _anonClient: SupabaseClient | null = null;
function anonClient(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _anonClient;
}

// ─── Auth ───

export async function extractUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const jwt = authHeader.slice(7);
  const { data, error } = await anonClient().auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user.id;
}

// ─── Idempotency ───

export function isValidUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function canonicalHash(body: Record<string, unknown>): string {
  const sorted = JSON.stringify(body, Object.keys(body).sort());
  return crypto.createHash("sha256").update(sorted).digest("hex");
}

export interface IdempotencyResult {
  found: boolean;
  expired: boolean;
  match: boolean;
  responseStatus?: number;
  responseBody?: any;
}

export async function checkIdempotency(
  userId: string,
  key: string,
  route: string,
  requestHash: string
): Promise<IdempotencyResult> {
  const svc = serviceRoleClient();
  const { data } = await svc
    .from("idempotency_keys")
    .select("request_hash, response_status, response_body, expires_at")
    .eq("user_id", userId)
    .eq("key", key)
    .eq("route", route)
    .maybeSingle();

  if (!data) return { found: false, expired: false, match: false };

  if (new Date(data.expires_at) < new Date()) {
    await svc.from("idempotency_keys").delete()
      .eq("user_id", userId).eq("key", key).eq("route", route);
    return { found: true, expired: true, match: false };
  }

  return {
    found: true,
    expired: false,
    match: data.request_hash === requestHash,
    responseStatus: data.response_status,
    responseBody: data.response_body,
  };
}

export async function writeIdempotency(
  userId: string,
  key: string,
  route: string,
  requestHash: string,
  responseStatus: number,
  responseBody: any
): Promise<void> {
  const svc = serviceRoleClient();
  await svc.from("idempotency_keys").upsert({
    user_id: userId,
    key,
    route,
    request_hash: requestHash,
    response_status: responseStatus,
    response_body: responseBody,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}
