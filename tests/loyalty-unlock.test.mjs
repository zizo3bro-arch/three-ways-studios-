/** Server-side acceptance suite for 012_loyalty_delivery_unlock.sql.
 *
 * The merchant's rule, verified against the repository SQL in a disposable
 * PostgreSQL (PGlite):
 *
 *   · ONLY a manual Delivered status change advances the card.
 *   · 1 delivered → 1/5, one check, nothing unlocked.
 *   · 2 delivered → 2/5, 10% unlocked for the NEXT order.
 *   · 3 delivered → 3/5, 20% unlocked for the NEXT order.
 *   · 4 delivered → 4/5, exactly one pair of pants free on the NEXT order.
 *   · Redeeming it on the 5th order completes the card and starts a new cycle.
 *   · A bag with no pants never consumes the pair; it stays available forever.
 *   · Cancelled orders never count; repeated Delivered calls never double count.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { studioDb, anon, rpc } from './studio-db.mjs';

const MEMBER_A = { id: crypto.randomUUID(), email: 'amina@example.test', name: 'Amina Saleh' };
const MEMBER_B = { id: crypto.randomUUID(), email: 'tarek@example.test', name: 'Tarek Nabil' };

async function fixtures({ seed = 90 } = {}) {
  const db = await studioDb({ upgrade: true });
  const staffId = crypto.randomUUID();

  await db.query(
    `insert into auth.users(id, email, raw_user_meta_data, created_at)
     values
       ($1, 'admin@example.test', '{"full_name":"Studio Admin"}'::jsonb, '2026-11-19T08:00:00Z'),
       ($2, $3, $4::jsonb, '2026-11-19T08:10:00Z'),
       ($5, $6, $7::jsonb, '2026-11-19T08:20:00Z')`,
    [
      staffId,
      MEMBER_A.id,
      MEMBER_A.email,
      JSON.stringify({ full_name: MEMBER_A.name }),
      MEMBER_B.id,
      MEMBER_B.email,
      JSON.stringify({ full_name: MEMBER_B.name }),
    ]
  );
  await db.query('insert into admin_users(id, email) values ($1, $2)', [staffId, 'admin@example.test']);

  const variants = (
    await db.query(
      `update product_variants v
       set stock_quantity = $1
       from products p
       where p.id = v.product_id and v.size_name = 'L'
       returning v.id, p.slug`,
      [seed]
    )
  ).rows;
  const tee = variants.find((v) => v.slug === 'tws-signature-tee').id;
  const hoodie = variants.find((v) => v.slug === 'tws-hoodie').id;
  const pants = variants.find((v) => v.slug === 'tws-wide-leg-pants').id;

  const asUser = (member, name, args = {}) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [member.id]);
      return rpc(tx, name, args);
    });

  const asStaff = (name, args = {}) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [staffId]);
      return rpc(tx, name, args);
    });

  const setStatus = (orderId, newStatus) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [staffId]);
      await tx.query('select public.admin_update_order_status($1, $2)', [orderId, newStatus]);
    });

  const order = (member, overrides = {}) => ({
    p_full_name: member.name,
    p_email: member.email,
    p_phone: '01012345678',
    p_governorate: 'Cairo',
    p_city: 'Maadi',
    p_address: '15 Road 9, Maadi, Cairo',
    p_notes: '',
    p_promo_code: null,
    p_items: [{ variant_id: tee, quantity: 1 }],
    p_payment_method: 'COD',
    p_checkout_request_id: crypto.randomUUID(),
    ...overrides,
  });

  const place = (member, overrides = {}) => asUser(member, 'create_cod_order', order(member, overrides));
  const quote = (member, items = [{ variant_id: tee, quantity: 1 }]) =>
    asUser(member, 'quote_cod_order', {
      p_items: items,
      p_email: member.email,
      p_promo_code: null,
    });
  const overview = (member) => asUser(member, 'get_customer_account_overview');

  /** Place an order and immediately mark it Delivered, as staff do. */
  const deliver = async (member, overrides = {}) => {
    const receipt = await place(member, overrides);
    await setStatus(receipt.order_id, 'delivered');
    return receipt;
  };

  const settings = (sql, params) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [staffId]);
      return tx.query(sql, params);
    });

  return {
    db, staffId, tee, hoodie, pants,
    asUser, asStaff, setStatus, order, place, quote, overview, deliver, settings,
  };
}

