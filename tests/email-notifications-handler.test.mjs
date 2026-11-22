/**
 * Handler integration tests — REAL handler pipeline + REAL PostgreSQL (PGlite).
 *
 * The production dependency shape is replicated here: the handler from
 * api/_lib/handler.ts is called with deps wired to the real SECURITY DEFINER
 * RPCs (rate_limit_check / claim_email_notification / record_email_outcome)
 * against the same embedded engine the other integration tests use, and the
 * real email builders + Resend transport. The only stub is the network layer
 * (globalThis.fetch). No claim, outcome or database behaviour is faked.
 *
 * These tests deliberately DO NOT use mocked claim results. Claim rows are
 * asserted directly against the database after each request.
 *
 * PGlite runs a single embedded engine. These tests prove the SQL is
 * structurally correct and that the real handler pipeline behaves correctly
 * against a real database; they do NOT prove multi-connection concurrency on
 * a live Supabase/PostgreSQL instance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { studioDb } from './studio-db.mjs';
import { createServer } from 'vite';

const ORDER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const CUSTOMER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const MISSING_ORDER_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

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

function fakeReq(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? null);
  return {
    method: 'POST',
    url: '/api/order-confirmation',
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() { yield Buffer.from(text); },
  };
}

async function makeOrder(db, orderId = ORDER_ID, name = 'Integration Buyer') {
  await db.query(
    `insert into customers(id, full_name, email, phone, governorate, city, address)
     values ($1, $2, 'integration@example.test', '01000000000', 'Cairo', 'Cairo', 'Test address')
     on conflict do nothing`,
    [CUSTOMER_ID, name]
  );
  await db.query(
    `insert into orders(id, order_reference, customer_id, customer_name, customer_email,
                        customer_phone, governorate, city, delivery_address, payment_method,
                        subtotal, shipping_cost, total_amount)
     values ($1, 'TWS-2026-IT001', $2, $3, 'integration@example.test',
             '01000000000', 'Cairo', 'Cairo', 'Test address', 'COD', 200, 75, 275)
     on conflict (id) do nothing`,
    [orderId, CUSTOMER_ID, name]
  );
  await db.query(
    `insert into order_items(order_id, product_name, product_slug, color_name, size_name,
                             unit_price, quantity, line_total)
     select $1, 'Integration Tee', 'integration-tee', 'Black', 'L', 100, 2, 200
     where not exists (select 1 from order_items where order_id = $1)`,
    [orderId]
  );
}

/**
 * Build a real production-shaped pipeline. `handleFetch` is the only stub:
 * it stands in for the network and returns whatever Resend would have
 * returned (or throws).
 */
