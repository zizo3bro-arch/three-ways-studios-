/**
 * Migration 014 integration tests — REAL PostgreSQL via PGlite.
 *
 * These tests exercise the actual SQL: tables, constraints, RLS/grants and
 * SECURITY DEFINER functions. Nothing here is mocked; the only fakes are the
 * "client" role contexts (anon / service_role) created by the harness.
 *
 * NOTE on concurrency: PGlite runs a single embedded engine. Concurrent
 * driver calls are issued from two directions in parallel and the atomic
 * ON CONFLICT path still computes the exact count — this proves the SQL is
 * structurally correct and that parallel calls can never exceed the limit.
 * It does NOT prove behavior across multiple simultaneous connections to a
 * live database; that is an inherent limitation of the harness (see the
 * final report).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { studioDb, anon, rpc } from './studio-db.mjs';

const ORDER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CUSTOMER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const UUID_NAMESPACE = '11111111-1111-1111-1111-111111111111';

async function makeOrder(db) {
  await db.query(
    `insert into customers(id, full_name, email, phone, governorate, city, address)
     values ($1, 'Fixture Buyer', 'fixture-buyer@example.test', '01012345678', 'Cairo', 'Cairo', 'Test address')
     on conflict do nothing`,
    [CUSTOMER_ID]
  );
  await db.query(
    `insert into orders(id, order_reference, customer_id, customer_name, customer_email, customer_phone,
                        governorate, city, delivery_address, payment_method, subtotal, total_amount)
     values ($1, 'TWS-2026-PROBE0001', $2, 'Fixture Buyer', 'fixture-buyer@example.test', '01012345678',
             'Cairo', 'Cairo', 'Test address', 'COD', 100, 100)
     on conflict (id) do nothing`,
    [ORDER_ID, CUSTOMER_ID]
  );
  return ORDER_ID;
}

test('rate_limit_check: atomic limiter, exact counts, fresh/retry windows', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());

  const limit = 10;
  const total = 25;
  // Fire the calls in parallel from the same harness. The SQL is a single
  // atomic statement; the exact allowed/rejected split is the correctness contract.
  const results = await Promise.all(
    Array.from({ length: total }, () =>
      db.query('select public.rate_limit_check($1, $2, 600) as result', ['probe:ip:1.2.3.4', limit])
    )
  );
  const allowed = results.filter((r) => r.rows[0].result.allowed === true).length;
  assert.equal(allowed, limit, 'exactly the limit may be admitted');
  const counts = results.map((r) => r.rows[0].result.count).sort((a, b) => a - b);
  assert.deepEqual(counts, Array.from({ length: total }, (_, i) => i + 1), 'counts 1..N, each exactly once');
  const final = (await db.query('select count from rate_limit_buckets where key = $1', ['probe:ip:1.2.3.4'])).rows[0];
  assert.equal(final.count, total);

  // a second key is independent
  const other = (await db.query('select public.rate_limit_check($1, 2, 600) as result', ['probe:ip:5.6.7.8'])).rows[0].result;
  assert.equal(other.allowed, true);
  assert.equal(other.count, 1);

  // window boundaries behave
  const retry = other.retry_after_seconds;
  assert.ok(Number.isFinite(retry));
  assert.ok(retry >= 1 && retry <= 600);

  // invalid arguments are refused loudly
  await assert.rejects(
    db.query('select public.rate_limit_check($1, 0, 600) as result', ['probe:ip:x']),
    /rate limit must be at least 1/
  );
  await assert.rejects(
    db.query('select public.rate_limit_check($1, 1, 0) as result', ['probe:ip:x']),
    /window must be at least 1 second/
  );
});

test('rate_limit_check: relevant bounded cleanup never deletes recent buckets', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());

  // 5 buckets 3 days old (outside retention) + 1 bucket for the current window
  for (let i = 0; i < 5; i += 1) {
    await db.query(
      `insert into rate_limit_buckets(key, window_start, count)
       values ($1, now() - interval '3 days', 3)`,
      [`probe:old:${i}`]
    );
  }

  const before = (await db.query('select count(*) as c from rate_limit_buckets')).rows[0].c;
  // Fresh window invocation: the atomic check, then a bounded cleanup deletes the expired rows.
  const fresh = (
    await db.query('select public.rate_limit_check($1, 3, 600) as result', ['probe:fresh:cleanup'])
  ).rows[0].result;
  assert.equal(fresh.allowed, true);

  const after = (await db.query('select * from rate_limit_buckets order by window_start')).rows;
  const remainingOld = after.filter((r) => String(r.key).startsWith('probe:old:'));
  assert.equal(remainingOld.length, 0, 'expired rows were cleaned');
  assert.ok(after.find((r) => r.key === 'probe:fresh:cleanup'), 'fresh bucket survives');
  assert.equal(before, 5);

  // bounded: with more than the per-call cap, only the cap is deleted
  for (let i = 0; i < 250; i += 1) {
    await db.query(
      `insert into rate_limit_buckets(key, window_start, count)
       values ($1, now() - interval '3 days', 1)`,
      [`probe:bounded:${i}`]
    );
  }
  const deleted = await db.query('select public.cleanup_rate_limit_buckets(172800, 200) as result');
  assert.equal(deleted.rows[0].result, 200, 'at most 200 rows removed per call');
  const remaining = (await db.query("select count(*) as c from rate_limit_buckets where key like 'probe:bounded:%'")).rows[0].c;
  assert.equal(remaining, 50, 'the remainder survives the bounded call');

  // retention: a row inside the retention window is never deleted
  await db.query(
    `insert into rate_limit_buckets(key, window_start, count)
     values ('probe:recent', now(), 1)`
  );
  const cleaned = await db.query('select public.cleanup_rate_limit_buckets(172800, 500) as result');
  assert.equal(cleaned.rows[0].result, 50, 'still only the expired remainder');
  assert.deepEqual(
    (await db.query('select key from rate_limit_buckets where key = \'probe:recent\'')).rows.length,
    1,
    'recent bucket is never deleted'
  );
});

test('claim_email_notification: ownership tokens and the in-flight rule', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  const orderId = await makeOrder(db);

  // first claim → new
  const first = (
    await db.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(first.outcome, 'new');
  assert.ok(first.claim_token, 'a claim token is issued');
  assert.equal(first.idempotency_key, `order-confirmation/${orderId}`);
  assert.equal(first.status, 'claimed');

  // a second claim while the lease is live → in_flight, no token, no resend
  const second = (
    await db.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(second.outcome, 'in_flight');
  assert.equal(second.claim_token, null);

  // a third claim while still live → still in_flight, different lease never re-taken
  const third = (
    await db.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(third.outcome, 'in_flight');

  // stale record with the wrong token → no-op
  const stale = (
    await db.query(
      "select public.record_email_outcome($1, 'order-confirmation', gen_random_uuid(), 'sent', 'resend-x') as result",
      [orderId]
    )
  ).rows[0].result;
  assert.equal(stale, false);
  const rowAfterStale = (
    await db.query('select status, resend_id from email_notifications where order_id = $1 and notification_type = $2', [orderId, 'order-confirmation'])
  ).rows[0];
  assert.equal(rowAfterStale.status, 'claimed');
  assert.equal(rowAfterStale.resend_id, null);

  // two independent notification types for the same order do NOT collide
  const adminClaim = (
    await db.query("select public.claim_email_notification($1, 'admin-new-order', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(adminClaim.outcome, 'new');
  assert.equal(adminClaim.idempotency_key, `admin-new-order/${orderId}`);
  assert.notEqual(adminClaim.claim_token, first.claim_token);
});

test('claim_email_notification: stale lease is reclaimed with a fresh token; stale writes cannot overwrite', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  const orderId = await makeOrder(db);

  const first = (
    await db.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId])
  ).rows[0].result;
  const oldToken = first.claim_token;
  assert.equal(first.outcome, 'new');

  // simulate the first request dying: force its lease into the past
  await db.query(
    `update email_notifications set claim_expires_at = now() - interval '1 minute' where order_id = $1 and notification_type = 'order-confirmation'`,
    [orderId]
  );

  // new claim → reclaimed with a fresh token
  const second = (
    await db.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(second.outcome, 'reclaimed');
  assert.ok(second.claim_token);
  assert.notEqual(second.claim_token, oldToken);
  assert.equal(second.idempotency_key, `order-confirmation/${orderId}`);

  // the OLD claim token is dead: its outcome write is a no-op
  const staleSent = (
    await db.query(
      "select public.record_email_outcome($1, 'order-confirmation', $2, 'sent', 'resend-stale') as result",
      [orderId, oldToken]
    )
  ).rows[0].result;
  assert.equal(staleSent, false);

  // the NEW claim token records normally
  const freshSent = (
    await db.query(
      "select public.record_email_outcome($1, 'order-confirmation', $2, 'sent', 'resend-fresh') as result",
      [orderId, second.claim_token]
    )
  ).rows[0].result;
  assert.equal(freshSent, true);

  const row = (
    await db.query('select status, resend_id from email_notifications where order_id = $1 and notification_type = $2', [orderId, 'order-confirmation'])
  ).rows[0];
  assert.equal(row.status, 'sent');
  assert.equal(row.resend_id, 'resend-fresh');

  // a third claim now sees the terminal outcome and does NOT resend
  const third = (
    await db.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(third.outcome, 'already_sent');
  assert.equal(third.claim_token, null);

  // stale record AFTER the terminal write is still rejected
  const lateStale = (
    await db.query(
      "select public.record_email_outcome($1, 'order-confirmation', gen_random_uuid(), 'sent', 'resend-late') as result",
      [orderId]
    )
  ).rows[0].result;
  assert.equal(lateStale, false);
});

test('record_email_outcome: terminal failure is terminal, transient keeps the claim', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  const orderId = await makeOrder(db);

  const claim = (
    await db.query("select public.claim_email_notification($1, 'admin-new-order', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(claim.outcome, 'new');

  // a transient hiccup records the error but keeps status='claimed'
  const transient = (
    await db.query(
      "select public.record_email_outcome($1, 'admin-new-order', $2, 'claimed', null, 'network timeout') as result",
      [orderId, claim.claim_token]
    )
  ).rows[0].result;
  assert.equal(transient, true);
  let row = (
    await db.query('select status, last_error from email_notifications where order_id = $1 and notification_type = $2', [orderId, 'admin-new-order'])
  ).rows[0];
  assert.equal(row.status, 'claimed');
  assert.equal(row.last_error, 'network timeout');

  // a terminal failure records 'failed' — never re-sendable through plain re-claim
  const terminal = (
    await db.query(
      "select public.record_email_outcome($1, 'admin-new-order', $2, 'failed', null, 'recipient rejected') as result",
      [orderId, claim.claim_token]
    )
  ).rows[0].result;
  assert.equal(terminal, true);
  row = (
    await db.query('select status, last_error from email_notifications where order_id = $1 and notification_type = $2', [orderId, 'admin-new-order'])
  ).rows[0];
  assert.equal(row.status, 'failed');
  assert.equal(row.last_error, 'recipient rejected');

  // a retry never re-sends: claim returns 'failed'
  const retry = (
    await db.query("select public.claim_email_notification($1, 'admin-new-order', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(retry.outcome, 'failed');
});

test('RLS and grants: anon cannot read tables or call functions; service_role can', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());
  const orderId = await makeOrder(db);

  await assert.rejects(
    anon(db, (tx) => tx.query('select * from public.email_notifications')),
    /permission denied|row-level security/i
  );
  await assert.rejects(
    anon(db, (tx) => tx.query('select * from public.rate_limit_buckets')),
    /permission denied|row-level security/i
  );
  await assert.rejects(anon(db, (tx) => tx.query('select public.rate_limit_check($1, 10, 600)', ['probe:anon'])));
  await assert.rejects(anon(db, (tx) => tx.query("select public.claim_email_notification($1, 'order-confirmation', 120)", [orderId])));
  await assert.rejects(anon(db, (tx) => tx.query('select public.cleanup_rate_limit_buckets(172800, 200)')));

  // service_role may claim, rate-limit, record and clean up
  await db.transaction(async (tx) => {
    await tx.exec('set local role service_role');
    const rl = await tx.query('select public.rate_limit_check($1, 5, 600) as result', ['probe:service']);
    assert.equal(rl.rows[0].result.allowed, true);
    const cleaned = await tx.query('select public.cleanup_rate_limit_buckets(172800, 200) as result');
    assert.ok(typeof cleaned.rows[0].result === 'number');
    const claim = await tx.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId]);
    assert.equal(claim.rows[0].result.outcome, 'new');
    const recorded = await tx.query(
      "select public.record_email_outcome($1, 'order-confirmation', $2, 'sent', 'resend-service') as result",
      [orderId, claim.rows[0].result.claim_token]
    );
    assert.equal(recorded.rows[0].result, true);
  });
});

test('notification tracking works on a real order placed through the checkout RPC', async (t) => {
  const db = await studioDb();
  t.after(() => db.close());

  const variant = (
    await db.query(
      `select v.id from product_variants v join products p on p.id = v.product_id where slug = 'tws-signature-tee' and size_name = 'L'`
    )
  ).rows[0].id;
  const order = {
    p_full_name: 'Fixture Buyer',
    p_email: 'fixture-buyer@example.test',
    p_phone: '01012345678',
    p_governorate: 'Cairo',
    p_city: 'Cairo',
    p_address: 'Test fixture address',
    p_notes: '',
    p_items: [{ variant_id: variant, quantity: 1 }],
    p_promo_code: null,
    p_payment_method: 'COD',
  };
  const saved = await anon(db, (tx) => rpc(tx, 'create_cod_order', order));
  const orderId = saved.order_id;

  // both notification types for the real order
  const customerClaim = (
    await db.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(customerClaim.outcome, 'new');
  assert.equal(customerClaim.idempotency_key, `order-confirmation/${orderId}`);

  const adminClaim = (
    await db.query("select public.claim_email_notification($1, 'admin-new-order', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(adminClaim.outcome, 'new');
  assert.equal(adminClaim.idempotency_key, `admin-new-order/${orderId}`);

  // record both as sent
  assert.equal(
    (await db.query(
      "select public.record_email_outcome($1, 'order-confirmation', $2, 'sent', 'resend-real-1') as result",
      [orderId, customerClaim.claim_token]
    )).rows[0].result,
    true
  );
  assert.equal(
    (await db.query(
      "select public.record_email_outcome($1, 'admin-new-order', $2, 'sent', 'resend-real-2') as result",
      [orderId, adminClaim.claim_token]
    )).rows[0].result,
    true
  );

  const rows = (
    await db.query('select notification_type, status, resend_id from email_notifications where order_id = $1 order by notification_type', [orderId])
  ).rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.status), ['sent', 'sent']);

  // both types are now terminal — further claims do NOT re-send
  const after = (
    await db.query("select public.claim_email_notification($1, 'order-confirmation', 120) as result", [orderId])
  ).rows[0].result;
  assert.equal(after.outcome, 'already_sent');
});
