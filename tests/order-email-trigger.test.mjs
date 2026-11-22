/**
 * Regression tests for the production report:
 *   "orders are created and appear in the admin panel, but neither email is
 *    sent, and Vercel shows no invocation for either /api/* route."
 *
 * What these tests pin down (each one failed before the fix):
 *
 *  1. A committed COD order triggers BOTH email endpoints — even when the
 *     receipt the UI gets back is unusable. Previously the trigger sat behind
 *     `if (!order) return;` in the checkout component, so any receipt-level
 *     problem (or any later edit to that component) silently skipped the
 *     emails: order created, no email, no log, no invocation.
 *  2. An email failure can never invalidate an order that PostgreSQL already
 *     committed, and never produces an unhandled rejection.
 *  3. The trigger is instrumented: every attempt logs one compact, PII-free
 *     line, and an HTML answer from `/api/*` (the SPA fallback) is reported as
 *     `endpoint-not-reachable`, which is the exact signature of "no function
 *     invocation in the Vercel logs".
 *  4. The API entry points log their own invocation, status and outcome code,
 *     without customer data.
 *  5. `GET /api/email-health` answers JSON with booleans only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const ORDER_ID = '9f8e7d6c-5b4a-4321-8fed-cba987654321';
const ORDER_TAG = ORDER_ID.slice(0, 8);
const REFERENCE = 'TWS-2026-QA9F8E7D6C';

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

const load = (path) => vite.ssrLoadModule(path);

function receipt(overrides = {}) {
  return {
    order_id: ORDER_ID,
    order_reference: REFERENCE,
    customer_name: 'Fixture Buyer',
    customer_email: 'buyer@example.test',
    customer_phone: '01012345678',
    governorate: 'Cairo',
    city: 'Cairo',
    delivery_address: '12 Test Street',
    order_notes: '',
    payment_method: 'COD',
    subtotal: 2450,
    shipping_cost: 75,
    email_discount_amount: 0,
    promo_discount_amount: 0,
    discount_total: 0,
    applied_promo_code: null,
    total_amount: 2525,
    status: 'pending',
    created_at: '2026-11-21T12:00:00.000Z',
    items: [
      {
        product_name: 'TWS Signature Tee',
        product_slug: 'signature-tee',
        product_image: null,
        color_name: 'Black',
        size_name: 'L',
        unit_price: 2450,
        quantity: 1,
        line_total: 2450,
      },
    ],
    ...overrides,
  };
}

const PAYLOAD = { p_email: 'buyer@example.test' };

/** Runs `fn` while capturing console output, restoring the console afterwards. */
async function captureConsole(fn) {
  const lines = [];
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  for (const level of Object.keys(originals)) {
    console[level] = (...args) => {
      lines.push(args.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' '));
    };
  }
  try {
    const value = await fn();
    return { value, lines };
  } finally {
    Object.assign(console, originals);
  }
}

function stubFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

test('a committed order triggers both email endpoints, even when the receipt is unusable', async () => {
  const { commitCodOrder } = await load('/src/lib/codCommit.ts');
  const { announceOrderEmails } = await load('/src/lib/emailNotifications.ts');

  const fetchStub = stubFetch(async () => new Response('{"sent":true}', { status: 200 }));
  try {
    let pending;
    const announced = [];
    const result = await commitCodOrder(PAYLOAD, {
      rpc: async () => ({ data: receipt(), error: null }),
      announce: (orderId) => {
        announced.push(orderId);
        pending = announceOrderEmails(orderId);
        return pending;
      },
    });
    await pending;

    assert.deepEqual(announced, [ORDER_ID], 'the commit path announces exactly once');
    assert.equal(result.error, null);
    assert.equal(result.orderId, ORDER_ID);
    assert.equal(result.order?.order_reference, REFERENCE);
    // Both endpoints, exactly once each, with the smallest possible body.
    assert.deepEqual(
      fetchStub.calls.map((call) => call.url).sort(),
      ['/api/admin-new-order', '/api/order-confirmation']
    );
    for (const call of fetchStub.calls) {
      assert.equal(call.init.method, 'POST');
      assert.equal(call.init.headers['Content-Type'], 'application/json');
      assert.equal(call.init.keepalive, true, 'a page unload must not cancel the trigger');
      assert.deepEqual(JSON.parse(call.init.body), { order_id: ORDER_ID });
    }
  } finally {
    fetchStub.restore();
  }

  // The receipt guard is unchanged, but it can no longer skip the emails: the
  // order exists, so the notification attempt already happened.
  const announced = [];
  const brokenReceipt = await commitCodOrder(PAYLOAD, {
    rpc: async () => ({ data: { order_id: ORDER_ID, order_reference: null }, error: null }),
    announce: (orderId) => {
      announced.push(orderId);
    },
  });
  assert.deepEqual(announced, [ORDER_ID], 'the trigger does not depend on the receipt');
  assert.equal(brokenReceipt.order, null);
  assert.equal(brokenReceipt.orderId, ORDER_ID);
  assert.match(brokenReceipt.error ?? '', /did not return an order reference/);
});