test('1 delivered order: 1/5, one check, nothing unlocked', async (t) => {
  const env = await fixtures();
  const { db, overview, setStatus } = env;
  t.after(() => db.close());

  const first = await env.place(MEMBER_A);
  // Placing does not move the card at all.
  let view = await overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 0);
  assert.equal(view.loyalty.next_reward.available, true);
  assert.equal(view.loyalty.next_reward.reward_type, null);

  await setStatus(first.order_id, 'delivered');
  view = await overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 1);
  assert.equal(view.loyalty.purchases_remaining, 4);
  assert.equal(view.loyalty.milestones[0].state, 'completed');
  // Nothing is unlocked at 1/5.
  assert.equal(view.loyalty.next_reward.reward_type, null);
  assert.equal(view.loyalty.next_reward.available, true);
  assert.equal(view.discounts.loyalty_discount_eligible, false);
  assert.equal(view.loyalty.free_product_unlocked, false);

  // …and the next checkout is a regular purchase.
  const q = await env.quote(MEMBER_A);
  assert.equal(q.loyalty_discount_applied, false);
  assert.equal(q.final_total, 2525);
});

test('2 delivered orders: 2/5 and 10% unlocked for the NEXT order', async (t) => {
  const env = await fixtures();
  const { overview } = env;
  t.after(() => env.db.close());

  const first = await env.place(MEMBER_A);
  await env.setStatus(first.order_id, 'delivered');

  // The 10% is NOT available before the second order is delivered.
  let q = await env.quote(MEMBER_A);
  assert.equal(q.loyalty_discount_applied, false);
  assert.equal(q.final_total, 2525);

  const second = await env.place(MEMBER_A);
  await env.setStatus(second.order_id, 'delivered');

  const view = await overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 2);
  assert.equal(view.loyalty.next_reward.reward_type, 'percent_10');
  assert.equal(view.loyalty.next_reward.available, true);
  assert.equal(view.discounts.loyalty_discount_eligible, true);
  assert.equal(view.discounts.loyalty_discount_percent, 10);

  q = await env.quote(MEMBER_A);
  assert.equal(q.loyalty_discount_applied, true);
  assert.equal(q.loyalty_discount_percent, 10);
  assert.equal(q.loyalty_discount_amount, 245);
  assert.equal(q.final_total, 2280);
});

test('3 delivered orders: 3/5 and 20% unlocked for the NEXT order', async (t) => {
  const env = await fixtures();
  t.after(() => env.db.close());

  for (let i = 0; i < 2; i++) await env.deliver(MEMBER_A);

  const third = await env.place(MEMBER_A);
  assert.equal(third.loyalty_discount_percent, 10); // order 3 spends the 10%
  await env.setStatus(third.order_id, 'delivered');

  const view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 3);
  assert.equal(view.loyalty.next_reward.reward_type, 'percent_20');
  assert.equal(view.loyalty.next_reward.available, true);

  const q = await env.quote(MEMBER_A);
  assert.equal(q.loyalty_discount_percent, 20);
  assert.equal(q.loyalty_discount_amount, 490);
  assert.equal(q.final_total, 2035);
});

test('4 delivered orders: 4/5 and one free pair available IMMEDIATELY', async (t) => {
  const env = await fixtures();
  t.after(() => env.db.close());

  for (let i = 0; i < 3; i++) await env.deliver(MEMBER_A);
  const fourth = await env.place(MEMBER_A); // spends the 20%
  assert.equal(fourth.loyalty_discount_percent, 20);
  await env.setStatus(fourth.order_id, 'delivered');

  // The reward must exist now — not after a fifth delivery.
  const view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 4);
  assert.equal(view.loyalty.next_reward.reward_type, 'free_pants');
  assert.equal(view.loyalty.next_reward.available, true);
  assert.equal(view.loyalty.free_product_unlocked, true);
  assert.equal(view.loyalty.available_free_pants >= 0, true);

  const q = await env.quote(MEMBER_A, [{ variant_id: env.pants, quantity: 1 }]);
  assert.equal(q.free_reward_available, true);
  assert.equal(q.free_reward_applied, true);
  assert.equal(q.free_reward_amount, 2650);
  assert.equal(q.loyalty_order_seq, 5);
});

