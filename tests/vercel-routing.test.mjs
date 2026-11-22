/**
 * Deployment routing guard for the email endpoints.
 *
 * `vercel.json` used to route the SPA fallback with `"source": "/(.*)"` — a
 * catch-all with no exclusion. Vercel's own knowledge base documents the
 * consequence and the fix:
 *
 *   "If the SPA also serves API routes, exclude them from the fallback with a
 *    negative lookahead, or every API call gets rewritten to index.html too."
 *   https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404
 *
 * When that happens, `POST /api/order-confirmation` is answered by
 * `index.html` with a 200, the serverless function never runs, nothing appears
 * in the Vercel function logs and no email can be sent — no matter what Resend
 * is configured to do. The browser-side trigger cannot tell the difference,
 * because it never reads the response body (it does now: see
 * src/lib/emailNotifications.ts).
 *
 * This test compiles the real `vercel.json` rewrite sources with
 * `path-to-regexp@6.1.0` — the exact parser version Vercel uses. An invalid
 * pattern fails the deployment outright ("invalid route source pattern"), so
 * this also protects against a future edit breaking routing in a way that is
 * only visible after a deploy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { pathToRegexp, match } from 'path-to-regexp';

const config = JSON.parse(await readFile('vercel.json', 'utf8'));

const API_PATHS = [
  '/api/order-confirmation',
  '/api/admin-new-order',
  '/api/email-health',
];

const CLIENT_PATHS = [
  '/',
  '/shop',
  '/cart',
  '/checkout',
  '/account',
  '/admin',
  '/order-confirmation/TWS-2026-ABCDEF123456',
];

test('every vercel.json rewrite source is a valid Vercel pattern', () => {
  const rewrites = config.rewrites ?? [];
  assert.ok(rewrites.length > 0, 'the SPA fallback must exist');
  for (const rewrite of rewrites) {
    assert.equal(typeof rewrite.source, 'string');
    assert.doesNotThrow(
      () => pathToRegexp(rewrite.source),
      `invalid rewrite source ${rewrite.source}: Vercel would reject the deployment`
    );
    assert.equal(typeof rewrite.destination, 'string');
  }
});

test('/api/* can never be answered by the SPA fallback', () => {
  const rewrites = config.rewrites ?? [];
  const fallback = rewrites.find((rewrite) => rewrite.destination === '/index.html');
  assert.ok(fallback, 'the SPA fallback still rewrites to /index.html');
  assert.equal(
    fallback.source,
    '/((?!api/).*)',
    'the SPA fallback must exclude /api/ with a negative lookahead'
  );

  const matches = match(fallback.source, { decode: decodeURIComponent });
  for (const path of API_PATHS) {
    assert.equal(
      matches(path),
      false,
      `${path} must reach its serverless function, not index.html`
    );
  }
  for (const path of CLIENT_PATHS) {
    assert.ok(matches(path), `${path} must still fall back to index.html (client route)`);
  }
});

test('the SPA fallback stays last, so it cannot shadow a later rule', () => {
  const rewrites = config.rewrites ?? [];
  const last = rewrites[rewrites.length - 1];
  assert.equal(last.destination, '/index.html');
});

test('every email endpoint has a deployed function file', async () => {
  for (const path of API_PATHS) {
    const file = `api${path.slice('/api'.length)}.ts`;
    const info = await stat(file);
    assert.ok(info.isFile(), `${file} must exist for ${path}`);
  }
});

test('the existing security posture and cache rules are still in place', () => {
  const headerRule = config.headers.find((rule) => rule.source === '/(.*)');
  assert.ok(headerRule, 'global response headers must still be applied');
  const csp = headerRule.headers.find((header) => header.key === 'Content-Security-Policy');
  assert.ok(csp, 'the CSP must still be applied');
  // A same-origin POST to /api/* must stay allowed by connect-src.
  assert.match(csp.value, /connect-src 'self'/);
  assert.match(csp.value, /default-src 'self'/);
  const admin = config.headers.find((rule) => rule.source === '/admin/:path*');
  assert.ok(admin, 'admin responses keep no-store');
  assert.match(admin.headers.find((header) => header.key === 'Cache-Control').value, /no-store/);
});
