import type { NotificationType } from './types.js';

/**
 * Resend's Idempotency-Key contract (https://resend.com/docs/dashboard/emails/idempotency-keys):
 *
 *   - Format: <event-type>/<entity-id>  (e.g. "order-confirmation/<order-id>")
 *   - Max 256 characters
 *   - Expires 24 hours after the request — anything from the order flow
 *     (including a late-retry after a crash) is always within that window.
 *
 * The keys are deterministic and stable for the whole lifecycle of a
 * notification row: the database stores the key and the endpoint refuses to
 * send anything else, so a retry/re-claim can never send a different payload
 * under the same key (which Resend turns into a 409).
 */
export function idempotencyKeyFor(notificationType: NotificationType, orderId: string): string {
  return `${notificationType}/${orderId}`;
}

export function isValidIdempotencyKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && key.length >= 1 && key.length <= 256;
}

export function idempotencyKeyMatches(
  key: string,
  notificationType: NotificationType,
  orderId: string
): boolean {
  return key === idempotencyKeyFor(notificationType, orderId);
}

export function assessIdempotencyKey(key: string | null | undefined): 'valid' | 'invalid' {
  return isValidIdempotencyKey(key) ? 'valid' : 'invalid';
}
