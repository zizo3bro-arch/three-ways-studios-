/**
 * GET /api/email-health[?probe=1]
 *
 * Read-only, secret-free diagnostics for the two email endpoints.
 *
 * Why this exists: the reported production symptom was "the order was created,
 * no email was sent, and Vercel shows no invocation for /api/order-confirmation
 * or /api/admin-new-order". An email that never arrives and a route that was
 * never invoked look identical from the outside. Opening this URL in a browser
 * on the deployed site answers the infrastructure questions in one request:
 *
 *   - JSON  → `/api/*` really reaches the serverless functions, so a missing
 *             invocation in the logs means the browser never sent the request.
 *   - HTML  → the SPA fallback is answering `/api/*`: no function runs.
 *   - 404   → the functions are not part of this deployment.
 *
 * `?probe=1` additionally performs ONE read-only Supabase request
 * (`HEAD /rest/v1/products`, a table the storefront already reads publicly)
 * through the same service-role client the notification endpoints use, built
 * from the same resolveSupabaseConfig() pair (api/_lib/env.ts). That is
 * what separates "the route is fine but the server credential/URL is wrong"
 * from "the database refuses the RPC" — without creating an order, without
 * claiming a notification, without sending an email and without writing
 * anything.
 *
 * It never sends email, never writes to the database, never claims a
 * notification, and never returns a secret, an address or an order.
 */
import { createClient } from '@supabase/supabase-js';
import { loadEmailEnv, resolveSupabaseConfig, type SupabaseConfigResult } from './_lib/env.js';
import { jsonError, sendJson } from './_lib/http.js';
import { describeKey, hostOf, logEvent, observeResponse, sanitizeDiagnostic } from './_lib/log.js';
import type { ApiRequest, ApiResponse } from './_lib/types.js';

const BOOTED_AT = new Date().toISOString();
const PROBE_TABLE = 'products';

interface ProbeResult {
  ok: boolean;
  latency_ms: number;
  http_status?: number | null;
  code?: string | null;
  message?: string | null;
  hint?: string | null;
}

type ProbeConfig = SupabaseConfigResult;

/**
 * The connectivity probe must remain usable when an unrelated mail variable is
 * missing. Using loadEmailEnv() here used to suppress ?probe=1 whenever, for
 * example, RESEND_FROM_EMAIL was absent — exactly when diagnostics are needed.
 * The Supabase pair itself comes from the same resolver the notification
 * endpoints use (resolveSupabaseConfig), so the probe can never describe or
 * exercise a configuration the endpoints would not pick: dedicated
 * `TWS_SUPABASE_URL` + `TWS_SUPABASE_SERVICE_ROLE_KEY` pair first (half a pair
 * fails closed), legacy variables only when neither TWS variable is set.
 */
function loadProbeConfig(
  source: Record<string, string | undefined> = process.env
): ProbeConfig {
  return resolveSupabaseConfig(source);
}

function wantsProbe(url: string | undefined): boolean {
  if (!url) return false;
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  if (!query) return false;
  return new URLSearchParams(query).get('probe') === '1';
}

/** One read-only request through the production service-role client. */
async function probeSupabase(supabaseUrl: string, serviceRoleKey: string): Promise<ProbeResult> {
  const startedAt = Date.now();
  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'tws-email-health-probe',
      },
    });
    // HEAD + count: no rows are returned, nothing is written, and `products`
    // is already readable by every anonymous visitor of the storefront.
    const { error } = await client
      .from(PROBE_TABLE)
      .select('id', { count: 'exact', head: true })
      .limit(1);
    const latency = Date.now() - startedAt;
    if (error) {
      const status = (error as { status?: unknown }).status;
      logEvent('probe-error', {
        endpoint: 'email-health',
        code: sanitizeDiagnostic(error.code, 40) || null,
        http_status: typeof status === 'number' ? status : null,
        message: sanitizeDiagnostic(error.message),
      });
      return {
        ok: false,
        latency_ms: latency,
        http_status: typeof status === 'number' ? status : null,
        code: sanitizeDiagnostic(error.code, 40) || null,
        message: sanitizeDiagnostic(error.message),
        hint: sanitizeDiagnostic((error as { hint?: string }).hint, 160) || null,
      };
    }
    logEvent('probe-ok', { endpoint: 'email-health', ms: latency });
    return { ok: true, latency_ms: latency };
  } catch (thrown) {
    const latency = Date.now() - startedAt;
    logEvent('probe-error', {
      endpoint: 'email-health',
      code: thrown instanceof Error ? thrown.name : 'unknown',
      message: sanitizeDiagnostic(thrown instanceof Error ? thrown.message : 'probe failed'),
    });
    return {
      ok: false,
      latency_ms: latency,
      http_status: null,
      code: thrown instanceof Error ? thrown.name : 'unknown',
      message: sanitizeDiagnostic(thrown instanceof Error ? thrown.message : 'probe failed'),
    };
  }
}