test('an email failure never invalidates the committed order', async () => {
  const { commitCodOrder } = await load('/src/lib/codCommit.ts');

  // 1. the announcement rejects asynchronously
  const rejected = await commitCodOrder(PAYLOAD, {
    rpc: async () => ({ data: receipt(), error: null }),
    announce: async () => {
      throw new Error('network down');
    },
  });
  // let the swallowed rejection settle; an unhandled rejection would fail the run
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(rejected.error, null, 'the order stays valid when the email fails');
  assert.equal(rejected.order?.order_id, ORDER_ID);

  // 2. the announcement throws synchronously
  const thrown = await commitCodOrder(PAYLOAD, {
    rpc: async () => ({ data: receipt(), error: null }),
    announce: () => {
      throw new Error('boom');
    },
  });
  assert.equal(thrown.error, null);
  assert.equal(thrown.orderId, ORDER_ID);

  // 3. a broken trigger must also not break the returned receipt
  const withFetchFailure = await commitCodOrder(PAYLOAD, {
    rpc: async () => ({ data: receipt(), error: null }),
    announce: async () => {
      await Promise.reject(new Error('aborted'));
    },
  });
  assert.equal(withFetchFailure.order?.order_reference, REFERENCE);
});

test('a rejected write announces nothing and keeps the existing error contract', async () => {
  const { commitCodOrder } = await load('/src/lib/codCommit.ts');
  const announced = [];

  const promo = await commitCodOrder(PAYLOAD, {
    rpc: async () => ({ data: null, error: { code: 'P0001', message: 'Promo code is not valid.' } }),
    announce: (id) => announced.push(id),
  });
  assert.equal(promo.order, null);
  assert.equal(promo.orderId, null);
  assert.equal(promo.error, 'Promo code is not valid.');
  assert.equal(promo.refreshQuote, true, 'rejected transactions ask for a fresh quote');
  assert.deepEqual(announced, [], 'no order was created, so nothing is announced');

  const duplicate = await commitCodOrder(PAYLOAD, {
    rpc: async () => ({ data: null, error: { code: 'XX000', message: 'boom' } }),
    announce: (id) => announced.push(id),
  });
  assert.equal(duplicate.refreshQuote, false);

  const missingFunction = await commitCodOrder(PAYLOAD, {
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'missing rpc' } }),
    announce: (id) => announced.push(id),
  });
  assert.match(missingFunction.error ?? '', /temporarily unavailable/);

  const thrown = await commitCodOrder(PAYLOAD, {
    rpc: async () => {
      throw new Error('Failed to fetch');
    },
    announce: (id) => announced.push(id),
  });
  assert.equal(thrown.error, 'Failed to fetch');
  assert.equal(thrown.refreshQuote, undefined);
  assert.deepEqual(announced, []);
});

