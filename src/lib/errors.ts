/**
 * Unified API error codes and response builder.
 * Every error response must use errorResponse() so the shape stays consistent.
 * Body shape: { error: <code>, details?: <human readable>, request_id: <uuid> }
 * X-Error-Code header is set for log extraction without re-parsing JSON.
 */
import { NextResponse } from "next/server";

export const ErrorCode = {
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  INVALID_BODY: "invalid_body",
  MISSING_IDEMPOTENCY: "missing_idempotency",
  IDEMPOTENCY_MISMATCH: "idempotency_mismatch",
  RATE_LIMITED: "rate_limited",
  NOT_FOUND: "not_found",
  METHOD_NOT_ALLOWED: "method_not_allowed",
  CONFLICT: "conflict",
  SERVER_ERROR: "server_error",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS_FOR: Record<ErrorCodeValue, number> = {
  unauthorized: 401, forbidden: 403, invalid_body: 400,
  missing_idempotency: 400, idempotency_mismatch: 409,
  rate_limited: 429, not_found: 404, method_not_allowed: 405,
  conflict: 409, server_error: 500,
};

export function errorResponse(opts: {
  code: ErrorCodeValue;
  details?: string;
  requestId: string;
  headers?: Record<string, string>;
}): NextResponse {
  return NextResponse.json(
    { error: opts.code, details: opts.details, request_id: opts.requestId },
    {
      status: STATUS_FOR[opts.code],
      headers: { ...(opts.headers ?? {}), "X-Error-Code": opts.code },
    }
  );
}
