import type { EmailEnv, ServiceRoleKeySource, SupabaseUrlSource } from './types.js';

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

/**
 * The resolved server-side Supabase pair. `ok: false` carries a stable reason
 * code (safe to log and to show in diagnostics); values never leave this module.
 */
export type SupabaseConfigResult =
  | {
      ok: true;
      supabaseUrl: string;
      supabaseUrlSource: SupabaseUrlSource;
      serviceRoleKey: string;
      serviceRoleKeySource: ServiceRoleKeySource;
    }
  | { ok: false; reason: string };

/**
 * Resolves the Supabase URL + service-role key pair for the server-side email
 * functions. Shared by loadEmailEnv() (the notification endpoints) and the
 * `?probe=1` connectivity probe (api/email-health.ts), so every function uses
 * the exact same resolved pair and the health endpoint can never describe a
 * configuration the endpoints would not pick.
 *
 * Pairing rule: the dedicated `TWS_SUPABASE_URL` + `TWS_SUPABASE_SERVICE_ROLE_KEY`
 * pair takes priority over the legacy variables, and the two must be configured
 * TOGETHER. Half a dedicated pair fails closed with a `missing-tws-*` reason —
 * a TWS URL is never combined with a legacy key, and a legacy URL is never
 * combined with a TWS key. The legacy fallback applies only when NEITHER TWS
 * variable is configured (an empty or whitespace-only value counts as
 * unconfigured). Within the legacy fallback, `SUPABASE_URL` wins over the
 * public `VITE_` variable, so a wrong but present SUPABASE_URL silently
 * overrides a working one. The chosen SOURCES are reported by the diagnostics
 * (api/_lib/production.ts, api/email-health.ts), never a value.
 */
export function resolveSupabaseConfig(
  env: Record<string, string | undefined> = process.env
): SupabaseConfigResult {
  const dedicatedUrl = read('TWS_SUPABASE_URL', env);
  const dedicatedKey = read('TWS_SUPABASE_SERVICE_ROLE_KEY', env);

  // Fail closed on a half-configured dedicated pair. Never mix and match.
  if (dedicatedUrl && !dedicatedKey) {
    return { ok: false, reason: 'missing-tws-service-role-key' };
  }
  if (!dedicatedUrl && dedicatedKey) {
    return { ok: false, reason: 'missing-tws-supabase-url' };
  }

  let rawUrl: string;
  let supabaseUrlSource: SupabaseUrlSource;
  let serviceRoleKey: string;
  let serviceRoleKeySource: ServiceRoleKeySource;
  if (dedicatedUrl && dedicatedKey) {
    rawUrl = dedicatedUrl;
    supabaseUrlSource = 'TWS_SUPABASE_URL';
    serviceRoleKey = dedicatedKey;
    serviceRoleKeySource = 'TWS_SUPABASE_SERVICE_ROLE_KEY';
  } else {
    // Legacy fallback — reached only when neither TWS variable is configured.
    const explicitUrl = read('SUPABASE_URL', env);
    const publicUrl = read('VITE_SUPABASE_URL', env);
    rawUrl = explicitUrl || publicUrl;
    supabaseUrlSource = explicitUrl ? 'SUPABASE_URL' : 'VITE_SUPABASE_URL';
    serviceRoleKey = read('SUPABASE_SERVICE_ROLE_KEY', env);
    serviceRoleKeySource = 'SUPABASE_SERVICE_ROLE_KEY';
    if (!rawUrl) return { ok: false, reason: 'missing-supabase-url' };
    if (!serviceRoleKey) return { ok: false, reason: 'missing-service-role-key' };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid-supabase-url' };
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return { ok: false, reason: 'invalid-supabase-url' };
  }
  return {
    ok: true,
    supabaseUrl: url.origin,
    supabaseUrlSource,
    serviceRoleKey,
    serviceRoleKeySource,
  };
}

export function loadEmailEnv(
  env: Record<string, string | undefined> = process.env
): EnvLoadResult {
  // The Supabase pair comes from the shared resolver so the endpoints and the
  // health probe cannot drift apart. Failures (including a half-configured
  // TWS pair) surface before any mail variable is examined.
  const supabase = resolveSupabaseConfig(env);
  if (!supabase.ok) return supabase;

  const resendApiKey = read('RESEND_API_KEY', env);
  const resendFrom = read('RESEND_FROM_EMAIL', env);

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

  return {
    ok: true,
    env: {
      supabaseUrl: supabase.supabaseUrl,
      supabaseUrlSource: supabase.supabaseUrlSource,
      serviceRoleKey: supabase.serviceRoleKey,
      serviceRoleKeySource: supabase.serviceRoleKeySource,
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