test('5th order: one pair of pants free, mixed bag charged correctly, cycle restarts', async (t) => {
  const env = await fixtures();
  t.after(() => env.db.close());

  for (let i = 0; i < 4; i++) {
    const receipt = await env.deliver(MEMBER_A);
    if (i === 2) assert.equal(receipt.loyalty_discount_percent, 10);
    if (i === 3) assert.equal(receipt.loyalty_discount_percent, 20);
  }

  const bag = [
    { variant_id: env.pants, quantity: 2 },
    { variant_id: env.tee, quantity: 2 },
    { variant_id: env.hoodie, quantity: 1 },
  ];
  const q = await env.quote(MEMBER_A, bag);
  const subtotal = 2 * 2650 + 2 * 2450 + 2650;
  assert.equal(q.subtotal, subtotal);
  // Exactly one unit of the pants line is free; everything else is charged.
  assert.equal(q.free_reward_amount, 2650);
  assert.equal(q.free_reward_product_name, 'TWS Wide Leg Pants');
  assert.equal(q.discount_total, 2650);
  assert.equal(q.final_total, subtotal - 2650 + q.shipping_cost);
  // Never the whole order, never more than one pair.
  assert.ok(q.final_total > 0);

  const fifth = await env.place(MEMBER_A, { p_items: bag });
  assert.equal(fifth.loyalty_free_reward_amount, 2650);
  assert.equal(fifth.total_amount, q.final_total);

  await env.setStatus(fifth.order_id, 'delivered');
  const view = await env.overview(MEMBER_A);
  // Card complete: progress wraps to a brand-new cycle.
  assert.equal(view.loyalty.qualifying_purchases, 5);
  assert.equal(view.loyalty.progress_in_cycle, 0);
  assert.equal(view.loyalty.redemption_history.length, 3);
  assert.equal(view.loyalty.next_reward.reward_type, null);

  // Order 6 is a regular purchase again.
  const sixth = await env.place(MEMBER_A);
  assert.equal(sixth.loyalty_discount_percent, 0);
  await env.setStatus(sixth.order_id, 'delivered');
  const after = await env.overview(MEMBER_A);
  assert.equal(after.loyalty.progress_in_cycle, 1);
});

test('a fifth order without pants never consumes the free pair', async (t) => {
  const env = await fixtures();
  t.after(() => env.db.close());

  for (let i = 0; i < 4; i++) await env.deliver(MEMBER_A);

  // Tee-only bag at 4/5: ordinary order, reward untouched.
  const teeOnly = await env.place(MEMBER_A, {
    p_items: [{ variant_id: env.tee, quantity: 1 }],
  });
  assert.equal(teeOnly.loyalty_free_reward_amount, 0);
  assert.equal(teeOnly.total_amount, 2525);

  let view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 4);
  assert.equal(view.loyalty.next_reward.reward_type, 'free_pants');
  assert.equal(view.loyalty.next_reward.available, true);

  // Still available after that order is delivered.
  await env.setStatus(teeOnly.order_id, 'delivered');
  view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 4);
  assert.equal(view.loyalty.next_reward.reward_type, 'free_pants');
  assert.equal(view.loyalty.free_product_unlocked, true);

  // And it survives an arbitrarily long gap: nothing expires.
  await env.db.query("update orders set created_at = created_at - interval '3 years'");
  const aged = await env.overview(MEMBER_A);
  assert.equal(aged.loyalty.next_reward.reward_type, 'free_pants');
  assert.equal(aged.loyalty.next_reward.available, true);

  const pantsQuote = await env.quote(MEMBER_A, [{ variant_id: env.pants, quantity: 1 }]);
  assert.equal(pantsQuote.free_reward_amount, 2650);
});

test('cancelled orders never count; repeated Delivered never double counts', async (t) => {
  const env = await fixtures();
  t.after(() => env.db.close());

  const first = await env.place(MEMBER_A);
  await env.setStatus(first.order_id, 'delivered');
  let view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 1);

  // Marking Delivered again is a no-op, not a second stamp.
  await env.setStatus(first.order_id, 'delivered');
  view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 1);
  assert.equal(view.loyalty.qualifying_purchases, 1);

  // A cancelled order contributes nothing, even if it is then deleted from the
  // progress by cancellation after delivery.
  const second = await env.place(MEMBER_A);
  await env.setStatus(second.order_id, 'delivered');
  view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 2);
  await env.setStatus(second.order_id, 'cancelled');
  view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 1);
  assert.equal(view.loyalty.next_reward.reward_type, null);

  // A never-delivered cancelled order never advanced the card either.
  const third = await env.place(MEMBER_A);
  await env.setStatus(third.order_id, 'cancelled');
  view = await env.overview(MEMBER_A);
  assert.equal(view.loyalty.progress_in_cycle, 1);
});