/**
 * A wrong-role credential must never look healthy. `products` is PUBLICLY
 * readable — the storefront serves it to every anonymous visitor — so the
 * anon key (valid JWT, correct project ref) completes the probe's HEAD read
 * with HTTP 200. Success of that read is not evidence of a service-role
 * configuration. The probe verdict is therefore gated on the credential
 * SHAPE: a JWT whose `role` claim is not `service_role`, a publishable key or
 * an unrecognised format fails closed with `key-role-not-service`, whatever
 * the read returned. Only `sb_secret_*` (the modern secret-key format: full
 * access, no role claim) or a JWT with `role: service_role` may pass. The
 * role/format labels come from describeKey() (sanitized, names only) — the
 * credential itself is never logged or returned.
 */
function gateProbeRole(result: ProbeResult, serviceRoleKey: string): ProbeResult {
  const key = describeKey(serviceRoleKey);
  const roleOk =
    key.format === 'sb_secret' || (key.format === 'jwt' && key.role === 'service_role');
  if (roleOk) return result;
  const label = key.role ? `key ${key.format} role "${key.role}"` : `key format "${key.format}"`;
  const message = sanitizeDiagnostic(`service-role key required (${label})`, 120);
  logEvent('probe-error', {
    endpoint: 'email-health',
    code: 'key-role-not-service',
    http_status: result.http_status ?? null,
    message,
  });
  return {
    ok: false,
    latency_ms: result.latency_ms,
    http_status: result.http_status ?? null,
    code: 'key-role-not-service',
    message,
    hint: result.hint ?? null,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const startedAt = Date.now();
  const snapshot = observeResponse(res);
  logEvent('request-start', { endpoint: 'email-health', method: req.method ?? 'unknown' });
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      jsonError(res, 405, 'method-not-allowed', {}, { Allow: 'GET' });
      return;
    }

    const env = loadEmailEnv();
    const probeConfig = loadProbeConfig();
    const vercelEnv = process.env.VERCEL_ENV;
    const host = probeConfig.ok ? hostOf(probeConfig.supabaseUrl) : null;
    const key = probeConfig.ok ? describeKey(probeConfig.serviceRoleKey) : null;
    let probeResult: ProbeResult | string = 'not-requested (add ?probe=1)';
    if (wantsProbe(req.url)) {
      probeResult = probeConfig.ok
        ? gateProbeRole(
            await probeSupabase(probeConfig.supabaseUrl, probeConfig.serviceRoleKey),
            probeConfig.serviceRoleKey
          )
        : `unavailable: ${probeConfig.reason}`;
    }

    const envStatus = env.ok
      ? {
          configured: true,
          admin_inbox_configured: Boolean(env.env.adminNotificationEmail),
          supabase_host: host,
          supabase_url_source: probeConfig.ok ? probeConfig.supabaseUrlSource : 'unknown',
          key: {
            format: key?.format ?? 'unknown',
            role: key?.role ?? null,
            project_matches_url:
              host && key?.projectRef ? host.startsWith(`${key.projectRef}.`) : null,
            source: probeConfig.ok ? probeConfig.serviceRoleKeySource : 'unknown',
          },
        }
      : { configured: false, reason: env.reason };

    sendJson(res, 200, {
      ok: true,
      endpoint: 'email-health',
      /** A JSON answer here proves /api/* is routed to a function. */
      routed_to_function: true,
      runtime: 'vercel-api',
      vercel: process.env.VERCEL === '1',
      environment: vercelEnv === 'production' || vercelEnv === 'preview' ? vercelEnv : 'unknown',
      // Commit the deployment was built from (Vercel provides this variable).
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'unknown',
      booted_at: BOOTED_AT,
      time: new Date().toISOString(),
      // Booleans, a host and a credential SHAPE only: never a value.
      env: envStatus,
      supabase_probe: probeResult,
      endpoints: ['/api/order-confirmation', '/api/admin-new-order'],
    });
  } finally {
    const { statusCode, errorCode } = snapshot();
    logEvent('request-complete', {
      endpoint: 'email-health',
      method: req.method ?? 'unknown',
      status: statusCode,
      outcome: errorCode ?? 'ok',
      ms: Date.now() - startedAt,
    });
  }
}
