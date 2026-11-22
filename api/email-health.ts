/**
 * GET /api/email-health
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
 *             invocation in the logs means the browser never sent the request
 *             (stale bundle, blocked request, offline tab).
 *   - HTML  → the SPA fallback (`/(.*)` → `/index.html`) is answering `/api/*`:
 *             no function runs, so nothing appears in the function logs and no
 *             email can ever be sent, regardless of Resend.
 *   - 404   → the functions are not part of this deployment.
 *
 * It also reports whether the server-only environment is complete (booleans and
 * reason codes only) and which commit is deployed, so a stale production build
 * is visible without opening the Vercel dashboard.
 *
 * It never sends email, never touches the database, never claims a notification
 * and never returns a secret, an address or an order.
 */
import { loadEmailEnv } from './_lib/env.js';
import { jsonError, sendJson } from './_lib/http.js';
import { logEvent, observeResponse } from './_lib/log.js';
import type { ApiRequest, ApiResponse } from './_lib/types.js';

const BOOTED_AT = new Date().toISOString();

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
      // Booleans and a reason code only: never a value, never a recipient.
      env: env.ok
        ? { configured: true, admin_inbox_configured: Boolean(env.env.adminNotificationEmail) }
        : { configured: false, reason: env.reason },
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
