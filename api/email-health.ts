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
 * through the same service-role client the notification endpoints use. That is
 * what separates "the route is fine but the server credential/URL is wrong"
 * from "the database refuses the RPC" — without creating an order, without
 * claiming a notification, without sending an email and without writing
 * anything.
 *
 * It never sends email, never writes to the database, never claims a
 * notification, and never returns a secret, an address or an order.
 */
import { createClient } from '@supabase/supabase-js';
import { loadEmailEnv } from './_lib/env.js';
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
    const vercelEnv = process.env.VERCEL_ENV;
    const host = env.ok ? hostOf(env.env.supabaseUrl) : null;
    const key = env.ok ? describeKey(env.env.serviceRoleKey) : null;
    // Resolve the probe before serialising so `env` stays narrowed (no `!`).
    let probeResult: ProbeResult | 'not-requested (add ?probe=1)' = 'not-requested (add ?probe=1)';
    if (env.ok && wantsProbe(req.url)) {
      probeResult = await probeSupabase(env.env.supabaseUrl, env.env.serviceRoleKey);
    }

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
      env: env.ok
        ? {
            configured: true,
            admin_inbox_configured: Boolean(env.env.adminNotificationEmail),
            supabase_host: host,
            supabase_url_source: env.env.supabaseUrlSource ?? 'unknown',
            key: {
              format: key?.format ?? 'unknown',
              role: key?.role ?? null,
              project_matches_url:
                host && key?.projectRef ? host.startsWith(`${key.projectRef}.`) : null,
            },
          }
        : { configured: false, reason: env.reason },
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
