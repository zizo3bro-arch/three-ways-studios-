/**
 * Shared request pipeline for the order-notification endpoints.
 *
 * The email content is ALWAYS constructed server-side from the order row —
 * never from the request body. The body carries only the (opaque, unguessable)
 * order_id, which identifies the notification being requested.
 *
 * Stage order (fail-closed everywhere, no silent pass-through):
 *   1. method/content-type
 *   2. body parse (capped) + strict order_id validation
 *   3. env validation (misconfiguration → 500)
 *   4. client IP resolution (Vercel-trusted headers only)
 *   5. atomic rate limiting (both IP and per-order buckets) → 429/503
 *   6. load order server-side → 404 / 500  (validated BEFORE any claim)
 *   7. claim ownership (claim token lease) → never reclaim in-flight
 *   8. build email from the order row
 *   9. send via Resend with the deterministic Idempotency-Key
 *  10. record the outcome conditionally on the claim token
 *  11. safe minimal response — never echoes customer/admin addresses
 */
import type { ClientIpResolution } from './client-ip';
import type { ClaimResult } from './claims';
import { hasJsonContentType, InvalidJsonError, BodyTooLargeError, jsonError, readJsonBody, sendJson } from './http';
import { idempotencyKeyMatches, isValidIdempotencyKey } from './idempotency-keys';
import type { EmailEnv, EmailOrder, NotificationType, SendArgs, SendEmailContent, SendOutcome, ApiRequest, ApiResponse } from './types';

export const ALLOWED_BODY_KEYS = ['order_id'] as const;

export interface HandlerDeps {
  notificationType: NotificationType;
  loadEnv: () => Promise<{ ok: true; env: EmailEnv } | { ok: false; reason: string }>;
  resolveIp: (req: ApiRequest) => ClientIpResolution;
  /** Atomic rate limit. Returns null when the rate-limit service itself is unavailable. */
  rateLimit: (
    key: string,
    limit: number,
    windowSeconds: number
  ) => Promise<{ allowed: boolean; retryAfterSeconds: number } | null>;
  /** Claim the notification row. Returns null on infrastructure failure. */
  claim: (orderId: string, leaseSeconds: number) => Promise<ClaimResult | null>;
  /** Conditional outcome recording. True when the outcome was actually applied. */
  recordOutcome: (
    orderId: string,
    status: 'claimed' | 'sent' | 'failed',
    opts: { resendId?: string | null; error?: string | null },
    claimToken: string
  ) => Promise<boolean>;
  /** Returns the order, null when it does not exist; throws on infrastructure failure. */
  loadOrder: (orderId: string) => Promise<EmailOrder | null>;
  /** Builds the exact email sent for this order (content, recipient, sender). */
  buildEmail: (order: EmailOrder, env: EmailEnv) => SendEmailContent | { error: string };
  /** Sends the email honoring the idempotency key. */
  sendEmail: (args: SendArgs) => Promise<SendOutcome>;
  now?: () => Date;
}

