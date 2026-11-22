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
