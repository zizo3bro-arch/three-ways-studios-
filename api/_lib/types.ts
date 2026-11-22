/**
 * Minimal Vercel-runtime-compatible types.
 *
 * Vercel invokes `api/*.ts` handlers with a raw Node `IncomingMessage` and a
 * `ServerResponse`. We do not depend on `@vercel/node` for typing: these
 * shapes are intentionally the smallest interface the handlers need, and a
 * real Vercel request satisfies them structurally.
 */

export type NotificationType = 'order-confirmation' | 'admin-new-order';

export interface EmailEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  resendApiKey: string;
  resendFrom: string;
  /** Studio inbox receiving admin-new-order notifications. Required there. */
  adminNotificationEmail: string | null;
  claimLeaseSeconds: number;
  ipLimit: number;
  ipWindowSeconds: number;
  orderLimit: number;
  orderWindowSeconds: number;
}

export interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  /** Present in unit-test fakes; on Vercel the body is a raw stream. */
  body?: string;
  [Symbol.asyncIterator]?():
    | AsyncIterator<Buffer | string>
    | { next(): Promise<{ value: Buffer | string | undefined; done: boolean }> }
    | IterableIterator<Buffer | string>;
}

export interface ApiResponse {
  setHeader(name: string, value: string): void;
  getHeader(name: string): string | string[] | undefined;
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(body?: string): void;
  /** Set by `writeHead` in the Vercel runtime; read by the request diagnostics. */
  statusCode?: number;
}

export interface EmailLineItem {
  product_name: string;
  color_name: string;
  size_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  product_image?: string | null;
}

export interface EmailOrder {
  order_id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  governorate: string;
  city: string;
  delivery_address: string;
  order_notes: string;
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  email_discount_amount: number;
  promo_discount_amount: number;
  discount_total: number;
  applied_promo_code: string | null;
  loyalty_discount_amount?: number;
  loyalty_discount_percent?: number;
  loyalty_free_reward_amount?: number;
  loyalty_free_reward_product_name?: string | null;
  loyalty_seq?: number | null;
  total_amount: number;
  status: string;
  created_at: string;
  items: EmailLineItem[];
}

export interface SendOutcomeSuccess {
  kind: 'sent';
  resendId: string | null;
}

/**
 * Why the send failed, stable across releases so the row's last_error and the
 * response body can distinguish a recoverable in-flight conflict from a real
 * data problem. 'unknown-outcome' covers responses missing error/id.
 */
export type ResendFailureReason =
  | 'concurrent-conflict' // 409 concurrent_idempotent_requests — in-flight, safe to retry
  | 'payload-conflict' // 409 invalid_idempotent_request — same key, different payload, terminal
  | 'rate-limited' // 429
  | 'server-error' // 5xx
  | 'network' // no status code / fetch failure / unknown response shape
  | 'unknown-outcome' // no error payload and no id
  | 'validation'; // any other 4xx (validation, auth, quota, …)

export interface SendOutcomeTerminal {
  kind: 'terminal';
  error: string;
  reason?: ResendFailureReason;
}

export interface SendOutcomeTransient {
  kind: 'transient';
  error: string;
  reason?: ResendFailureReason;
}

export type SendOutcome = SendOutcomeSuccess | SendOutcomeTerminal | SendOutcomeTransient;

export interface SendEmailContent {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface SendArgs extends SendEmailContent {
  idempotencyKey: string;
}