test('an order id that is not a UUID is never sent to the endpoints', async () => {
  const { commitCodOrder, orderIdFromRpcResult } = await load('/src/lib/codCommit.ts');
  assert.equal(orderIdFromRpcResult({ order_id: 'not-a-uuid' }), null);
  assert.equal(orderIdFromRpcResult(null), null);
  assert.equal(orderIdFromRpcResult({}), null);
  assert.equal(orderIdFromRpcResult({ order_id: ORDER_ID }), ORDER_ID);

  const announced = [];
  const result = await commitCodOrder(PAYLOAD, {
    rpc: async () => ({ data: { order_id: 'nope' }, error: null }),
    announce: (id) => announced.push(id),
  });
  assert.deepEqual(announced, []);
  assert.equal(result.orderId, null);
  assert.match(result.error ?? '', /did not return an order reference/);
});

test('the trigger logs a PII-free diagnostic and reports an SPA-fallback answer', async () => {
  const { announceOrderEmails } = await load('/src/lib/emailNotifications.ts');

  // html: the SPA fallback answered /api/* — no function ran, no email possible
  const html = stubFetch(
    async () => new Response('<!doctype html><title>Three Ways Studios</title>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  );
  try {
    const { lines } = await captureConsole(() => announceOrderEmails(ORDER_ID));
    const text = lines.join('\n');
    assert.match(text, /\[tws:email\] trigger/, 'the attempt is visible in the console');
    assert.match(text, /endpoint-not-reachable/);
    assert.match(text, /html-response/);
    assert.match(text, /\/api\/order-confirmation/);
    assert.match(text, new RegExp(ORDER_TAG), 'the correlation tag is logged');
    assert.equal(html.calls.length, 2, 'both endpoints are attempted');
    assert.ok(!text.includes(ORDER_ID), 'the full order id is never logged');
  } finally {
    html.restore();
  }

  // 4xx/5xx: logged, not retried (the server owns the retry contract)
  const rejected = stubFetch(async () => new Response('{"error":"rate-limited"}', { status: 429 }));
  try {
    const { lines } = await captureConsole(() => announceOrderEmails(ORDER_ID));
    assert.match(lines.join('\n'), /request-rejected/);
    assert.equal(rejected.calls.length, 2, 'HTTP errors are not retried');
  } finally {
    rejected.restore();
  }

  // success
  const ok = stubFetch(async () => new Response('{"sent":true}', { status: 200 }));
  try {
    const { lines } = await captureConsole(() => announceOrderEmails(ORDER_ID));
    assert.match(lines.join('\n'), /request-accepted/);
    assert.equal(ok.calls.length, 2);
  } finally {
    ok.restore();
  }

  // transport failure: retried exactly once per endpoint, then reported
  const offline = stubFetch(async () => {
    throw new TypeError('Failed to fetch');
  });
  try {
    const { lines } = await captureConsole(() => announceOrderEmails(ORDER_ID));
    const failures = lines.filter((line) => line.includes('request-failed'));
    assert.equal(failures.length, 4, 'two endpoints x (attempt + one retry)');
    assert.match(failures[0], /network/);
    assert.equal(offline.calls.length, 4);
  } finally {
    offline.restore();
  }
});

test('the production ordering is wired in api.ts, not in a UI component', async () => {
  const apiSource = await readFile('src/lib/api.ts', 'utf8');
  const checkoutSource = await readFile('src/pages/CheckoutPage.tsx', 'utf8');

  assert.match(
    apiSource,
    /return commitCodOrder\(payload, \{/,
    'createCodOrder must commit through the shared, instrumented path'
  );
  assert.match(
    apiSource,
    /announce: announceOrderEmails/,
    'the production commit path must wire the real both-endpoint trigger'
  );
  assert.equal(
    checkoutSource.includes('announceOrderEmails'),
    false,
    'the checkout page must not own the trigger: that is how it was silently skipped'
  );
  assert.match(checkoutSource, /order-confirmed/, 'checkout keeps a UI-level diagnostic line');
});

test('the API entry points log the invocation and the outcome, without customer data', async () => {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');

  const env = {
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
  const res = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    writeHead(statusCode, extra = {}) {
      this.statusCode = statusCode;
      Object.assign(this.headers, extra);
    },
    end(body) {
      this.body = body ?? null;
    },
  };
  const req = {
    method: 'POST',
    url: '/api/order-confirmation',
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify({ order_id: ORDER_ID }));
    },
  };
  const deps = {
    notificationType: 'order-confirmation',
    loadEnv: async () => ({ ok: true, env }),
    resolveIp: () => ({ ip: '203.0.113.7', source: 'x-vercel-forwarded-for', trusted: true }),
    rateLimit: async () => ({ allowed: true, retryAfterSeconds: 60 }),
    claim: async () => ({
      outcome: 'new',
      claimToken: 'claim-token-uuid',
      idempotencyKey: `order-confirmation/${ORDER_ID}`,
      status: 'claimed',
      claimExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      lastError: null,
    }),
    recordOutcome: async () => true,
    loadOrder: async () => receipt(),
    buildEmail: (order) => ({
      from: env.resendFrom,
      to: order.customer_email,
      subject: 'Order confirmed',
      html: '<p>ok</p>',
    }),
    sendEmail: async () => ({ kind: 'sent', resendId: 're_123' }),
  };

  const { lines } = await captureConsole(() => handleOrderNotificationRequest(deps, req, res));
  const events = lines
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.scope === 'tws-email-api');

  const start = events.find((entry) => entry.event === 'request-start');
  const accepted = events.find((entry) => entry.event === 'order-accepted');
  const complete = events.find((entry) => entry.event === 'request-complete');
  assert.ok(start, 'every invocation logs a start event');
  assert.equal(start.endpoint, 'order-confirmation');
  assert.equal(start.method, 'POST');
  assert.ok(accepted, 'the validated order is logged with a correlation tag');
  assert.equal(accepted.orderTag, ORDER_TAG);
  assert.ok(complete, 'every invocation logs a completion event');
  assert.equal(complete.status, 200);
  assert.equal(complete.outcome, 'ok');
  assert.equal(typeof complete.ms, 'number');

  const text = lines.join('\n');
  for (const secret of [
    'buyer@example.test',
    '01012345678',
    'Fixture Buyer',
    '12 Test Street',
    REFERENCE,
    ORDER_ID,
    're_test_key_1234567890abcdef',
    'test-service-role-key',
  ]) {
    assert.equal(text.includes(secret), false, `diagnostics must not log ${secret}`);
  }

  // refusals are logged with their machine-readable reason
  const refusal = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader() {},
    getHeader() {},
    writeHead(statusCode) {
      this.statusCode = statusCode;
    },
    end(body) {
      this.body = body ?? null;
    },
  };
  const { lines: refusalLines } = await captureConsole(() =>
    handleOrderNotificationRequest({ ...deps, loadOrder: async () => null }, req, refusal)
  );
  const refusalEvents = refusalLines
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.scope === 'tws-email-api');
  const refusalComplete = refusalEvents.find((entry) => entry.event === 'request-complete');
  assert.equal(refusalComplete.status, 404);
  assert.equal(refusalComplete.outcome, 'order-not-found');
});