async function realPipeline(db, handleFetch, notificationType = 'order-confirmation') {
  const { handleOrderNotificationRequest } = await load('/api/_lib/handler.ts');
  const { createResendTransport, classifyResendOutcome } = await load('/api/_lib/resendSend.ts');
  const { buildTestEnv } = await load('/api/_lib/env.ts');
  const { buildCustomerConfirmationEmailHtml, buildAdminNewOrderEmailHtml } = await load('/api/_lib/emails.ts');
  const { rateLimitCheck, claimEmailNotification, recordEmailOutcome } = await load('/api/_lib/claims.ts');
  const env = buildTestEnv({ claimLeaseSeconds: 120, ipLimit: 200, orderLimit: 200 });

  const rpc = async (fn, args) => {
    try {
      if (fn === 'rate_limit_check') {
        const { rows } = await db.query(
          'select public.rate_limit_check($1, $2, $3) as result',
          [args.p_key, args.p_limit, args.p_window_seconds]
        );
        return { data: rows[0]?.result ?? null, error: null };
      }
      if (fn === 'claim_email_notification') {
        const { rows } = await db.query(
          'select public.claim_email_notification($1, $2, $3) as result',
          [args.p_order_id, args.p_notification_type, args.p_lease_seconds]
        );
        return { data: rows[0]?.result ?? null, error: null };
      }
      if (fn === 'record_email_outcome') {
        const { rows } = await db.query(
          'select public.record_email_outcome($1, $2, $3, $4, $5, $6) as result',
          [args.p_order_id, args.p_notification_type, args.p_claim_token, args.p_status, args.p_resend_id, args.p_error]
        );
        return { data: rows[0]?.result ?? null, error: null };
      }
      return { data: null, error: { message: `unknown function: ${fn}` } };
    } catch (err) {
      return { data: null, error: { message: err?.message ?? String(err) } };
    }
  };

  const rpcCalls = [];
  const trackingRpc = (fn, args) => {
    rpcCalls.push({ fn, args });
    return rpc(fn, args);
  };

  // Minimal DB-row loader, structurally identical to the production loader.
  const loadOrder = async (orderId) => {
    const { rows } = await db.query('select * from orders where id = $1', [orderId]);
    if (!rows[0]) return null;
    const row = rows[0];
    const { rows: itemRows } = await db.query(
      'select * from order_items where order_id = $1',
      [orderId]
    );
    return {
      order_id: String(row.id ?? ''),
      order_reference: String(row.order_reference ?? ''),
      customer_name: String(row.customer_name ?? ''),
      customer_email: String(row.customer_email ?? ''),
      customer_phone: String(row.customer_phone ?? ''),
      governorate: String(row.governorate ?? ''),
      city: String(row.city ?? ''),
      delivery_address: String(row.delivery_address ?? ''),
      order_notes: String(row.order_notes ?? ''),
      payment_method: String(row.payment_method ?? 'COD'),
      subtotal: Number(row.subtotal) || 0,
      shipping_cost: Number(row.shipping_cost) || 0,
      email_discount_amount: Number(row.email_discount_amount) || 0,
      promo_discount_amount: Number(row.promo_discount_amount) || 0,
      discount_total: Number(row.discount_total) || 0,
      applied_promo_code: row.applied_promo_code ?? null,
      total_amount: Number(row.total_amount) || 0,
      status: String(row.status ?? 'pending'),
      created_at: String(row.created_at ?? ''),
      items: itemRows.map((item) => ({
        product_name: String(item.product_name ?? ''),
        color_name: String(item.color_name ?? ''),
        size_name: String(item.size_name ?? ''),
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        line_total: Number(item.line_total) || 0,
        product_image: item.product_image ?? null,
      })),
    };
  };

  const realFetch = globalThis.fetch;
  globalThis.fetch = handleFetch;

  const deps = {
    notificationType,
    loadEnv: async () => ({ ok: true, env }),
    resolveIp: () => ({ ip: '203.0.113.7', source: 'x-vercel-forwarded-for', trusted: true }),
    rateLimit: async (key, limit, windowSeconds) => rateLimitCheck(trackingRpc, key, limit, windowSeconds),
    claim: async (orderId, leaseSeconds) => claimEmailNotification(trackingRpc, orderId, notificationType, leaseSeconds),
    recordOutcome: async (orderId, status, opts, claimToken) =>
      recordEmailOutcome(trackingRpc, orderId, notificationType, claimToken, status, opts),
    loadOrder,
    buildEmail: (order, env2) => {
      const { subject, html } = notificationType === 'admin-new-order'
        ? buildAdminNewOrderEmailHtml(order)
        : buildCustomerConfirmationEmailHtml(order);
      const to = notificationType === 'admin-new-order'
        ? env2.adminNotificationEmail
        : order.customer_email;
      if (!to) return { error: 'missing-admin-inbox' };
      return { from: env2.resendFrom, to, subject, html };
    },
    sendEmail: async (args) => {
      const transport = createResendTransport(env.resendApiKey);
      const result = await transport.send(args, { idempotencyKey: args.idempotencyKey });
      return classifyResendOutcome(result);
    },
    now: () => new Date(),
  };

  return {
    handler: handleOrderNotificationRequest,
    deps,
    restore: () => { globalThis.fetch = realFetch; },
    rpcCalls,
  };
}

async function currentNotificationRow(db, orderId, type = 'order-confirmation') {
  const { rows } = await db.query(
    'select status, claim_token, resend_id, last_error from email_notifications where order_id = $1 and notification_type = $2',
    [orderId, type]
  );
  return rows[0] ?? null;
}

