import { Resend } from 'resend';
import type { ResendFailureReason, SendArgs, SendOutcome } from './types';

export interface ResendSendResult {
  data: { id: string } | null;
  error: { name?: string; statusCode?: number | null; message?: string } | null;
}

export interface ResendTransport {
  send(payload: SendArgs, options: { idempotencyKey: string }): Promise<ResendSendResult>;
}

/**
 * Sends one email through Resend with the officially supported Idempotency-Key
 * option (`resend.emails.send(payload, { idempotencyKey })`).
 *
 * The key is stable for the whole lifecycle of a notification row: it is derived
 * from `<notification-type>/<order_id>` and stored in the notification row.
 * Never generated to bypass a conflict — a fresh key would let a different
 * payload silently ship under a reused key, so the stable key is always
 * preserved and the failure is surfaced instead.
 *
 * Resend retains idempotency keys for 24 hours, which covers every real
 * retry of a single order notification. The key-lifetime contract is
 * documented on the SDK's idempotency contract; treat the 24-hour window
 * as an external-service claim, not an independently verified fact.
 */
export function createResendTransport(resendApiKey: string): ResendTransport {
  const resend = new Resend(resendApiKey);
  return {
    async send(payload, options) {
      const { data, error } = await resend.emails.send(
        {
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
        },
        { idempotencyKey: options.idempotencyKey }
      );
      return {
        data: data?.id ? { id: data.id } : null,
        error: error
          ? { name: error.name, statusCode: error.statusCode, message: error.message }
          : null,
      };
    },
  };
}

/**
 * Error codes the installed SDK (resend@6.39.0, dist/index.d.mts) documents
 * for idempotency-related failures. The SDK does not add a payload-diff signal
 * of its own — these error names are the documented contract and the only
 * evidence available, so the classification below relies on them and must not
 * be extended with guessed semantics.
 */
const RESEND_ERROR_NAMES = {
  concurrent: 'concurrent_idempotent_requests',
  payloadConflict: 'invalid_idempotent_request',
  invalidKey: 'invalid_idempotency_key',
  rateLimited: 'rate_limit_exceeded',
} as const;

/**
 * Classify a Resend response into sent / terminal / transient outcomes.
 *
 * Transient (never a permanent lock):
 *   - network failures / no status code / unrecognized response shape
 *   - 429 rate limiting (retry-safe; the stable idempotency key dedups any retry)
 *   - 5xx server errors (retry-safe)
 *   - 409 `concurrent_idempotent_requests` — the same key is in flight on a
 *     concurrent request with an identical payload. Safe to retry later; a
 *     fresh key is never generated.
 *   - an unrecognized 409 that we could not identify — conservative by design:
 *     treated as concurrent-ish and retryable, since the failure is best-effort
 *     and retrying the SAME key + payload under a later claim is safe.
 *
 * Terminal (do not retry this notification type for this order):
 *   - 409 `invalid_idempotent_request` — same key but a different payload.
 *     This means the email content changed under the stable key: a real data
 *     anomaly that retrying cannot resolve.
 *   - 409 / any other 4xx with any other documented error name — validation,
 *     auth, quota, misconfiguration, etc. Permanent by definition.
 *
 * The stable key is never regenerated. The row stays claim-able on transient
 * errors (bounded by the lease) and stays 'failed' on terminal errors — that
 * is the operator signal that the payload itself drifted, not a Resend doing
 * too well.
 */
export function classifyResendOutcome(result: ResendSendResult): SendOutcome {
  if (result.error === null && result.data?.id) {
    return { kind: 'sent', resendId: result.data.id };
  }
  if (result.error === null) {
    // No error payload but no id: treat as transient (unknown outcome).
    const reason: ResendFailureReason = 'unknown-outcome';
    return { kind: 'transient', error: 'resend-returned-no-id', reason };
  }
  const { name, statusCode } = result.error;
  const message = result.error.message?.trim() || 'unknown resend error';

  if (statusCode === null || statusCode === undefined) {
    return { kind: 'transient', error: message, reason: 'network' };
  }

  if (name === RESEND_ERROR_NAMES.concurrent) {
    // Same key, same payload, in flight — safe to retry.
    return { kind: 'transient', error: message, reason: 'concurrent-conflict' };
  }
  if (name === RESEND_ERROR_NAMES.payloadConflict) {
    // Same key, different payload — a data anomaly retrying cannot fix.
    return { kind: 'terminal', error: message, reason: 'payload-conflict' };
  }
  if (name === RESEND_ERROR_NAMES.invalidKey) {
    // Malformed key — retrying the same key would always fail.
    return { kind: 'terminal', error: message, reason: 'validation' };
  }
  if (name === RESEND_ERROR_NAMES.rateLimited) {
    return { kind: 'transient', error: message, reason: 'rate-limited' };
  }
  if (statusCode === 409) {
    // An unrecognized 409: we cannot prove payload identity, so treat it as
    // concurrent-ish (bounded retry) rather than locking the notification.
    return { kind: 'transient', error: message, reason: 'concurrent-conflict' };
  }
  if (statusCode === 429 || statusCode >= 500) {
    return {
      kind: 'transient',
      error: message,
      reason: statusCode === 429 ? 'rate-limited' : 'server-error',
    };
  }

  // Every other 4xx: terminal (validation, auth, quota, misconfiguration…).
  return { kind: 'terminal', error: message, reason: 'validation' };
}