test('GET /api/email-health answers JSON diagnostics and never a secret', async () => {
  const { default: health } = await load('/api/email-health.ts');

  function fakeRes() {
    return {
      headers: {},
      statusCode: null,
      body: null,
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return this.headers[name.toLowerCase()];
      },
      writeHead(statusCode, extra = {}) {
        this.statusCode = statusCode;
        Object.assign(this.headers, extra);
      },
      end(body) {
        this.body = body ?? null;
      },
    };
  }

  const res = fakeRes();
  await captureConsole(() => health({ method: 'GET', headers: {} }, res));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.routed_to_function, true, 'JSON here proves /api/* reaches a function');
  assert.equal(typeof body.vercel, 'boolean');
  assert.equal(typeof body.commit, 'string');
  assert.equal(typeof body.env.configured, 'boolean');
  if (body.env.configured === false) assert.equal(typeof body.env.reason, 'string');
  assert.deepEqual(body.endpoints, ['/api/order-confirmation', '/api/admin-new-order']);
  for (const secret of ['re_', 'service_role', '@', 'eyJ']) {
    assert.equal(res.body.includes(secret), false, `diagnostics body must not contain ${secret}`);
  }

  const post = fakeRes();
  await captureConsole(() => health({ method: 'POST', headers: {} }, post));
  assert.equal(post.statusCode, 405);
  assert.equal(JSON.parse(post.body).error, 'method-not-allowed');
});
