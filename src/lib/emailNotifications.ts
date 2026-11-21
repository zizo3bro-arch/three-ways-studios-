/**
 * Fire-and-forget call into the server-side email functions.
 *
 * The email is best-effort from the browser's perspective: an order that is
 * confirmed must never block, fail or be re-created because an email had
 * trouble. The durable guarantees live server-side (migration 014 claim
 * tokens + Resend Idempotency-Keys), so a retry here is always safe.
 */
const EMAIL_TIMEOUT_MS = 8_000;
const ORDER_ID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

async function postEmailSafely(path: string, orderId: string): Promise<void> {
  try {
    const controller = new globalThis.AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
    try {
      await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
        signal: controller.signal,
      });
    } finally {
      globalThis.clearTimeout(timer);
    }
    return;
  } catch {
    // Any failure is deliberately silent: receipts come from the database.
    return;
  }
}

export async function announceOrderConfirmationEmail(orderId: string): Promise<void> {
  if (!ORDER_ID.test(orderId ?? '')) return;
  await postEmailSafely('/api/order-confirmation', orderId);
}

/** Both notification types; called once after a successful order placement. */
export async function announceOrderEmails(orderId: string): Promise<void> {
  if (!ORDER_ID.test(orderId ?? '')) return;
  await Promise.allSettled([
    postEmailSafely('/api/order-confirmation', orderId),
    postEmailSafely('/api/admin-new-order', orderId),
  ]);
}