test('handler+db: missing order → 404, no claim row, no email', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  const { handler, deps, restore } = await realPipeline(db, async () => {
    throw new Error('fetch must not be called for a missing order');
  });
  const res = fakeRes();
  await handler(deps, fakeReq({ order_id: MISSING_ORDER_ID }), res);
  restore();

  assert.equal(res.statusCode, 404);
  assert.equal(res.json().error, 'order-not-found');
  assert.equal(await currentNotificationRow(db, MISSING_ORDER_ID), null, 'no claim row created');
});

test('handler+db: real order sent → row transitioned to sent with resend_id', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  let seenIdempotencyKey = null;
  const { handler, deps, restore } = await realPipeline(db, async (url, init) => {
    seenIdempotencyKey = new Headers(init.headers).get('idempotency-key');
    return new Response(JSON.stringify({ id: 'resend-email-id-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const res = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res);
  restore();

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { sent: true });
  assert.equal(seenIdempotencyKey, `order-confirmation/${ORDER_ID}`);

  const row = await currentNotificationRow(db, ORDER_ID);
  assert.equal(row.status, 'sent');
  assert.equal(row.resend_id, 'resend-email-id-1');
  assert.equal(row.last_error, null);
});

test('handler+db: committed pending order sends complete customer + admin payloads and records both outcomes', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  const captured = [];
  const mockResend = async (_url, init) => {
    captured.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `mock-resend-${captured.length}` }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const customerPipeline = await realPipeline(db, mockResend, 'order-confirmation');
  const customerRes = fakeRes();
  await customerPipeline.handler(customerPipeline.deps, fakeReq({ order_id: ORDER_ID }), customerRes);
  customerPipeline.restore();

  const adminPipeline = await realPipeline(db, mockResend, 'admin-new-order');
  const adminRes = fakeRes();
  await adminPipeline.handler(adminPipeline.deps, fakeReq({ order_id: ORDER_ID }), adminRes);
  adminPipeline.restore();

  assert.equal(customerRes.statusCode, 200);
  assert.equal(adminRes.statusCode, 200);
  assert.equal(captured.length, 2, 'one mocked provider call per notification type');

  const customer = captured.find((message) => message.to === 'integration@example.test');
  const admin = captured.find((message) => message.to === 'admin@test-project.supabase.co');
  assert.ok(customer, 'customer payload uses the committed order email');
  assert.ok(admin, 'admin payload uses the server-configured inbox');
  assert.match(customer.subject, /Order confirmation.*TWS-2026-IT001/);
  assert.match(customer.html, /has been received/);
  assert.match(customer.html, /Integration Tee/);
  assert.match(customer.html, /EGP 275\.00/);

  for (const fact of [
    'TWS-2026-IT001',
    'Integration Buyer',
    'integration@example.test',
    '01000000000',
    'Test address',
    'Integration Tee',
    'Unit price',
    'EGP 100.00',
    'EGP 200.00',
    'Shipping',
    'EGP 75.00',
    'EGP 275.00',
    'Status: pending',
  ]) assert.ok(admin.html.includes(fact), `admin payload includes ${fact}`);

  const { rows: notifications } = await db.query(
    `select notification_type, status, resend_id
       from email_notifications
      where order_id = $1
      order by notification_type`,
    [ORDER_ID]
  );
  assert.deepEqual(notifications, [
    { notification_type: 'admin-new-order', status: 'sent', resend_id: 'mock-resend-2' },
    { notification_type: 'order-confirmation', status: 'sent', resend_id: 'mock-resend-1' },
  ]);

  const order = (await db.query('select status from orders where id = $1', [ORDER_ID])).rows[0];
  assert.equal(order.status, 'pending', 'email handling does not accept or advance the order');
});

test('handler+db: 409 concurrent conflict → transient, claim preserved (503)', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  const { handler, deps, restore } = await realPipeline(db, async () => {
    return new Response(JSON.stringify({
      name: 'concurrent_idempotent_requests',
      statusCode: 409,
      message: 'A matching request is in flight',
    }), { status: 409, headers: { 'content-type': 'application/json' } });
  });

  const res = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res);
  restore();

  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error, 'delivery-unavailable');
  const row = await currentNotificationRow(db, ORDER_ID);
  assert.equal(row.status, 'claimed', 'row stays claimable on a concurrent conflict');
  assert.match(String(row.last_error ?? ''), /in flight/i);
  assert.equal(row.resend_id, null);
});