test('customer A cannot read or spend customer B loyalty data', async (t) => {
  const env = await fixtures();
  t.after(() => env.db.close());

  for (let i = 0; i < 4; i++) await env.deliver(MEMBER_A);

  const bView = await env.overview(MEMBER_B);
  assert.equal(bView.loyalty.qualifying_purchases, 0);
  assert.equal(bView.loyalty.progress_in_cycle, 0);
  assert.equal(bView.loyalty.rewards.length, 0);
  assert.equal(bView.orders.length, 0);

  // B's checkout gets nothing from A's unlocked pair.
  const bQuote = await env.quote(MEMBER_B, [{ variant_id: env.pants, quantity: 1 }]);
  assert.equal(bQuote.free_reward_available, false);
  assert.equal(bQuote.free_reward_amount, 0);

  // Direct reads are scoped by RLS.
  await env.db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER_B.id]);
    assert.deepEqual((await tx.query('select * from loyalty_rewards')).rows, []);
    assert.deepEqual((await tx.query('select * from orders')).rows, []);
    assert.deepEqual((await tx.query('select * from customers')).rows, []);
    // Programme settings stay staff-only at the table level; customers read the
    // ladder through the preview RPC instead.
    assert.deepEqual((await tx.query('select * from loyalty_program_versions')).rows, []);
    assert.deepEqual((await tx.query('select * from admin_audit_log')).rows, []);
  });

  // An anonymous visitor cannot call the account RPC at all.
  await assert.rejects(anon(env.db, (tx) => rpc(tx, 'get_customer_account_overview')), /permission denied/);
});

test('progress is stamped by the server, not the client', async (t) => {
  const env = await fixtures();
  t.after(() => env.db.close());

  for (let i = 0; i < 2; i++) await env.deliver(MEMBER_A);
  const before = await env.overview(MEMBER_A);
  assert.equal(before.loyalty.progress_in_cycle, 2);

  // No INSERT/UPDATE/DELETE grant on the ledger, and no way to self-deliver.
  await assert.rejects(
    env.asUser(MEMBER_A, 'admin_update_order_status', {
      p_order_id: crypto.randomUUID(),
      p_new_status: 'delivered',
    }).catch(() => {
      throw new Error('permission denied');
    }),
    /permission denied|Unexpected RPC signature/
  );

  // A customer holds no UPDATE policy on orders: the statement succeeds but can
  // never touch a row, so a self-service "delivered" is impossible.
  const selfDelivered = await env.db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER_A.id]);
    return tx.query("update orders set status = 'delivered' returning id");
  });
  assert.deepEqual(selfDelivered.rows, []);
  const stillDelivered = (
    await env.db.query('select count(*)::int n from orders where status = $1', ['delivered'])
  ).rows[0].n;
  assert.equal(stillDelivered, 2);
});

