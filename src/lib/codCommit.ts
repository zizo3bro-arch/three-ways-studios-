/**
 * The one place where a committed cash-on-delivery order becomes a receipt.
 *
 * Why this module exists
 * ----------------------
 * The order-notification emails used to be triggered from the checkout page,
 * *after* the full receipt had been validated:
 *
 *     const { order } = await createCodOrder(...);
 *     if (!order) return;                       // ← every receipt problem
 *     void announceOrderEmails(order.order_id); // ← never reached
 *
 * That made the trigger depend on UI-level receipt validation. If the RPC
 * committed (the order is in the admin panel and stock moved) but the returned
 * receipt failed any of the checks in `isOrderReceipt` — or if the component
 * changed, the bundle was stale, or a later edit moved the call — the emails
 * were silently skipped with no log anywhere and no server-side trace.
 *
 * The trigger now lives here, on the commit path itself: the moment the RPC
 * answers without an error, the order exists in PostgreSQL, so the notification
 * attempt is made from the *raw* response, before and independently of receipt
 * validation. Nothing downstream can skip it, and a failing email can never
 * change the outcome of the order (see `announce` below).
 *
 * Email delivery is still best-effort and never awaited by the UI: the call is
 * fire-and-forget, failures are swallowed, and the durable guarantees stay
 * server-side (migration 014 claim tokens + Resend Idempotency-Keys).
 */
import type { OrderConfirmationData } from '../types/database';
import { announceOrderEmails } from './emailNotifications';

export const ORDER_ID_PATTERN = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

/** Error codes that mean "the transaction was rejected, re-quote and retry".
 * Identical to the previous inline list; kept here so the commit path and its
 * tests own the whole rule. */
const RETRY_CODES = ['P0001', '23514', '23505'];

export interface CodRpcError {
  code?: string;
  message: string;
}

export interface CodRpcResponse {
  data: unknown;
  error: CodRpcError | null;
}

export interface CodCommitResult {
  order: OrderConfirmationData | null;
  /** UUID of the committed order, also set when the receipt itself was unusable. */
  orderId: string | null;
  error: string | null;
  refreshQuote?: boolean;
}

export interface CodCommitDeps {
  /** Performs the write. Must not retry: duplicate protection lives in the RPC. */
  rpc: (payload: Record<string, unknown>) => Promise<CodRpcResponse>;
  /** Notification hook. Defaults to the real both-endpoints trigger. */
  announce?: (orderId: string) => unknown;
}

function errorMessage(error: unknown, fallback: string): string {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback;
}

/** The order id is the only field the email endpoints need, and it is the only
 * field required to prove the RPC actually committed something. */
export function orderIdFromRpcResult(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidate = (data as { order_id?: unknown }).order_id;
  return typeof candidate === 'string' && ORDER_ID_PATTERN.test(candidate) ? candidate : null;
}

/** A receipt the UI may render. Unchanged from the original `receipt()` guard. */
export function isOrderReceipt(data: unknown): data is OrderConfirmationData {
  const receipt = data as OrderConfirmationData | null;
  return Boolean(
    receipt &&
      ORDER_ID_PATTERN.test(receipt.order_id) &&
      receipt.order_reference &&
      receipt.payment_method === 'COD' &&
      Number.isFinite(receipt.total_amount) &&
      Array.isArray(receipt.items) &&
      receipt.items.length
  );
}

/** Fire-and-forget with a hard guarantee: this can never throw and never
 * produce an unhandled rejection, so a broken email can never invalidate an
 * order that PostgreSQL has already committed. */
function announceAfterCommit(announce: (orderId: string) => unknown, orderId: string): void {
  try {
    const result = announce(orderId);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void (result as Promise<unknown>).catch(() => {
        /* best-effort only */
      });
    }
  } catch {
    /* best-effort only */
  }
}

export async function commitCodOrder(
  payload: Record<string, unknown>,
  deps: CodCommitDeps
): Promise<CodCommitResult> {
  const announce = deps.announce ?? announceOrderEmails;
  let response: CodRpcResponse;
  try {
    response = await deps.rpc(payload);
  } catch (error) {
    return { order: null, orderId: null, error: errorMessage(error, 'The order could not be confirmed. Retry with the same bag and email.') };
  }

  if (response.error?.code === 'PGRST202') {
    return { order: null, orderId: null, error: 'Order confirmation is temporarily unavailable. Please try again later.' };
  }
  if (response.error) {
    return {
      order: null,
      orderId: null,
      error: response.error.message,
      // A rejected transaction didn't commit. Re-quote in case inventory, loyalty or promo changed.
      refreshQuote: RETRY_CODES.includes(response.error.code ?? ''),
    };
  }

  // The write committed. The order exists from here on: announce it before any
  // receipt validation, so no UI-level check can silently swallow the emails.
  const orderId = orderIdFromRpcResult(response.data);
  if (orderId) announceAfterCommit(announce, orderId);

  if (!isOrderReceipt(response.data)) {
    return {
      order: null,
      orderId,
      error: 'The studio did not return an order reference. Retry with the same bag and email.',
    };
  }
  return { order: response.data, orderId, error: null };
}
