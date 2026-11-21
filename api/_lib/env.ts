import type { EmailEnv } from './types.js';

/**
 * Server-side environment for the email functions. Everything is trimmed;
 * any missing required value makes the endpoint refuse to send (fail-closed)
 * instead of emitting an email with an unverified address or recipient.
 *
 * SERVER-ONLY: never introduce a `VITE_` prefix for these variables. Nothing
 * in this file may be bundled into the storefront.
 */

function read(name: string, env: Record<string, string | undefined>): string {
  const value = env[name]?.trim();
  return value ? value : '';
}

function readOptionalInt(
  name: string,
  env: Record<string, string | undefined>,
  fallback: number,
  { min, max }: { min: number; max: number }
): number {
  const raw = read(name, env);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function isValidEmailAddress(value: string): boolean {
  // Pragmatic check: local@domain.tld, rejecting angle brackets and commas so
  // the value can never smuggle a different recipient into the `to` field.
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
}

export type EnvLoadResult =
  | { ok: true; env: EmailEnv }
  | { ok: false; reason: string };

export function loadEmailEnv(
  env: Record<string, string | undefined> = process.env
): EnvLoadResult {
  const supabaseUrl = read('SUPABASE_URL', env) || read('VITE_SUPABASE_URL', env);
  const serviceRoleKey = read('SUPABASE_SERVICE_ROLE_KEY', env);
  const resendApiKey = read('RESEND_API_KEY', env);
  const resendFrom = read('RESEND_FROM_EMAIL', env);

  if (!supabaseUrl) return { ok: false, reason: 'missing-supabase-url' };
  if (!serviceRoleKey) return { ok: false, reason: 'missing-service-role-key' };
  if (!resendApiKey) return { ok: false, reason: 'missing-resend-api-key' };
  if (!resendFrom) return { ok: false, reason: 'missing-resend-from-email' };
  // "Three Ways Studios <orders@example.com>" — a display name followed by an
  // address, or a bare address. Anything else is ambiguous; refuse to send.
  const bareAddress = resendFrom.replace(/^.*<([^<>]+)>\s*$/, '$1').trim();
  if (!isValidEmailAddress(bareAddress)) {
    return { ok: false, reason: 'invalid-resend-from-email' };
  }

  const adminNotificationEmail = read('ADMIN_NOTIFICATION_EMAIL', env) || null;
  if (adminNotificationEmail && !isValidEmailAddress(adminNotificationEmail)) {
    return { ok: false, reason: 'invalid-admin-notification-email' };
  }

  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    return { ok: false, reason: 'invalid-supabase-url' };
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return { ok: false, reason: 'invalid-supabase-url' };
  }

  return {
    ok: true,
    env: {
      supabaseUrl: url.origin,
      serviceRoleKey,
      resendApiKey,
      resendFrom,
      adminNotificationEmail,
      claimLeaseSeconds: readOptionalInt('EMAIL_CLAIM_LEASE_SECONDS', env, 120, {
        min: 30,
        max: 3600,
      }),
      ipLimit: readOptionalInt('EMAIL_IP_LIMIT', env, 20, { min: 1, max: 1000 }),
      ipWindowSeconds: readOptionalInt('EMAIL_IP_WINDOW_SECONDS', env, 600, { min: 60, max: 86400 }),
      orderLimit: readOptionalInt('EMAIL_ORDER_LIMIT', env, 5, { min: 1, max: 100 }),
      orderWindowSeconds: readOptionalInt('EMAIL_ORDER_WINDOW_SECONDS', env, 3600, {
        min: 60,
        max: 86400,
      }),
    },
  };
}

/** Test seam: build a complete valid env with overrides. */
export function buildTestEnv(overrides: Partial<EmailEnv> = {}): EmailEnv {
  return {
    supabaseUrl: 'https://test-project.supabase.co',
    serviceRoleKey: 'test-service-role-key',
    resendApiKey: 're_test_key',
    resendFrom: 'Three Ways Studios <orders@test-project.supabase.co>',
    adminNotificationEmail: 'admin@test-project.supabase.co',
    claimLeaseSeconds: 120,
    ipLimit: 20,
    ipWindowSeconds: 600,
    orderLimit: 5,
    orderWindowSeconds: 3600,
    ...overrides,
  };
}