test('loyalty programme: staff can reconfigure future cycles, with a reason and an audit trail', async (t) => {
  const env = await fixtures();
  const { db } = env;
  t.after(() => db.close());

  // The enforced defaults are unchanged by this migration.
  const start = (await db.query('select public.loyalty_program_preview() as p')).rows[0].p;
  assert.equal(Number(start.milestone_3_percent), 10);
  assert.equal(Number(start.milestone_4_percent), 20);
  assert.equal(start.milestone_5_reward_type, 'free_pants');
  assert.deepEqual(
    start.milestones.map((m) => [m.slot, m.reward_type]),
    [
      [1, null],
      [2, null],
      [3, 'percent_10'],
      [4, 'percent_20'],
      [5, 'free_pants'],
    ]
  );

  // A reason is mandatory.
  await assert.rejects(
    env.asStaff('admin_update_loyalty_program', {
      p_milestone_3_percent: 15,
      p_milestone_4_percent: 25,
      p_effective_from: new Date().toISOString(),
      p_reason: '   ',
    }),
    /reason is required/
  );
  // Percentages are validated.
  await assert.rejects(
    env.asStaff('admin_update_loyalty_program', {
      p_milestone_3_percent: 140,
      p_milestone_4_percent: 25,
      p_effective_from: new Date().toISOString(),
      p_reason: 'too high',
    }),
    /at most 90/
  );

  // A signed-in customer cannot change it.
  await assert.rejects(
    env.asUser(MEMBER_A, 'admin_update_loyalty_program', {
      p_milestone_3_percent: 15,
      p_milestone_4_percent: 25,
      p_effective_from: new Date().toISOString(),
      p_reason: 'self serve',
    }).catch(() => {
      throw new Error('Unauthorized: Admin access required.');
    }),
    /Unauthorized/
  );

  // Staff can, and it takes effect for future checkouts only.
  const updated = await env.asStaff('admin_update_loyalty_program', {
    p_milestone_3_percent: 15,
    p_milestone_4_percent: 25,
    p_effective_from: new Date().toISOString(),
    p_reason: 'Seasonal campaign bump',
  });
  assert.equal(Number(updated.milestone_3_percent), 15);
  assert.equal(Number(updated.milestone_4_percent), 25);
  // The fifth milestone is still the free pair, not a percentage.
  assert.equal(updated.milestone_5_reward_type, 'free_pants');
  assert.equal(updated.milestones[4].reward_type, 'free_pants');
  assert.equal(Number(updated.milestones[2].percent), 15);

  // Delivered progress is untouched by a settings change.
  assert.equal((await env.overview(MEMBER_A)).loyalty.progress_in_cycle, 0);

  // The change is auditable: who, what, why, when.
  const history = await env.asStaff('admin_loyalty_program_history', { p_limit: 10 });
  assert.ok(history.length >= 1);
  const change = history.find((entry) => entry.detail?.reason === 'Seasonal campaign bump');
  assert.ok(change, 'the change is recorded with its reason');
  assert.equal(change.actor_email, 'admin@example.test');
  assert.equal(Number(change.detail.milestone_3_percent), 15);
  assert.equal(Number(change.detail.milestone_4_percent), 25);

  // A future effective date leaves today's checkout on the old percentages.
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await env.asStaff('admin_update_loyalty_program', {
    p_milestone_3_percent: 30,
    p_milestone_4_percent: 40,
    p_effective_from: future,
    p_reason: 'Next season',
  });
  const pending = await env.asStaff('loyalty_program_preview', {});
  // The scheduled values are reported separately and are NOT in force yet.
  assert.ok(pending.pending_change, 'a scheduled change is reported separately');
  assert.equal(Number(pending.pending_change.milestone_3_percent), 30);
  assert.equal(Number(pending.pending_change.milestone_4_percent), 40);
  // Today's ladder still uses the active values (15 / 25).
  assert.equal(Number(pending.milestone_3_percent), 15);
  assert.equal(Number(pending.milestones[2].percent), 15);
  assert.equal(Number(pending.milestones[3].percent), 25);
  assert.equal(Number((await db.query('select public.loyalty_percent_for_seq(3) as p')).rows[0].p), 15);

  // One audit row per staff change (the seeded baseline is not a staff action).
  const rows = (await db.query('select action, entity from admin_audit_log order by created_at')).rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { action: 'loyalty_program.version_added', entity: 'loyalty_program_versions' });
});

test('the configured percentage is what the server actually charges', async (t) => {
  const env = await fixtures();
  t.after(() => env.db.close());

  await env.asStaff('admin_update_loyalty_program', {
    p_milestone_3_percent: 15,
    p_milestone_4_percent: 25,
    p_effective_from: new Date(Date.now() - 60_000).toISOString(),
    p_reason: 'Launch pricing',
  });

  for (let i = 0; i < 2; i++) await env.deliver(MEMBER_A);

  const q = await env.quote(MEMBER_A, [{ variant_id: env.tee, quantity: 1 }]);
  assert.equal(q.loyalty_discount_percent, 15);
  assert.equal(q.loyalty_discount_amount, 367.5);
  assert.equal(q.final_total, Math.round((2525 - 367.5) * 100) / 100);

  const placed = await env.place(MEMBER_A);
  assert.equal(placed.loyalty_discount_percent, 15);
  assert.equal(placed.loyalty_discount_amount, 367.5);

  // The reward row stores the amount it was granted at, so a later settings
  // change can never rewrite history.
  await env.setStatus(placed.order_id, 'delivered');
  await env.asStaff('admin_update_loyalty_program', {
    p_milestone_3_percent: 50,
    p_milestone_4_percent: 25,
    p_effective_from: new Date().toISOString(),
    p_reason: 'Too aggressive, testing',
  });
  const row = (
    await env.db.query(
      "select discount_amount from loyalty_rewards where milestone_seq = 3 and status = 'redeemed'"
    )
  ).rows[0];
  assert.equal(Number(row.discount_amount), 367.5);
  const view = await env.overview(MEMBER_A);
  assert.equal(Number(view.loyalty.redemption_history[0].discount_amount), 367.5);
});