test('handler+db: 409 different payload → terminal, row failed (422)', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  const { handler, deps, restore } = await realPipeline(db, async () => {
    return new Response(JSON.stringify({
      name: 'invalid_idempotent_request',
      statusCode: 409,
      message: 'Same idempotency key used with a different payload',
    }), { status: 409, headers: { 'content-type': 'application/json' } });
  });

  const res = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res);
  restore();

  assert.equal(res.statusCode, 422);
  assert.equal(res.json().error, 'delivery-failed');
  const row = await currentNotificationRow(db, ORDER_ID);
  assert.equal(row.status, 'failed', 'payload conflict locks the notification irreversibly');
  assert.match(String(row.last_error ?? ''), /different payload/i);
});

test('handler+db: permanent 4xx → terminal, row failed (422)', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  const { handler, deps, restore } = await realPipeline(db, async () => {
    return new Response(JSON.stringify({
      name: 'validation_error', statusCode: 400, message: 'Recipient not configured',
    }), { status: 400, headers: { 'content-type': 'application/json' } });
  });

  const res = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res);
  restore();

  assert.equal(res.statusCode, 422);
  const row = await currentNotificationRow(db, ORDER_ID);
  assert.equal(row.status, 'failed');
  assert.equal(row.last_error, 'Recipient not configured');
});

test('handler+db: 5xx → transient, claim preserved; live-lease retry → 202 pending, no second send', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  let sends = 0;
  const { handler, deps, restore } = await realPipeline(db, async () => {
    sends += 1;
    return new Response(JSON.stringify({
      name: 'internal_server_error', statusCode: 500, message: 'Resend is down',
    }), { status: 500, headers: { 'content-type': 'application/json' } });
  });

  const res = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res);
  restore();
  assert.equal(res.statusCode, 503);
  assert.equal(sends, 1);

  const row = await currentNotificationRow(db, ORDER_ID);
  assert.equal(row.status, 'claimed');
  assert.equal(row.resend_id, null);
  assert.match(String(row.last_error ?? ''), /Resend is down/);

  // Retry while the lease is live: an honest 202 pending, no second send.
  const res2 = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res2);
  restore();
  assert.equal(res2.statusCode, 202);
  assert.equal(res2.json().pending, true);
  assert.equal(sends, 1, 'no duplicate send while the lease is live');
});

test('handler+db: already-sent → second request is an idempotent replay, no send', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  let sends = 0;
  const { handler, deps, restore } = await realPipeline(db, async () => {
    sends += 1;
    return new Response(JSON.stringify({ id: 'final-id' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const res = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res);
  restore();
  assert.equal(res.statusCode, 200);

  const res2 = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res2);
  restore();
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.json().already_sent, true);
  assert.equal(sends, 1, 'no duplicate send after a recorded success');
});

test('handler+db: terminal failed → later request replays the terminal failure', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  await makeOrder(db);

  let sends = 0;
  const { handler, deps, restore } = await realPipeline(db, async () => {
    sends += 1;
    return new Response(JSON.stringify({
      name: 'validation_error', statusCode: 400, message: 'bad sender',
    }), { status: 400, headers: { 'content-type': 'application/json' } });
  });

  const res = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res);
  restore();
  assert.equal(res.statusCode, 422);
  assert.equal(sends, 1);

  const res2 = fakeRes();
  await handler(deps, fakeReq({ order_id: ORDER_ID }), res2);
  restore();
  assert.equal(res2.statusCode, 422);
  assert.equal(res2.json().error, 'notification-failed');
  assert.equal(sends, 1, 'no resend after terminal failure');
});
