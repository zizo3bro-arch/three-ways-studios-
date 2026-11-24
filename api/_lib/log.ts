/**
 * Structured, PII-free logging for the email-notification endpoints.
 *
 * The production report was "the order exists, no email was sent, and Vercel
 * shows no invocation". Nothing in the handlers logged anything, so an
 * uninvoked route, an early refusal and a silent skip were indistinguishable
 * from each other. Every request now emits exactly two single-line JSON events
 * to stdout (which Vercel captures in the runtime log):
 *
 *   {"scope":"tws-email-api","event":"request-start","endpoint":…,"method":…}
 *   {"scope":"tws-email-api","event":"request-complete","endpoint":…,
 *    "status":200,"outcome":"ok","ms":412,"orderTag":"3f8a1c02"}
 *
 * What is logged: the endpoint, the HTTP method, the response status, the
 * error reason code the handler chose, the duration, and an 8-character order
 * TAG (the first 8 characters of the order UUID, used only to correlate a
 * browser attempt with this line).
 *
 * What is additionally logged (added 2026-11-22, when a failing Supabase RPC
 * was surfacing as a bare `503 rate-limit-unavailable`):
 *   - `config` / `config-invalid`: which host the Supabase client talks to,
 *     whether the URL came from the dedicated `TWS_SUPABASE_URL` pair, the
 *     legacy `SUPABASE_URL` or the public `VITE_` fallback, which variable
 *     supplied the key,
 *     and the credential SHAPE (jwt / sb_secret / sb_publishable, the JWT
 *     `role` claim, whether the JWT `ref` matches the URL host). Shapes and a
 *     public host, never a key, never a prefix, never a signature.
 *   - `rpc-error` / `probe-error`: the function name, the PostgREST error code,
 *     the HTTP status and a sanitized message/hint (key-shaped substrings are
 *     redacted by `sanitizeDiagnostic`).
 *
 * What is NEVER logged: customer name, email, phone, address, order notes,
 * order reference, order contents, the full order id, request bodies,
 * environment values, the Resend key, or the Supabase service-role key.
 */
import type { ApiResponse } from './types.js';

export interface ResponseSnapshot {
  statusCode: number | null;
  /** The handler's machine-readable `error` code, e.g. `order-not-found`. */
  errorCode: string | null;
}

type LogFields = Record<string, string | number | boolean | null | undefined>;

/** Emits one JSON line. Never throws: logging must not change a response. */
export function logEvent(event: string, fields: LogFields = {}): void {
  try {
    const line: Record<string, unknown> = { scope: 'tws-email-api', event };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) line[key] = value;
    }
    console.log(JSON.stringify(line));
  } catch {
    // ignore
  }
}

/** Correlation tag for an order id: 8 hex characters, not the identifier. */
export function orderTag(orderId: string | null | undefined): string | null {
  return typeof orderId === 'string' && orderId.length >= 8 ? orderId.slice(0, 8) : null;
}

/**
 * Observes the status code and the handler's error code without touching the
 * response pipeline. The handlers keep writing through `sendJson`/`jsonError`;
 * this only reads what they wrote, so no control flow changes.
 */
export function observeResponse(res: ApiResponse): () => ResponseSnapshot {
  let statusCode = typeof res.statusCode === 'number' ? res.statusCode : null;
  let errorCode: string | null = null;

  const writeHead = res.writeHead.bind(res);
  const end = res.end.bind(res);

  res.writeHead = (code: number, headers?: Record<string, string>) => {
    statusCode = code;
    writeHead(code, headers);
  };
  res.end = (body?: string) => {
    if (typeof body === 'string' && body) {
      try {
        const parsed: unknown = JSON.parse(body);
        if (parsed && typeof parsed === 'object' && typeof (parsed as { error?: unknown }).error === 'string') {
          errorCode = (parsed as { error: string }).error;
        }
      } catch {
        // Not JSON (should not happen); the status code is still logged.
      }
    }
    end(body);
  };

  return () => ({ statusCode, errorCode });
}

/* ————————————————————————————————————————————————————————————————————————————
 * Credential / error diagnostics (added 2026-11-22)
 *
 * Production reported `503 rate-limit-unavailable` on both endpoints, and the
 * database proved the RPC never executed (0 rows in rate_limit_buckets, no
 * PostgREST statement mentioning any email function in pg_stat_statements).
 * The failure is therefore *between* the function and PostgREST — a rejected
 * route, a rejected credential, or an unresolvable function — and the previous
 * code discarded the only evidence: `rpc()` threw `error` away and returned
 * `null`, which the handler turned into a bare 503.
 *
 * These helpers describe credentials and errors WITHOUT logging secrets.
 * ———————————————————————————————————————————————————————————————————————————— */

const JWT_LIKE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const SUPABASE_KEY_LIKE = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g;

/** Removes anything key-shaped from a diagnostic string and caps its length.
 * PostgREST error messages contain no customer data, but they may echo a
 * header value in a misconfiguration, so they are redacted before logging. */
export function sanitizeDiagnostic(value: unknown, maxLength = 300): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(JWT_LIKE, '[redacted-jwt]')
    .replace(SUPABASE_KEY_LIKE, '[redacted-key]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export interface KeyDescription {
  /** Shape of the credential — never the credential itself. */
  format: 'jwt' | 'sb_secret' | 'sb_publishable' | 'empty' | 'unknown';
  /** `role` claim of a legacy JWT (e.g. service_role / anon). */
  role: string | null;
  /** `ref` claim of a legacy JWT: which Supabase project the key belongs to. */
  projectRef: string | null;
}

function decodeJwtPayload(key: string): Record<string, unknown> | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Describes an API key without revealing it. A legacy Supabase key is a JWT:
 * its `role` claim must be `service_role` for these endpoints, and its `ref`
 * claim must match the project in `SUPABASE_URL`. Logging those two facts is
 * what turns "503 forever" into "the key belongs to another project" or
 * "the key is the anon key" in a single log line.
 */
export function describeKey(key: string | null | undefined): KeyDescription {
  const value = typeof key === 'string' ? key.trim() : '';
  if (!value) return { format: 'empty', role: null, projectRef: null };
  if (value.startsWith('sb_secret_')) return { format: 'sb_secret', role: null, projectRef: null };
  if (value.startsWith('sb_publishable_')) return { format: 'sb_publishable', role: null, projectRef: null };
  if (value.startsWith('eyJ') && value.split('.').length === 3) {
    const payload = decodeJwtPayload(value);
    const role = typeof payload?.role === 'string' ? sanitizeDiagnostic(payload.role, 40) : null;
    const ref = typeof payload?.ref === 'string' ? sanitizeDiagnostic(payload.ref, 40) : null;
    return { format: 'jwt', role: role || null, projectRef: ref || null };
  }
  return { format: 'unknown', role: null, projectRef: null };
}

/** Host of a Supabase URL, for diagnostics. The host is public information
 * (it is in the frontend bundle and in every legacy JWT's `ref` claim). */
export function hostOf(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || !url) return null;
  try {
    return new URL(url).host.slice(0, 120);
  } catch {
    return null;
  }
}
