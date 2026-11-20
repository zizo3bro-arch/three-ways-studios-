import { type OrderConfirmationData } from '../types/database';

/* ========================================================================
   THREE WAYS STUDIOS — client-side order email notifier
   
   Calls the studio's own server function (/api/send-order-emails) after an
   order is saved. Resend and its API key live only on the server; nothing
   about email delivery is embedded in the browser bundle.
   
   Delivery failures never fail the order: the checkout flow continues and
   the customer still sees their confirmation page.
   ======================================================================== */

export type EmailNotificationResult = {
  ok: boolean;
  /** The server function exists and accepted the request. */
  configured: boolean;
  /** Per-notification outcome (customer confirmation / admin notification). */
  results?: Array<{
    type: string;
    status: 'sent' | 'skipped' | 'failed';
    error?: string;
  }>;
  error?: string;
};

const API_PATH = '/api/send-order-emails';

/**
 * Notify the studio and the customer that a new order was saved.
 * Fire-and-forget from checkout: a thrown or rejected result is logged and
 * swallowed so the order flow is never blocked by email.
 */
export async function notifyOrderPlaced(
  orderReference: string,
  customerEmail: string
): Promise<EmailNotificationResult> {
  const notConfigured: EmailNotificationResult = {
    ok: false,
    configured: false,
    error: 'Order email endpoint is not reachable.',
  };

  try {
    const response = await fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderReference,
        customerEmail: customerEmail.trim().toLowerCase(),
      }),
    });

    if (!response.ok) {
      return {
        ...notConfigured,
        configured: response.status === 503,
        error: `Server responded ${response.status}`,
      };
    }

    return (await response.json()) as EmailNotificationResult;
  } catch (e) {
    // No server function in local dev, or the network is down: the order
    // itself was already saved, so this is not a checkout failure.
    console.warn('[TWS] Order notification email could not be sent.', e);
    return { ...notConfigured, configured: false, error: String(e) };
  }
}

/**
 * Attach email notification to a successful COD checkout without blocking it.
 * Returns the email result for optional logging; the caller must not branch
 * checkout behavior on it.
 */
export async function reportOrderPlaced(
  order: OrderConfirmationData
): Promise<EmailNotificationResult> {
  return notifyOrderPlaced(order.order_reference, order.customer_email);
}
