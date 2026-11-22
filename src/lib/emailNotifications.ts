/**
 * Fire-and-forget call into the server-side email functions.
 *
 * The email is best-effort from the browser's perspective: an order that is
 * confirmed must never block, fail or be re-created because an email had
 * trouble. The durable guarantees live server-side (migration 014 claim
 * tokens + Resend Idempotency-Keys), so a retry here is always safe.
 *
 * DIAGNOSTICS (added after the production report "order created, no email, no
 * function invocation"): every attempt now emits one compact console line with
 *
 *   - the endpoint path and an 8-character ORDER TAG (never the full order id,
 *     never the customer's name / email / phone / address / order contents),
 *   - the HTTP status and the response content-type,
 *   - a `reason` when the call did not reach a function (`html-response`
 *     means the SPA fallback answered `/api/*`, i.e. a routing/deployment
 *     problem, not a Resend problem), and
 *   - the elapsed time.
 *
 * Before this, *every* failure mode — request blocked, request answered by
 * `index.html` with a 200, 4xx/5xx, timeout — was swallowed by a bare `catch`
 * with no log at all, so "no email" was indistinguishable from "the endpoint
 * was never called". The triggers are also now:
 *
 *   - absolute same-origin URLs (`new URL(path, location.origin)`), so the
 *     path can never be resolved against a nested route or a `<base>` tag,
 *   - sent with `keepalive: true`, so a full page unload right after checkout
 *     cannot cancel them (client-side routing never could),
 *   - retried once, and only on a genuine transport failure (offline, DNS,
 *     connection reset, or the local abort timer). Retries are safe: the
 *     server claims each notification with a lease token and Resend dedupes
 *     on the deterministic Idempotency-Key. HTTP error responses are NOT
 *     retried — those already carry the server's own retry contract.
 */
const EMAIL_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 1_200;
const ORDER_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export const EMAIL_ENDPOINTS = {
  confirmation: '/api/order-confirmation',
  admin: '/api/admin-new-order',
} as const;

export type EmailEndpoint = (typeof EMAIL_ENDPOINTS)[keyof typeof EMAIL_ENDPOINTS];

/** First 8 hex characters of the order UUID: enough to correlate a browser
 * attempt with the server log line, not enough to be useful anywhere else.
 * Not personal data and not a secret. */
function orderTag(orderId: string): string {
  return orderId.slice(0, 8);
}

function emit(level: 'info' | 'warn', event: string, fields: Record<string, unknown>): void {
  if (typeof console === 'undefined') return;
  const write = level === 'warn' ? console.warn : console.info;
  try {
    write.call(console, `[tws:email] ${event}`, fields);
  } catch {
    // Logging must never break checkout.
  }
}

/** Absolute, same-origin URL. In a browser the storefront can be mounted at
 * any depth; a leading-slash path is still correct today, but building the URL
 * explicitly removes every base-URL ambiguity from the diagnostics. */
function endpointUrl(path: EmailEndpoint): string {
  const origin = typeof window !== 'undefined' ? window.location?.origin : undefined;
  if (!origin) return path;
  try {
    return new URL(path, origin).toString();
  } catch {
    return path;
  }
}

type AttemptOutcome =
  | { ok: true; status: number }
  | { ok: false; status: number; retryable: boolean; reason: string };

function safeContentType(response: Response): string {
  try {
    return (response.headers.get('content-type') ?? '').toLowerCase();
  } catch {
    return '';
  }
}

async function attempt(path: EmailEndpoint, orderId: string): Promise<AttemptOutcome> {
  const controller = new globalThis.AbortController();
  const started = Date.now();
  const timer = globalThis.setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    const response = await fetch(endpointUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
      signal: controller.signal,
      // Survives a document unload (tab closed / hard reload) mid-flight.
      keepalive: true,
    });
    const contentType = safeContentType(response);
    const ms = Date.now() - started;

    // The decisive routing signal: a function always answers JSON. HTML means
    // the SPA fallback (or an upstream proxy) answered the POST instead of the
    // serverless function, so no function ran and no email could be sent.
    if (contentType.includes('text/html')) {
      emit('warn', 'endpoint-not-reachable', {
        endpoint: path,
        orderTag: orderTag(orderId),
        status: response.status,
        contentType,
        ms,
        reason: 'html-response',
        hint: 'the SPA fallback answered /api/* — the serverless function did not run',
      });
      return { ok: false, status: response.status, retryable: false, reason: 'html-response' };
    }

    if (!response.ok) {
      emit('warn', 'request-rejected', {
        endpoint: path,
        orderTag: orderTag(orderId),
        status: response.status,
        contentType,
        ms,
      });
      return { ok: false, status: response.status, retryable: false, reason: 'http-error' };
    }

    emit('info', 'request-accepted', {
      endpoint: path,
      orderTag: orderTag(orderId),
      status: response.status,
      ms,
    });
    return { ok: true, status: response.status };
  } catch (error) {
    const ms = Date.now() - started;
    const aborted = (error as { name?: string } | null)?.name === 'AbortError';
    emit('warn', 'request-failed', {
      endpoint: path,
      orderTag: orderTag(orderId),
      ms,
      reason: aborted ? 'timeout' : 'network',
    });
    return {
      ok: false,
      status: 0,
      retryable: true,
      reason: aborted ? 'timeout' : 'network',
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function postEmailSafely(path: EmailEndpoint, orderId: string): Promise<void> {
  try {
    const first = await attempt(path, orderId);
    if (first.ok || !first.retryable) return;
    // One bounded retry on transport failure only. Safe: server claim tokens +
    // Resend Idempotency-Key make a repeated request a no-op, never a second email.
    await wait(RETRY_DELAY_MS);
    await attempt(path, orderId);
  } catch {
    // Any failure is deliberately silent for the caller: receipts come from the
    // database. Failures are reported through the console diagnostics above.
  }
}

export async function announceOrderConfirmationEmail(orderId: string): Promise<void> {
  if (!ORDER_ID.test(orderId ?? '')) return;
  emit('info', 'trigger', {
    reason: 'receipt-page',
    orderTag: orderTag(orderId),
    endpoints: [EMAIL_ENDPOINTS.confirmation],
  });
  await postEmailSafely(EMAIL_ENDPOINTS.confirmation, orderId);
}

/** Both notification types; called once, from the order-commit path only. */
export async function announceOrderEmails(orderId: string): Promise<void> {
  if (!ORDER_ID.test(orderId ?? '')) return;
  emit('info', 'trigger', {
    reason: 'order-committed',
    orderTag: orderTag(orderId),
    endpoints: [EMAIL_ENDPOINTS.confirmation, EMAIL_ENDPOINTS.admin],
  });
  await Promise.allSettled([
    postEmailSafely(EMAIL_ENDPOINTS.confirmation, orderId),
    postEmailSafely(EMAIL_ENDPOINTS.admin, orderId),
  ]);
}