const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function handleOrderNotificationRequest(
  deps: HandlerDeps,
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    jsonError(res, 405, 'method-not-allowed', {}, { Allow: 'POST' });
    return;
  }
  if (!hasJsonContentType(req)) {
    jsonError(res, 415, 'unsupported-content-type');
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      jsonError(res, 413, 'body-too-large');
      return;
    }
    if (error instanceof InvalidJsonError) {
      jsonError(res, 400, 'invalid-json');
      return;
    }
    jsonError(res, 400, 'invalid-json');
    return;
  }

  if (!isRecord(body)) {
    jsonError(res, 400, 'invalid-body');
    return;
  }
  for (const key of Object.keys(body)) {
    if (!(ALLOWED_BODY_KEYS as readonly string[]).includes(key)) {
      jsonError(res, 400, 'unexpected-field', { fields: [key] });
      return;
    }
  }
  const orderIdRaw = (body as Record<string, unknown>).order_id;
  if (typeof orderIdRaw !== 'string' || !UUID.test(orderIdRaw)) {
    jsonError(res, 422, 'invalid-order-id');
    return;
  }
  const orderId = orderIdRaw;

  const envResult = await deps.loadEnv();
  if (!envResult.ok) {
    // Misconfiguration is a safe refusal to send, never a best-effort send.
    jsonError(res, 500, 'not-configured');
    return;
  }
  const { env } = envResult;

  // Client IP: Vercel-documented headers only, validated as a real address.
  const ipResolution = deps.resolveIp(req);
  const ip = ipResolution.ip;

  // Atomic rate limits — both buckets must pass. Any service failure is closed.
  const ipVerdict = await deps.rateLimit(`email:${deps.notificationType}:ip:${ip}`, env.ipLimit, env.ipWindowSeconds);
  const orderVerdict = await deps.rateLimit(
    `email:${deps.notificationType}:order:${orderId}`,
    env.orderLimit,
    env.orderWindowSeconds
  );
  if (ipVerdict === null || orderVerdict === null) {
    jsonError(res, 503, 'rate-limit-unavailable', { retryAfter: 60 }, { 'Retry-After': '60' });
    return;
  }
  if (!ipVerdict.allowed || !orderVerdict.allowed) {
    const retryAfter = Math.max(ipVerdict.retryAfterSeconds, orderVerdict.retryAfterSeconds, 1);
    jsonError(res, 429, 'rate-limited', { retryAfter }, { 'Retry-After': String(retryAfter) });
    return;
  }

  // Validate the order exists before claiming anything. The claim row has a
  // foreign key to orders, so claiming an unknown order would surface as a
  // 503 FK violation instead of a genuine 404. Load through the service-role
  // client; never trust the caller. The 404 carries no extra order data.
  let order: EmailOrder | null;
  try {
    order = await deps.loadOrder(orderId);
  } catch {
    jsonError(res, 500, 'order-lookup-failed');
    return;
  }
  if (!order) {
    jsonError(res, 404, 'order-not-found');
    return;
  }

  // Claim the notification (claim-ownership token lease). Never reclaim an
  // in-flight claim — a legitimate request may still be active.
  const claimResult = await deps.claim(orderId, env.claimLeaseSeconds);
  if (claimResult === null) {
    jsonError(res, 503, 'claim-unavailable', { retryAfter: 60 }, { 'Retry-After': '60' });
    return;
  }

  if (claimResult.outcome === 'already_sent') {
    sendJson(res, 200, { sent: true, already_sent: true });
    return;
  }
  if (claimResult.outcome === 'failed') {
    // Terminal, recorded failure — do not re-send or bounce the request.
    jsonError(res, 422, 'notification-failed');
    return;
  }
  if (claimResult.outcome === 'in_flight' || claimResult.outcome === 'lost') {
    // Another request owns the claim right now. Honest pending, not a resend.
    const retryAfter = Math.max(
      1,
      Math.ceil(
        claimResult.claimExpiresAt && deps.now
          ? (new Date(claimResult.claimExpiresAt).getTime() - deps.now().getTime()) / 1000
          : (env.claimLeaseSeconds ?? 120)
      )
    );
    sendJson(res, 202, { sent: false, pending: true }, { 'Retry-After': String(retryAfter) });
    return;
  }

  // outcome is 'new' or 'reclaimed' — caller owns the claim.
  const idempotencyKey = claimResult.idempotencyKey;
  if (!idempotencyKey || !isValidIdempotencyKey(idempotencyKey)
    || !idempotencyKeyMatches(idempotencyKey, deps.notificationType, orderId)) {
    jsonError(res, 500, 'idempotency-key-invalid');
    return;
  }

  const email = deps.buildEmail(order, env);
  if ('error' in email) {
    jsonError(res, 500, email.error === 'missing-admin-inbox' ? 'not-configured' : 'email-build-failed');
    return;
  }

  const sendArgs: SendArgs = { ...email, idempotencyKey };
  const outcome = await deps.sendEmail(sendArgs);

  if (outcome.kind === 'sent') {
    await deps.recordOutcome(orderId, 'sent', { resendId: outcome.resendId }, claimResult.claimToken ?? '');
    sendJson(res, 200, { sent: true });
    return;
  }

  if (outcome.kind === 'terminal') {
    await deps.recordOutcome(orderId, 'failed', { error: outcome.error }, claimResult.claimToken ?? '');
    jsonError(res, 422, 'delivery-failed');
    return;
  }

  // Transient: preserve the claim (error captured) so a retry can re-claim
  // once the lease expires. Resend's idempotency key prevents real duplicates.
  await deps.recordOutcome(orderId, 'claimed', { error: outcome.error }, claimResult.claimToken ?? '');
  jsonError(res, 503, 'delivery-unavailable', { retryAfter: 60 }, { 'Retry-After': '60' });
}
