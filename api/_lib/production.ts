/**
 * Production dependency wiring for the email-notification endpoints.
 * Everything here is server-only; nothing in this file is bundled into the
 * storefront (it lives in api/, imported only by api/order-confirmation.ts
 * and api/admin-new-order.ts).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OrderClient } from './order.js';
import type { HandlerDeps } from './handler.js';
import type { NotificationType, EmailEnv, EmailOrder, SendEmailContent, SendArgs, SendOutcome } from './types.js';
import { loadEmailEnv } from './env.js';
import { describeKey, hostOf, logEvent, sanitizeDiagnostic } from './log.js';
import { resolveClientIp } from './client-ip.js';
import { claimEmailNotification, rateLimitCheck, recordEmailOutcome } from './claims.js';
import { loadOrderForNotification } from './order.js';
import { createResendTransport, classifyResendOutcome } from './resendSend.js';
import { buildAdminNewOrderEmailHtml, buildCustomerConfirmationEmailHtml } from './emails.js';

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
  let configLogged = false;

  /**
   * One `config` event per cold start. It describes the Supabase target and the
   * credential SHAPE — never a value:
   *   supabase_host            which host the client actually talks to (a `db.`
   *                            or pooler host means the URL is wrong)
   *   supabase_url_source      TWS_SUPABASE_URL, SUPABASE_URL or the public
   *                            VITE_ fallback
   *   key_source               TWS_SUPABASE_SERVICE_ROLE_KEY or the legacy
   *                            SUPABASE_SERVICE_ROLE_KEY (always paired with
   *                            the URL source — see resolveSupabaseConfig)
   *   key_format               jwt / sb_secret / sb_publishable / unknown
   *   key_role                 the JWT `role` claim (must be service_role)
   *   key_project_matches_url  JWT `ref` claim vs the URL host — a key from
   *                            another project is invisible otherwise
   */
  const logConfiguration = (env: EmailEnv) => {
    if (configLogged) return;
    configLogged = true;
    const host = hostOf(env.supabaseUrl);
    const key = describeKey(env.serviceRoleKey);
    logEvent('config', {
      endpoint: notificationType,
      supabase_host: host,
      supabase_url_source: env.supabaseUrlSource ?? 'unknown',
      key_source: env.serviceRoleKeySource ?? 'unknown',
      key_format: key.format,
      key_role: key.role,
      key_project_matches_url:
        host && key.projectRef ? host.startsWith(`${key.projectRef}.`) : null,
      admin_inbox_configured: Boolean(env.adminNotificationEmail),
    });
  };

  const loadEnv = async () => {
    const result = loadEmailEnv();
    if (!result.ok) {
      logEvent('config-invalid', { endpoint: notificationType, reason: result.reason });
      return { ok: false as const, reason: result.reason };
    }
    cachedEnv = result.env;
    logConfiguration(result.env);
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

  /**
   * Every RPC the email pipeline makes goes through here, so every PostgREST
   * rejection is now recorded instead of being flattened into `null` and a
   * `503 rate-limit-unavailable` with no explanation.
   *
   * Behaviour is unchanged and still fail-closed: an error still yields
   * `{ data: null, error }`, which callers turn into a refusal (503/422),
   * never a bypass. Only the diagnosis is new. Messages are sanitized — a
   * PostgREST error contains the function name, a code and a hint, never
   * customer data, and any key-shaped substring is redacted.
   */
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    if (!cachedClient) {
      logEvent('rpc-skipped', {
        endpoint: notificationType,
        fn,
        reason: 'client-not-initialised',
      });
      return { data: null, error: { message: 'not-configured' } };
    }
    try {
      const { data, error } = await cachedClient.rpc(fn, args);
      if (error) {
        const status = (error as { status?: unknown }).status;
        logEvent('rpc-error', {
          endpoint: notificationType,
          fn,
          http_status: typeof status === 'number' ? status : null,
          code: sanitizeDiagnostic(error.code, 40) || null,
          message: sanitizeDiagnostic(error.message),
          hint: sanitizeDiagnostic((error as { hint?: string }).hint, 160) || null,
        });
        return { data, error: { message: error.message } };
      }
      return { data, error: null };
    } catch (thrown) {
      // A transport failure (DNS, TLS, blocked egress, aborted request) used to
      // disappear in claims.ts. It is the same 503, now with a reason.
      logEvent('rpc-error', {
        endpoint: notificationType,
        fn,
        http_status: null,
        code: thrown instanceof Error ? thrown.name : 'unknown',
        message: sanitizeDiagnostic(thrown instanceof Error ? thrown.message : 'rpc threw'),
        hint: null,
      });
      return { data: null, error: { message: 'rpc-request-failed' } };
    }
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
