/**
 * Production dependency wiring for the email-notification endpoints.
 * Everything here is server-only; nothing in this file is bundled into the
 * storefront (it lives in api/, imported only by api/order-confirmation.ts
 * and api/admin-new-order.ts).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OrderClient } from './order';
import type { HandlerDeps } from './handler';
import type { NotificationType, EmailEnv, EmailOrder, SendEmailContent, SendArgs, SendOutcome } from './types';
import { loadEmailEnv } from './env';
import { resolveClientIp } from './client-ip';
import { claimEmailNotification, rateLimitCheck, recordEmailOutcome } from './claims';
import { loadOrderForNotification } from './order';
import { createResendTransport, classifyResendOutcome } from './resendSend';
import { buildAdminNewOrderEmailHtml, buildCustomerConfirmationEmailHtml } from './emails';

function orderClientFor(client: SupabaseClient): OrderClient {
  return {
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          single: async () => {
            const { data, error } = await client
              .from(table)
              .select(columns)
              .eq(column, value)
              .single();
            return {
              data: data as Record<string, unknown> | null,
              error: error ? { code: error.code, message: error.message } : null,
            };
          },
        }),
      }),
    }),
  };
}

export function createProductionDeps(notificationType: NotificationType): HandlerDeps {
  let cachedClient: SupabaseClient | null = null;
  let cachedEnv: EmailEnv | null = null;

  const loadEnv = async () => {
    const result = loadEmailEnv();
    if (!result.ok) return { ok: false as const, reason: result.reason };
    cachedEnv = result.env;
    cachedClient = createClient(result.env.supabaseUrl, result.env.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'tws-email-functions',
      },
    });
    return { ok: true as const, env: result.env };
  };

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    if (!cachedClient) return { data: null, error: { message: 'not-configured' } };
    const { data, error } = await cachedClient.rpc(fn, args);
    return { data, error: error ? { message: error.message } : null };
  };

  return {
    notificationType,
    loadEnv,
    resolveIp: (req) => resolveClientIp(req.headers),
    rateLimit: async (key, limit, windowSeconds) => {
      const verdict = await rateLimitCheck(rpc, key, limit, windowSeconds);
      if (verdict === null) return null;
      return { allowed: verdict.allowed, retryAfterSeconds: verdict.retryAfterSeconds };
    },
    claim: (orderId, leaseSeconds) => claimEmailNotification(rpc, orderId, notificationType, leaseSeconds),
    recordOutcome: (orderId, status, opts, claimToken) =>
      recordEmailOutcome(rpc, orderId, notificationType, claimToken, status, opts),
    loadOrder: async (orderId) => {
      if (!cachedClient) throw new Error('not-configured');
      return loadOrderForNotification(orderClientFor(cachedClient), orderId);
    },
    buildEmail: (order: EmailOrder, env: EmailEnv): SendEmailContent | { error: string } => {
      try {
        if (notificationType === 'admin-new-order') {
          if (!env.adminNotificationEmail) return { error: 'missing-admin-inbox' };
          const { subject, html } = buildAdminNewOrderEmailHtml(order);
          return { from: env.resendFrom, to: env.adminNotificationEmail, subject, html };
        }
        const { subject, html } = buildCustomerConfirmationEmailHtml(order);
        return { from: env.resendFrom, to: order.customer_email, subject, html };
      } catch {
        return { error: 'email-build-failed' };
      }
    },
    sendEmail: async (args: SendArgs): Promise<SendOutcome> => {
      if (!cachedEnv) return { kind: 'transient', error: 'not-configured' };
      try {
        const transport = createResendTransport(cachedEnv.resendApiKey);
        const result = await transport.send(args, { idempotencyKey: args.idempotencyKey });
        return classifyResendOutcome(result);
      } catch {
        return { kind: 'transient', error: 'resend-transport-error' };
      }
    },
    now: () => new Date(),
  };
}
