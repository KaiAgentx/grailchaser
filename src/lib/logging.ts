/**
 * Minimal request logger. One line per request, JSON. No external deps.
 * Uses globalThis.crypto so it works in both Node and Edge runtimes.
 */

export function generateRequestId(): string {
  return globalThis.crypto.randomUUID();
}

export function getOrCreateRequestId(headers: Headers): string {
  const incoming = headers.get("x-request-id");
  if (incoming && /^[a-zA-Z0-9-]{8,64}$/.test(incoming)) return incoming;
  return generateRequestId();
}

export interface RequestLogFields {
  requestId: string;
  route: string;
  method: string;
  userId?: string | null;
  ecosystem?: string | null;
  status: number;
  latencyMs: number;
  errorCode?: string | null;
}

export function logRequest(fields: RequestLogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: fields.status >= 500 ? "error" : fields.status >= 400 ? "warn" : "info",
    request_id: fields.requestId,
    route: fields.route,
    method: fields.method,
    user_id: fields.userId ?? null,
    ecosystem: fields.ecosystem ?? null,
    status: fields.status,
    latency_ms: fields.latencyMs,
    error_code: fields.errorCode ?? null,
  });
  if (fields.status >= 500) console.error(line);
  else console.log(line);
}
