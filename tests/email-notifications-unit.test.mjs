/**
 * Unit tests for the email-notification API — mocked unit tests ONLY.
 * Network, database and Resend are never contacted; the module seams are
 * injected. The paired integration tests live in email-notifications-db.test.mjs
 * and exercise the real PostgreSQL SQL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const ORDER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';

let vite;
test.before(async () => {
  vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
    resolve: { alias: { react: 'react', 'react-dom': 'react-dom' } },
    ssr: { external: ['resend', '@supabase/supabase-js', 'node:net', 'node:http', 'node:fs', 'node:crypto'] },
  });
});
test.after(() => vite?.close());

async function load(path) {
  return vite.ssrLoadModule(path);
}

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    body: null,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    writeHead(statusCode, extra = {}) { this.statusCode = statusCode; Object.assign(headers, extra); },
    end(body) { this.body = body ?? null; },
    json() { return JSON.parse(this.body ?? 'null'); },
  };
}

function fakeReq(body, { method = 'POST', headers = {}, url = '/api/order-confirmation' } = {}) {
  return {
    method,
    url,
    headers: { 'content-type': 'application/json', ...headers },
    async *[Symbol.asyncIterator]() { yield Buffer.from(typeof body === 'string' ? body : JSON.stringify(body ?? null)); },
  };
}

function fakeOrder(overrides = {}) {
  return {
    order_id: ORDER_ID,
    order_reference: 'TWS-2026-ABC123DEF456',
    customer_name: 'Fixture Buyer',
    customer_email: 'buyer@example.test',
    customer_phone: '01012345678',
    governorate: 'Cairo',
    city: 'Cairo',
    delivery_address: 'Test address',
    order_notes: '',
    payment_method: 'COD',
    subtotal: 2450,
    shipping_cost: 75,
    email_discount_amount: 245,
    promo_discount_amount: 0,
    discount_total: 245,
    applied_promo_code: null,
    loyalty_discount_amount: 0,
    loyalty_discount_percent: 0,
    loyalty_free_reward_amount: 0,
    loyalty_free_reward_product_name: null,
    loyalty_seq: null,
    total_amount: 2280,
    status: 'pending',
    created_at: '2026-11-21T12:00:00.000Z',
    items: [
      {
        product_name: 'TWS Signature Tee',
        color_name: 'Black',
        size_name: 'L',
        quantity: 1,
        unit_price: 2450,
        line_total: 2450,
        product_image: null,
      },
    ],
    ...overrides,
  };
}

const DEFAULT_ENV = {
  supabaseUrl: 'https://test-project.supabase.co',
  serviceRoleKey: 'test-service-role-key',
  resendApiKey: 're_test_key_1234567890abcdef',
  resendFrom: 'Three Ways Studios <orders@test-project.supabase.co>',
  adminNotificationEmail: 'staff@test-project.supabase.co',
  claimLeaseSeconds: 120,
  ipLimit: 20,
  ipWindowSeconds: 600,
  orderLimit: 5,
  orderWindowSeconds: 3600,
};

function makeDeps(overrides = {}) {
  const calls = { rateLimit: [], claim: [], recordOutcome: [], loadOrder: [], send: [], buildEmail: [] };
  const deps = {
    notificationType: 'order-confirmation',
    loadEnv: async () => ({ ok: true, env: { ...DEFAULT_ENV } }),
    resolveIp: (req) => ({ ip: '203.0.113.7', source: 'x-vercel-forwarded-for', trusted: true }),
    rateLimit: async (key, limit, windowSeconds) => {
      calls.rateLimit.push({ key, limit, windowSeconds });
      return { allowed: true, retryAfterSeconds: 60 };
    },
    claim: async (orderId, leaseSeconds) => {
      calls.claim.push({ orderId, leaseSeconds });
      return {
        outcome: 'new',
        claimToken: 'claim-token-uuid',
        idempotencyKey: `${deps.notificationType}/${orderId}`,
        status: 'claimed',
        claimExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        lastError: null,
      };
    },
    recordOutcome: async (orderId, status, opts, claimToken) => {
      calls.recordOutcome.push({ orderId, status, opts, claimToken });
      return true;
    },
    loadOrder: async (orderId) => {
      calls.loadOrder.push({ orderId });
      return fakeOrder();
    },
    buildEmail: (order, env) => {
      calls.buildEmail.push({ order, env });
      return { from: env.resendFrom, to: order.customer_email, subject: 'Order confirmed', html: '<p>ok</p>' };
    },
    sendEmail: async (args) => {
      calls.send.push({ args });
      return { kind: 'sent', resendId: 'resend-should-be-recorded' };
    },
    now: () => new Date(),
    ...overrides,
  };
  deps.calls = calls;
  return deps;
}

test('idempotency keys: stable, deterministic, allowed to be re-sent across retries', async () => {
  const { idempotencyKeyFor, isValidIdempotencyKey, idempotencyKeyMatches } = await load('/api/_lib/idempotency-keys.ts');

  assert.equal(idempotencyKeyFor('order-confirmation', ORDER_ID), `order-confirmation/${ORDER_ID}`);
  assert.equal(idempotencyKeyFor('admin-new-order', ORDER_ID), `admin-new-order/${ORDER_ID}`);
  for (const key of [
    idempotencyKeyFor('order-confirmation', ORDER_ID),
    idempotencyKeyFor('admin-new-order', ORDER_ID),
  ]) {
    assert.ok(key.length <= 256, 'Resend caps keys at 256 characters');
    assert.ok(isValidIdempotencyKey(key));
  }
  // same input → same key, forever (stable across retries/re-claims)
  assert.equal(idempotencyKeyFor('order-confirmation', ORDER_ID), idempotencyKeyFor('order-confirmation', ORDER_ID));
  // mismatch for the wrong notification type → not accepted
  assert.equal(idempotencyKeyMatches(idempotencyKeyFor('order-confirmation', ORDER_ID), 'order-confirmation', ORDER_ID), true);
  assert.equal(idempotencyKeyMatches(idempotencyKeyFor('admin-new-order', ORDER_ID), 'order-confirmation', ORDER_ID), false);
  assert.equal(idempotencyKeyMatches(idempotencyKeyFor('order-confirmation', ORDER_ID), 'order-confirmation', OTHER_ID), false);
});

test('env validation: required keys, from-address parsing, and limits parsing', async () => {
  const { loadEmailEnv } = await load('/api/_lib/env.ts');
  const base = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'key',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'Three Ways Studios <orders@test-project.supabase.co>',
    ADMIN_NOTIFICATION_EMAIL: 'staff@test-project.supabase.co',
  };

  assert.equal(loadEmailEnv({ ...base, SUPABASE_SERVICE_ROLE_KEY: '' }).ok, false);
  assert.equal(loadEmailEnv({ ...base, RESEND_API_KEY: '' }).ok, false);
  assert.equal(loadEmailEnv({ ...base, RESEND_FROM_EMAIL: '' }).ok, false);
  assert.equal(loadEmailEnv({ ...base, ADMIN_NOTIFICATION_EMAIL: 'not-an-email' }).ok, false);
  assert.equal(loadEmailEnv({ ...base, SUPABASE_URL: 'not-a-url' }).ok, false);

  const ok = loadEmailEnv(base);
  assert.equal(ok.ok, true);
  assert.equal(ok.env.adminNotificationEmail, 'staff@test-project.supabase.co');
  assert.equal(ok.env.ipLimit, 20);
  assert.equal(ok.env.claimLeaseSeconds, 120);

  const bare = loadEmailEnv({ ...base, RESEND_FROM_EMAIL: 'orders@test-project.supabase.co' });
  assert.equal(bare.ok, true);
  assert.equal(bare.env.resendFrom, 'orders@test-project.supabase.co');

  const overridden = loadEmailEnv({ ...base, EMAIL_IP_LIMIT: '3', EMAIL_CLAIM_LEASE_SECONDS: '45' });
  assert.equal(overridden.ok, true);
  assert.equal(overridden.env.ipLimit, 3);
  assert.equal(overridden.env.claimLeaseSeconds, 45);

  // invalid overrides fall back to defaults, never to garbage
  const broken = loadEmailEnv({ ...base, EMAIL_IP_LIMIT: '0', EMAIL_CLAIM_LEASE_SECONDS: '5' });
  assert.equal(broken.ok, true);
  assert.equal(broken.env.ipLimit, 20);
  assert.equal(broken.env.claimLeaseSeconds, 120);

  // admin inbox is optional for customer-confirmation; stays required for the
  // admin endpoint, enforced by the handler's buildEmail.
  const noAdmin = loadEmailEnv({ ...base, ADMIN_NOTIFICATION_EMAIL: '' });
  assert.equal(noAdmin.ok, true);
  assert.equal(noAdmin.env.adminNotificationEmail, null);
});

test('env resolution: the TWS_* pair wins, half a pair fails closed, legacy fallback survives', async () => {
  const { loadEmailEnv, resolveSupabaseConfig } = await load('/api/_lib/env.ts');
  const legacy = {
    SUPABASE_URL: 'https://legacy-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role-key',
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'Three Ways Studios <orders@test-project.supabase.co>',
    ADMIN_NOTIFICATION_EMAIL: 'staff@test-project.supabase.co',
    TWS_SUPABASE_URL: undefined,
    TWS_SUPABASE_SERVICE_ROLE_KEY: undefined,
  };
  const TWS_URL = 'https://dedicated-project.supabase.co';
  const TWS_KEY = 'tws-service-role-key';

  // 1. Both TWS variables set: the dedicated pair is selected even though a
  //    complete legacy pair exists — and the halves are never mixed.
  const dedicated = loadEmailEnv({
    ...legacy,
    TWS_SUPABASE_URL: TWS_URL,
    TWS_SUPABASE_SERVICE_ROLE_KEY: TWS_KEY,
  });
  assert.equal(dedicated.ok, true);
  assert.equal(dedicated.env.supabaseUrl, TWS_URL);
  assert.equal(dedicated.env.supabaseUrlSource, 'TWS_SUPABASE_URL');
  assert.equal(dedicated.env.serviceRoleKey, TWS_KEY);
  assert.equal(dedicated.env.serviceRoleKeySource, 'TWS_SUPABASE_SERVICE_ROLE_KEY');
  assert.notEqual(dedicated.env.supabaseUrl, legacy.SUPABASE_URL);
  assert.notEqual(dedicated.env.serviceRoleKey, legacy.SUPABASE_SERVICE_ROLE_KEY);

  // 2. Only TWS_SUPABASE_URL set: fails closed — the legacy key must NOT be
  //    mixed in, even though the legacy pair is complete.
  const urlOnly = loadEmailEnv({ ...legacy, TWS_SUPABASE_URL: TWS_URL });
  assert.equal(urlOnly.ok, false);
  assert.equal(urlOnly.reason, 'missing-tws-service-role-key');

  // 3. Only TWS_SUPABASE_SERVICE_ROLE_KEY set: fails closed — the legacy URL
  //    must NOT be mixed in.
  const keyOnly = loadEmailEnv({ ...legacy, TWS_SUPABASE_SERVICE_ROLE_KEY: TWS_KEY });
  assert.equal(keyOnly.ok, false);
  assert.equal(keyOnly.reason, 'missing-tws-supabase-url');

  // 4. Neither TWS variable set: the legacy fallback is fully functional and
  //    reports its sources (explicit URL, then the VITE_ fallback).
  const legacyEnv = loadEmailEnv(legacy);
  assert.equal(legacyEnv.ok, true);
  assert.equal(legacyEnv.env.supabaseUrl, legacy.SUPABASE_URL);
  assert.equal(legacyEnv.env.supabaseUrlSource, 'SUPABASE_URL');
  assert.equal(legacyEnv.env.serviceRoleKey, legacy.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(legacyEnv.env.serviceRoleKeySource, 'SUPABASE_SERVICE_ROLE_KEY');
  const viteFallback = loadEmailEnv({
    ...legacy,
    SUPABASE_URL: undefined,
    VITE_SUPABASE_URL: legacy.SUPABASE_URL,
  });
  assert.equal(viteFallback.ok, true);
  assert.equal(viteFallback.env.supabaseUrlSource, 'VITE_SUPABASE_URL');
  assert.equal(viteFallback.env.serviceRoleKeySource, 'SUPABASE_SERVICE_ROLE_KEY');

  // Empty / whitespace-only values count as unconfigured (they are trimmed):
  // a blank pair falls back to legacy, a half-set dedicated pair still fails.
  const blankPair = loadEmailEnv({
    ...legacy,
    TWS_SUPABASE_URL: '   ',
    TWS_SUPABASE_SERVICE_ROLE_KEY: '',
  });
  assert.equal(blankPair.ok, true);
  assert.equal(blankPair.env.supabaseUrlSource, 'SUPABASE_URL');
  const whitespaceKey = loadEmailEnv({
    ...legacy,
    TWS_SUPABASE_URL: TWS_URL,
    TWS_SUPABASE_SERVICE_ROLE_KEY: '   ',
  });
  assert.equal(whitespaceKey.ok, false);
  assert.equal(whitespaceKey.reason, 'missing-tws-service-role-key');

  // 5. A syntactically invalid dedicated URL fails closed with the same reason
  //    code the health endpoint reports — and never a successful match.
  const badUrl = loadEmailEnv({
    ...legacy,
    TWS_SUPABASE_URL: 'not-a-url',
    TWS_SUPABASE_SERVICE_ROLE_KEY: TWS_KEY,
  });
  assert.equal(badUrl.ok, false);
  assert.equal(badUrl.reason, 'invalid-supabase-url');

  // The shared resolver (used by the /api/email-health probe) must agree with
  // loadEmailEnv for every configuration: same pair, same sources, or the same
  // failure reason. This is what keeps the endpoints and diagnostics in sync.
  const cases = [
    legacy,
    { ...legacy, TWS_SUPABASE_URL: TWS_URL, TWS_SUPABASE_SERVICE_ROLE_KEY: TWS_KEY },
    { ...legacy, TWS_SUPABASE_URL: TWS_URL },
    { ...legacy, TWS_SUPABASE_SERVICE_ROLE_KEY: TWS_KEY },
    { ...legacy, TWS_SUPABASE_URL: 'not-a-url', TWS_SUPABASE_SERVICE_ROLE_KEY: TWS_KEY },
  ];
  for (const source of cases) {
    const resolved = resolveSupabaseConfig(source);
    const full = loadEmailEnv(source);
    if (resolved.ok) {
      assert.equal(full.ok, true);
      assert.equal(resolved.supabaseUrl, full.env.supabaseUrl);
      assert.equal(resolved.supabaseUrlSource, full.env.supabaseUrlSource);
      assert.equal(resolved.serviceRoleKey, full.env.serviceRoleKey);
      assert.equal(resolved.serviceRoleKeySource, full.env.serviceRoleKeySource);
    } else {
      assert.equal(full.ok, false);
      assert.equal(resolved.reason, full.reason);
    }
  }
});

test('client IP: only Vercel-trusted headers, validated, everything else is unknown', async () => {
  const { resolveClientIp } = await load('/api/_lib/client-ip.ts');

  assert.deepEqual(
    resolveClientIp({ 'x-vercel-forwarded-for': '203.0.113.10' }, '1'),
    { ip: '203.0.113.10', source: 'x-vercel-forwarded-for', trusted: true }
  );
  // falls back to the documented Vercel headers
  assert.equal(resolveClientIp({ 'x-forwarded-for': '198.51.100.4' }, '1').ip, '198.51.100.4');
  assert.equal(resolveClientIp({ 'x-real-ip': '192.0.2.99' }, '1').ip, '192.0.2.99');
  // prefers x-vercel-forwarded-for over x-forwarded-for
  assert.equal(
    resolveClientIp(
      { 'x-vercel-forwarded-for': '203.0.113.1', 'x-forwarded-for': '198.51.100.2' },
      '1'
    ).ip,
    '203.0.113.1'
  );
  // never trusts arbitrary forwarding headers
  assert.equal(
    resolveClientIp({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': undefined }, '1').ip,
    'unknown'
  );
  // cf-connecting-ip alongside a valid x-vercel-forwarded-for is still safe
  assert.equal(
    resolveClientIp(
      { 'cf-connecting-ip': '1.2.3.4', 'x-vercel-forwarded-for': '203.0.113.5' },
      '1'
    ).ip,
    '203.0.113.5'
  );
  // invalid header values fall through
  assert.equal(
    resolveClientIp({ 'x-vercel-forwarded-for': 'not-an-ip' }, '1').ip,
    'unknown'
  );
  assert.equal(
    resolveClientIp({ 'x-vercel-forwarded-for': '203.0.113.5, 198.51.100.1' }, '1').ip,
    '203.0.113.5'
  );
  // outside Vercel: nothing trusted, fixed unknown bucket
  assert.deepEqual(
    resolveClientIp({ 'x-vercel-forwarded-for': '203.0.113.10' }, '0'),
    { ip: 'unknown', source: 'unknown', trusted: false }
  );
  assert.equal(resolveClientIp({ 'cf-connecting-ip': '1.2.3.4' }, '').ip, 'unknown');
});

test('handler: method/content-type/body gates', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');

  let res = fakeRes();
  await handleOrderNotificationRequest(makeDeps(), fakeReq({}, { method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers['allow'], 'POST');

  res = fakeRes();
  await handleOrderNotificationRequest(makeDeps(), fakeReq({}, { headers: { 'content-type': 'text/html' } }), res);
  assert.equal(res.statusCode, 415);

  res = fakeRes();
  const hugeBody = JSON.stringify({ order_id: ORDER_ID, padding: 'x'.repeat(20 * 1024) });
  await handleOrderNotificationRequest(makeDeps(), fakeReq(hugeBody), res);
  assert.equal(res.statusCode, 413);

  res = fakeRes();
  await handleOrderNotificationRequest(makeDeps(), fakeReq('not-json'), res);
  assert.equal(res.statusCode, 400);

  res = fakeRes();
  await handleOrderNotificationRequest(makeDeps(), fakeReq({ order_id: ORDER_ID, customer_email: 'x@y.z' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'unexpected-field');

  res = fakeRes();
  await handleOrderNotificationRequest(makeDeps(), fakeReq({ order_id: 'not-a-uuid' }), res);
  assert.equal(res.statusCode, 422);

  res = fakeRes();
  await handleOrderNotificationRequest(makeDeps(), fakeReq({ order_id: ORDER_ID }), res);
  // the one valid request reaches the pipeline (see below) and succeeds
  assert.equal(res.statusCode, 200);
});

test('handler: misconfigured env refuses to send (fail-closed)', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');
  let res = fakeRes();
  const deps = makeDeps({
    loadEnv: async () => ({ ok: false, reason: 'missing-resend-api-key' }),
  });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.json().error, 'not-configured');
  assert.equal(deps.calls.rateLimit.length, 0, 'rate limiter is never consulted');
  assert.equal(deps.calls.claim.length, 0);
});

test('handler: rate limiting — 429 under the limit, 503 when the service fails', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');

  let res = fakeRes();
  const deps = makeDeps({
    rateLimit: async (key) => {
      if (key.includes(':order:')) return { allowed: false, retryAfterSeconds: 42 };
      return { allowed: true, retryAfterSeconds: 42 };
    },
  });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.json().error, 'rate-limited');
  assert.equal(res.headers['retry-after'], '42');
  assert.equal(deps.calls.claim.length, 0, 'a rate-limited request never claims');

  res = fakeRes();
  const deps503 = makeDeps({ rateLimit: async () => null });
  await handleOrderNotificationRequest(deps503, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error, 'rate-limit-unavailable');
  assert.equal(deps503.calls.claim.length, 0, 'a rate-limit failure never reaches the claim');
});

test('handler: atomic rate-limit keys are scoped per resource', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');
  const deps = makeDeps();
  const res = fakeRes();
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(deps.calls.rateLimit.length, 2);
  const keys = deps.calls.rateLimit.map((c) => c.key);
  assert.deepEqual(keys, [`email:order-confirmation:ip:203.0.113.7`, `email:order-confirmation:order:${ORDER_ID}`]);
  const limits = deps.calls.rateLimit.map((c) => c.limit);
  assert.deepEqual(limits, [DEFAULT_ENV.ipLimit, DEFAULT_ENV.orderLimit]);
});

test('handler: claim — new, reclaimed, in_flight, already_sent, failed', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');

  // new claim with claim-token record → send + conditional outcome
  let res = fakeRes();
  let deps = makeDeps();
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { sent: true });
  assert.equal(deps.calls.recordOutcome.length, 1);
  assert.equal(deps.calls.recordOutcome[0].status, 'sent');
  assert.equal(deps.calls.recordOutcome[0].claimToken, 'claim-token-uuid');
  assert.equal(deps.calls.recordOutcome[0].opts.resendId, 'resend-should-be-recorded');

  // in_flight → honest pending, no send, no claim record
  res = fakeRes();
  deps = makeDeps({
    claim: async () => ({
      outcome: 'in_flight', claimToken: null, idempotencyKey: `order-confirmation/${ORDER_ID}`,
      status: 'claimed', claimExpiresAt: new Date(Date.now() + 90_000).toISOString(), lastError: null,
    }),
  });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.json().pending, true);
  assert.equal(deps.calls.send.length, 0);

  // already_sent → idempotent replay, no send
  res = fakeRes();
  deps = makeDeps({
    claim: async () => ({
      outcome: 'already_sent', claimToken: null, idempotencyKey: `order-confirmation/${ORDER_ID}`,
      status: 'sent', claimExpiresAt: new Date(Date.now() - 60_000).toISOString(), lastError: null,
    }),
  });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().already_sent, true);
  assert.equal(deps.calls.send.length, 0);

  // failed (terminal) → 422, no send
  res = fakeRes();
  deps = makeDeps({
    claim: async () => ({
      outcome: 'failed', claimToken: null, idempotencyKey: `order-confirmation/${ORDER_ID}`,
      status: 'failed', claimExpiresAt: new Date(Date.now() - 60_000).toISOString(), lastError: 'bad recipient',
    }),
  });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.json().error, 'notification-failed');
  assert.equal(deps.calls.send.length, 0);

  // claim infrastructure failure → 503 fail-closed
  res = fakeRes();
  deps = makeDeps({ claim: async () => null });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error, 'claim-unavailable');
  assert.equal(deps.calls.send.length, 0);
});

test('handler: order load — 404 for missing order, 500 on lookup failure', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');

  let res = fakeRes();
  const deps404 = makeDeps({ loadOrder: async () => null });
  await handleOrderNotificationRequest(deps404, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error, 'order-not-found');
  assert.equal(deps404.calls.send.length, 0);
  // H1: the order is validated before any claim — a missing order must never
  // create a notification row or invoke the claim RPC.
  assert.equal(deps404.calls.claim.length, 0, 'no claim before the order is validated');

  res = fakeRes();
  const deps500 = makeDeps({ loadOrder: async () => { throw new Error('db down'); } });
  await handleOrderNotificationRequest(deps500, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(deps500.calls.send.length, 0);
  assert.equal(deps500.calls.claim.length, 0, 'a lookup failure must never claim');
});

test('handler: invalid idempotency key from the claim row is refused (fail-closed)', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');
  const deps = makeDeps({
    claim: async () => ({
      outcome: 'new', claimToken: 'claim-token-uuid', idempotencyKey: 'not-the-right-key',
      status: 'claimed', claimExpiresAt: new Date(Date.now() + 120_000).toISOString(), lastError: null,
    }),
  });
  const res = fakeRes();
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.json().error, 'idempotency-key-invalid');
  assert.equal(deps.calls.send.length, 0, 'no email leaves with a bad key');
});

test('handler: terminal / transient outcomes record conditional failures', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');

  // terminal → record 'failed', respond 422
  let res = fakeRes();
  let deps = makeDeps({
    sendEmail: async (args) => {
      deps.calls.send.push({ args });
      return { kind: 'terminal', error: 'recipient rejected' };
    },
  });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.json().error, 'delivery-failed');
  assert.equal(deps.calls.recordOutcome[0].status, 'failed');
  assert.equal(deps.calls.recordOutcome[0].opts.error, 'recipient rejected');
  assert.equal(deps.calls.recordOutcome[0].claimToken, 'claim-token-uuid');

  // transient → keep claim, record error, respond 503
  res = fakeRes();
  deps = makeDeps({
    sendEmail: async (args) => {
      deps.calls.send.push({ args });
      return { kind: 'transient', error: 'network timeout' };
    },
  });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error, 'delivery-unavailable');
  assert.equal(deps.calls.recordOutcome[0].status, 'claimed');
  assert.equal(deps.calls.recordOutcome[0].opts.error, 'network timeout');
});

test('handler: sends with the exact deterministic idempotency key', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');
  const deps = makeDeps();
  const res = fakeRes();
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(deps.calls.send[0].args.idempotencyKey, `order-confirmation/${ORDER_ID}`);
  assert.equal(deps.calls.send[0].args.to, 'buyer@example.test');
  assert.equal(deps.calls.send[0].args.from, DEFAULT_ENV.resendFrom);
});

test('production wiring: recipients come from server data, never from the body', async () => {
  const { createProductionDeps } = await load('/api/_lib/production.ts');
  const order = fakeOrder();

  // customer path: recipient = server-side order row
  const customerDeps = createProductionDeps('order-confirmation');
  const customerEmail = customerDeps.buildEmail(order, DEFAULT_ENV);
  assert.equal(customerEmail.error, undefined);
  assert.equal(customerEmail.to, 'buyer@example.test');
  assert.equal(customerEmail.from, DEFAULT_ENV.resendFrom);

  // admin path: recipient = server-configured studio inbox only
  const adminDeps = createProductionDeps('admin-new-order');
  const adminEmail = adminDeps.buildEmail(order, DEFAULT_ENV);
  assert.equal(adminEmail.error, undefined);
  assert.equal(adminEmail.to, DEFAULT_ENV.adminNotificationEmail);
  assert.notEqual(adminEmail.to, order.customer_email);

  // admin path without a configured inbox fails closed
  const missingInbox = adminDeps.buildEmail(order, { ...DEFAULT_ENV, adminNotificationEmail: null });
  assert.deepEqual(missingInbox, { error: 'missing-admin-inbox' });
});

test('email builders include the complete committed-order facts without overstating status', async () => {
  const { buildCustomerConfirmationEmailHtml, buildAdminNewOrderEmailHtml } = await load('/api/_lib/emails.ts');
  const order = fakeOrder();

  const customer = buildCustomerConfirmationEmailHtml(order);
  assert.equal(customer.subject, `Order confirmation — ${order.order_reference}`);
  assert.match(customer.html, /Order received/);
  assert.match(customer.html, /has been received/);
  assert.doesNotMatch(customer.html, /accepted|shipped/i);
  for (const fact of [
    order.order_reference,
    order.items[0].product_name,
    String(order.items[0].quantity),
    'EGP 2,450.00',
    order.city,
    order.governorate,
  ]) assert.ok(customer.html.includes(fact), `customer email includes ${fact}`);

  const admin = buildAdminNewOrderEmailHtml(order);
  for (const fact of [
    order.order_reference,
    order.customer_name,
    order.customer_email,
    order.customer_phone,
    order.delivery_address,
    order.items[0].product_name,
    String(order.items[0].quantity),
    'Unit price',
    'EGP 2,450.00',
    'Subtotal',
    'Shipping',
    'Total',
    'Status: pending',
    'Sat, 21 Nov 2026 12:00:00 GMT',
  ]) assert.ok(admin.html.includes(fact), `admin email includes ${fact}`);
});

test('email builders escape interpolated data (XSS-safety)', async () => {
  const { buildCustomerConfirmationEmailHtml, buildAdminNewOrderEmailHtml } = await load('/api/_lib/emails.ts');
  const payload = '<script>alert(1)</script>';
  const order = fakeOrder({
    customer_name: payload,
    order_notes: '<img src=x onerror=alert(1)>',
    city: payload,
    delivery_address: payload,
  });
  const customer = buildCustomerConfirmationEmailHtml(order);
  assert.ok(!customer.html.includes('<script>alert(1)</script>'));
  assert.ok(customer.html.includes('&lt;script&gt;'));
  assert.ok(!customer.subject.includes('<script>'));

  const admin = buildAdminNewOrderEmailHtml(order);
  assert.ok(!admin.html.includes(payload));
  assert.ok(admin.html.includes('&lt;script&gt;'));
  assert.ok(!admin.html.includes('<img src=x'));

  // recipients/sender must never leak into the customer/admin HTML
  assert.notEqual(customer.subject, admin.subject);
});

test('resend sender: SDK passes the Idempotency-Key header; errors classify correctly', async () => {
  const { createResendTransport, classifyResendOutcome } = await load('/api/_lib/resendSend.ts');

  // real transport wiring, mocked network: assert the Idempotency-Key header on the wire
  const captured = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    captured.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 'resend-real-request' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const transport = createResendTransport('re_test_key');
    const result = await transport.send(
      {
        from: 'Three Ways Studios <orders@test-project.supabase.co>',
        to: 'buyer@example.test',
        subject: 'Order confirmed',
        html: '<p>ok</p>',
      },
      { idempotencyKey: `order-confirmation/${ORDER_ID}` }
    );
    assert.equal(result.error, null);
    assert.deepEqual(result.data, { id: 'resend-real-request' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(captured.length, 1);
  assert.ok(captured[0].url.includes('api.resend.com/emails'));
  const headers = new Headers(captured[0].init.headers);
  assert.equal(headers.get('idempotency-key'), `order-confirmation/${ORDER_ID}`);
  assert.equal(headers.get('authorization'), 'Bearer re_test_key');

  // classification: sent
  assert.deepEqual(classifyResendOutcome({ data: { id: 'x' }, error: null }), { kind: 'sent', resendId: 'x' });
  // classification: no error payload and no id — transient, unknown outcome
  assert.deepEqual(classifyResendOutcome({ data: null, error: null }), {
    kind: 'transient', error: 'resend-returned-no-id', reason: 'unknown-outcome',
  });
  // classification: network failure — transient, network
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'application_error', statusCode: null, message: 'fetch failed' } }), {
    kind: 'transient', error: 'fetch failed', reason: 'network',
  });
  // classification: 429 rate limit — transient, rate-limited (not a permanent lock)
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'slow down' } }), {
    kind: 'transient', error: 'slow down', reason: 'rate-limited',
  });
  // classification: 5xx — transient, server-error
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'internal_server_error', statusCode: 500, message: 'server error' } }), {
    kind: 'transient', error: 'server error', reason: 'server-error',
  });
  // classification: 409 concurrent_idempotent_requests — transient (in-flight,
  // safe to retry; never locks the notification)
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'concurrent_idempotent_requests', statusCode: 409, message: 'a matching request is in flight' } }), {
    kind: 'transient', error: 'a matching request is in flight', reason: 'concurrent-conflict',
  });
  // classification: 409 invalid_idempotent_request — terminal (same key,
  // different payload; retrying cannot fix it)
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'invalid_idempotent_request', statusCode: 409, message: 'different payload for the same idempotency key' } }), {
    kind: 'terminal', error: 'different payload for the same idempotency key', reason: 'payload-conflict',
  });
  // classification: unrecognized 409 — conservative transient (in-flight-ish,
  // never a permanent lock; retry is bounded by the lease)
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'something_unexpected', statusCode: 409, message: 'mysterious conflict' } }), {
    kind: 'transient', error: 'mysterious conflict', reason: 'concurrent-conflict',
  });
  assert.deepEqual(classifyResendOutcome({ data: null, error: { statusCode: 409, message: 'no name given' } }), {
    kind: 'transient', error: 'no name given', reason: 'concurrent-conflict',
  });
  // other permanent 4xx — terminal, validation
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'validation_error', statusCode: 400, message: 'bad' } }), {
    kind: 'terminal', error: 'bad', reason: 'validation',
  });
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'not_found', statusCode: 422, message: 'domain not found' } }), {
    kind: 'terminal', error: 'domain not found', reason: 'validation',
  });
  assert.deepEqual(classifyResendOutcome({ data: null, error: { name: 'invalid_idempotency_key', statusCode: 400, message: 'key too long' } }), {
    kind: 'terminal', error: 'key too long', reason: 'validation',
  });
});

test('frontend wiring: fire-and-forget calls, safe ordering, swallows failures', async () => {
  const { announceOrderEmails, announceOrderConfirmationEmail } = await load('/src/lib/emailNotifications.ts');

  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response('{}', { status: 200 });
  };
  try {
    await announceOrderEmails(ORDER_ID);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(calls.map((c) => c.url).sort(), ['/api/admin-new-order', '/api/order-confirmation']);
  for (const { init } of calls) {
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), { order_id: ORDER_ID });
  }

  calls.length = 0;
  const realFetch2 = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 500 });
  };
  try {
    await announceOrderConfirmationEmail(ORDER_ID);
    await announceOrderConfirmationEmail(ORDER_ID); // idempotent from the browser's perspective
  } finally {
    globalThis.fetch = realFetch2;
  }
  assert.deepEqual(calls.map((c) => c.url).sort(), ['/api/order-confirmation', '/api/order-confirmation']);

  // invalid id is a no-op
  calls.length = 0;
  const realFetch3 = globalThis.fetch;
  globalThis.fetch = async () => { calls.push(1); return new Response('{}'); };
  try {
    await announceOrderConfirmationEmail('not-a-uuid');
    await announceOrderEmails('');
  } finally {
    globalThis.fetch = realFetch3;
  }
  assert.equal(calls.length, 0);
});

test('handler: permanent 4xx records failed + 422; concurrent-409 records claimed + 503', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');

  // permanent 4xx → record 'failed', 422 (no retryable lock issued)
  const res = fakeRes();
  const deps = makeDeps({
    sendEmail: async (args) => {
      deps.calls.send.push({ args });
      return { kind: 'terminal', error: 'validation_error', reason: 'validation' };
    },
  });
  await handleOrderNotificationRequest(deps, fakeReq({ order_id: ORDER_ID }), res);
  assert.equal(res.statusCode, 422);
  assert.equal(deps.calls.recordOutcome[0].status, 'failed');

  // concurrent 409 → row stays claimable (transient), 503 delivery-unavailable
  const res2 = fakeRes();
  const deps2 = makeDeps({
    sendEmail: async (args) => {
      deps2.calls.send.push({ args });
      return { kind: 'transient', error: 'a matching request is in flight', reason: 'concurrent-conflict' };
    },
  });
  await handleOrderNotificationRequest(deps2, fakeReq({ order_id: ORDER_ID }), res2);
  assert.equal(res2.statusCode, 503);
  assert.equal(deps2.calls.recordOutcome[0].status, 'claimed', 'transient keeps the claim');
  assert.equal(deps2.calls.recordOutcome[0].opts.error, 'a matching request is in flight');
});

test('receipt page never triggers the admin endpoint', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const source = readFileSync(path.resolve('src/pages/OrderConfirmationPage.tsx'), 'utf8');

  assert.ok(
    !source.includes('admin-new-order'),
    'receipt page must not reference the admin-new-order endpoint'
  );
  assert.ok(
    !source.includes('announceOrderEmails'),
    'receipt page must not use the combined checkout trigger'
  );
  assert.ok(
    source.includes('announceOrderConfirmationEmail'),
    'receipt page retains the intended customer-email re-trigger'
  );
});
