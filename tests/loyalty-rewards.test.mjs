/** Server-side regression suite for 011_loyalty_rewards_v2.sql (same-order model).
 *
 * Everything here runs against the real repository SQL in a disposable
 * PostgreSQL (PGlite). Supabase Auth is the only scaffold: the auth schema,
 * auth.uid() and the HTTP transport are stubbed, while every rule, policy,
 * trigger, function and transaction exercised below is the project's own.
 *
 * Reward model under test: the reward is applied to the SAME order that
 * reaches the milestone — order 3 gets 10%, order 4 gets 20%, order 5 frees
 * exactly one pair of pants in that same order.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { studioDb, anon, rpc } from './studio-db.mjs';

const MEMBER_A = { id: crypto.randomUUID(), email: 'amina@example.test', name: 'Amina Saleh' };
const MEMBER_B = { id: crypto.randomUUID(), email: 'tarek@example.test', name: 'Tarek Nabil' };

async function fixtures({ seed = 80 } = {}) {
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
  const tee2 = variants.find((v) => v.slug === 'tws-cross-tee').id;
  const pants = variants.find((v) => v.slug === 'tws-wide-leg-pants').id;
  const hoodie = variants.find((v) => v.slug === 'tws-hoodie').id;

  const asUser = (member, name, args = {}) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [member.id]);
      return rpc(tx, name, args);
    });

  const asGuest = (name, args = {}) => anon(db, (tx) => rpc(tx, name, args));

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

  const quote = (member, items = [{ variant_id: tee, quantity: 1 }], extra = {}) =>
    asUser(member, 'quote_cod_order', {
      p_items: items,
      p_email: member.email,
      p_promo_code: null,
      ...extra,
    });

  const place = (member, overrides = {}) => asUser(member, 'create_cod_order', order(member, overrides));

  const placeAndDeliver = async (member, overrides = {}) => {
    const receipt = await place(member, overrides);
    await setStatus(receipt.order_id, 'delivered');
    return receipt;
  };

  const overview = (member) => asUser(member, 'get_customer_account_overview');

  return {
    db, staffId, tee, tee2, pants, hoodie,
    asUser, asGuest, setStatus, order, quote, place, placeAndDeliver, overview,
  };
}

test('same-order ladder: orders 1-5 get regular, regular, 10%, 20%, one free pants', async (t) => {
  const env = await fixtures();
  const { db, tee, pants, hoodie, quote, place, placeAndDeliver, overview } = env;
  t.after(() => db.close());

  // ——— Order 1: regular price, no reward ———
  let q = await quote(MEMBER_A);
  assert.equal(q.loyalty_order_seq, 1);
  assert.equal(q.loyalty_discount_applied, false);
  assert.equal(q.free_reward_available, false);
  assert.equal(q.discount_total, 0);
  assert.equal(q.final_total, 2525);

  const order1 = await place(MEMBER_A);
  assert.equal(order1.loyalty_discount_amount, 0);
  assert.equal(order1.loyalty_free_reward_amount, 0);
  assert.equal(order1.total_amount, 2525);
  await env.setStatus(order1.order_id, 'delivered');

  let view = await overview(MEMBER_A);
  assert.equal(view.loyalty.qualifying_purchases, 1);
  assert.equal(view.loyalty.progress_in_cycle, 1);
  assert.equal(view.loyalty.milestones[0].state, 'completed');
  assert.equal(view.loyalty.milestones[1].state, 'next');

  // ——— Order 2: still regular price ———
  q = await quote(MEMBER_A);
  assert.equal(q.loyalty_order_seq, 2);
  assert.equal(q.loyalty_discount_applied, false);
  assert.equal(q.free_reward_available, false);

  const order2 = await place(MEMBER_A);
  assert.equal(order2.loyalty_discount_amount, 0);
  assert.equal(order2.total_amount, 2525);
  await env.setStatus(order2.order_id, 'delivered');

  view = await overview(MEMBER_A);
  assert.equal(view.loyalty.qualifying_purchases, 2);
  assert.equal(view.loyalty.next_order_seq, 3);
  assert.equal(view.loyalty.next_reward.reward_type, 'percent_10');
  assert.equal(view.discounts.loyalty_discount_eligible, true);

  // ——— Order 3: 10% ON THIS SAME ORDER ———
  q = await quote(MEMBER_A);
  assert.equal(q.loyalty_order_seq, 3);
  assert.equal(q.loyalty_discount_applied, true);
  assert.equal(q.loyalty_discount_percent, 10);
  assert.equal(q.loyalty_discount_amount, 245);
  assert.equal(q.loyalty_reward_type, 'percent_10');
  assert.equal(q.final_total, 2280);

  const order3 = await place(MEMBER_A);
  assert.equal(order3.loyalty_discount_percent, 10);
  assert.equal(order3.loyalty_discount_amount, 245);
  assert.equal(order3.total_amount, 2280);

  // Reservation exists against THIS order, before delivery.
  let rewardRows = (
    await db.query('select milestone_seq, reward_type, status, order_id, discount_amount from loyalty_rewards order by milestone_seq')
  ).rows;
  assert.deepEqual(rewardRows, [
    { milestone_seq: 3, reward_type: 'percent_10', status: 'reserved', order_id: order3.order_id, discount_amount: '245.00' },
  ]);

  view = await overview(MEMBER_A);
  assert.equal(view.loyalty.rewards[0].status, 'reserved');
  assert.equal(view.loyalty.rewards[0].order_reference, order3.order_reference);
  assert.equal(view.loyalty.milestones[2].state, 'applied');

  // Delivering it finalises the redemption of this same order.
  await env.setStatus(order3.order_id, 'delivered');
  rewardRows = (await db.query('select status from loyalty_rewards order by milestone_seq')).rows;
  assert.deepEqual(rewardRows, [{ status: 'redeemed' }]);

  view = await overview(MEMBER_A);
  assert.equal(view.loyalty.qualifying_purchases, 3);
  assert.equal(view.loyalty.redemption_history.length, 1);
  assert.equal(view.loyalty.redemption_history[0].order_reference, order3.order_reference);
  assert.equal(view.loyalty.milestones[2].state, 'rewarded');
  assert.equal(view.loyalty.next_reward.reward_type, 'percent_20');

  // ——— Order 4: 20% ON THIS SAME ORDER ———
  q = await quote(MEMBER_A);
  assert.equal(q.loyalty_order_seq, 4);
  assert.equal(q.loyalty_discount_percent, 20);
  assert.equal(q.loyalty_discount_amount, 490);
  assert.equal(q.final_total, 2035);

  const order4 = await place(MEMBER_A);
  assert.equal(order4.loyalty_discount_percent, 20);
  assert.equal(order4.loyalty_discount_amount, 490);
  assert.equal(order4.total_amount, 2035);
  await env.setStatus(order4.order_id, 'delivered');

  view = await overview(MEMBER_A);
  assert.equal(view.loyalty.qualifying_purchases, 4);
  assert.equal(view.loyalty.redemption_history.length, 2);
  assert.deepEqual(
    view.loyalty.redemption_history.map((r) => [r.reward_type, r.order_reference]),
    [
      ['percent_10', order3.order_reference],
      ['percent_20', order4.order_reference],
    ]
  );

  // ——— Order 5: exactly one pair of pants free, in this same order ———
  // A tee-only bag cannot use the reward, so it is granted and carried forward.
  q = await quote(MEMBER_A);
  assert.equal(q.loyalty_order_seq, 5);
  assert.equal(q.loyalty_reward_type, 'free_pants');
  assert.equal(q.free_reward_available, false);
  assert.equal(q.free_reward_amount, 0);
  assert.equal(q.discount_total, 0);

  const pantsBag = [
    { variant_id: pants, quantity: 2 },
    { variant_id: tee, quantity: 2 },
    { variant_id: hoodie, quantity: 1 },
  ];
  q = await quote(MEMBER_A, pantsBag);
  assert.equal(q.subtotal, 2 * 2650 + 2 * 2450 + 2650);
  assert.equal(q.free_reward_available, true);
  assert.equal(q.free_reward_applied, true);
  assert.equal(q.free_reward_amount, 2650);
  assert.equal(q.free_reward_product_name, 'TWS Wide Leg Pants');
  assert.equal(q.free_reward_seq, 5);
  assert.equal(q.discount_total, 2650);
  // Only one pair is free: the second pair and every other item stay charged.
  assert.equal(q.final_total, q.subtotal - 2650 + q.shipping_cost);
  assert.equal(q.loyalty_discount_amount, 0);

  const order5 = await place(MEMBER_A, { p_items: pantsBag });
  assert.equal(order5.loyalty_free_reward_amount, 2650);
  assert.equal(order5.loyalty_free_reward_product_name, 'TWS Wide Leg Pants');
  assert.equal(order5.loyalty_discount_amount, 0);
  assert.equal(order5.total_amount, q.final_total);

  const stored = (
    await db.query(
      `select loyalty_seq, loyalty_free_reward_amount, loyalty_free_reward_variant_id,
              loyalty_milestone_redeemed, loyalty_discount_amount
       from orders where id = $1`,
      [order5.order_id]
    )
  ).rows[0];
  assert.equal(stored.loyalty_seq, 5);
  assert.equal(stored.loyalty_free_reward_amount, '2650.00');
  assert.equal(stored.loyalty_free_reward_variant_id, pants);
  assert.equal(stored.loyalty_milestone_redeemed, 5);
  assert.equal(stored.loyalty_discount_amount, '0.00');

  await env.setStatus(order5.order_id, 'delivered');
  view = await overview(MEMBER_A);
  assert.equal(view.loyalty.qualifying_purchases, 5);
  assert.equal(view.loyalty.progress_in_cycle, 0);
  assert.equal(view.loyalty.redemption_history.length, 3);
  assert.deepEqual(
    view.loyalty.redemption_history.map((r) => r.reward_type),
    ['percent_10', 'percent_20', 'free_pants']
  );
  // The fully discounted 5th order does not feed the next cycle again.
  assert.equal(view.loyalty.next_order_seq, 6);
  assert.equal(view.loyalty.qualifying_purchases, 5);
});

test('loyalty_is_pants: detects the live catalog and rejects non-pants', async (t) => {
  const db = await studioDb({ upgrade: true });
  t.after(() => db.close());

  // Exact slug/category/name triples from the production catalog (read-only).
  const live = [
    ["Women's Pants", 'Denim bootcut', 'denim'],
    ['Pants', 'Denim row black', 'denim-row-black'],
  ];
  for (const [category, name, slug] of live) {
    const row = (
      await db.query('select public.loyalty_is_pants($1, $2, $3) as detected', [category, name, slug])
    ).rows[0];
    assert.equal(row.detected, true, `${slug} must be detected as pants`);
  }

  const notPants = [
    ['Streetwear', 'Signature Oversized Tee', 'tws-signature-tee'],
    ['Tops', 'Cropped Hoodie', 'tws-hoodie'],
    ['Accessories', 'Canvas Tote', 'canvas-tote'],
    ['Streetwear', 'Pleated Skirt', 'pleated-skirt'],
  ];
  for (const [category, name, slug] of notPants) {
    const row = (
      await db.query('select public.loyalty_is_pants($1, $2, $3) as detected', [category, name, slug])
    ).rows[0];
    assert.equal(row.detected, false, `${slug} must NOT be treated as pants`);
  }

  // The predicate is product-level only: it never depends on variant size/stock,
  // so any purchasable variant of a detected pants product is rewardable.
});

test('same-order ladder: order 6 starts a new cycle even when order 5 was fully free', async (t) => {
  const env = await fixtures();
  const { db, tee, pants, quote, place, placeAndDeliver, overview } = env;
  t.after(() => db.close());

  // Orders 1-4 keep the ladder moving.
  for (let seq = 1; seq <= 4; seq++) {
    const receipt = await placeAndDeliver(MEMBER_A);
    assert.equal(receipt.loyalty_order_seq, seq);
  }

  // Order 5 is a pants-only bag whose entire subtotal the reward pays. It still
  // consumes milestone 5, so the card must roll into a fresh cycle.
  const fifth = await placeAndDeliver(MEMBER_A, {
    p_items: [{ variant_id: pants, quantity: 1 }],
  });
  assert.equal(fifth.loyalty_order_seq, 5);
  assert.equal(fifth.loyalty_free_reward_amount, 2650);
  assert.equal(fifth.total_amount, 75);

  const view = await overview(MEMBER_A);
  assert.equal(view.loyalty.qualifying_purchases, 5);
  assert.equal(view.loyalty.progress_in_cycle, 0);
  assert.equal(view.loyalty.milestones[0].state, 'next');
  // The next reward is a plain stamp, never a repeat of milestone 5.
  assert.equal(view.loyalty.next_reward.reward_type, null);
  assert.equal(view.loyalty.next_reward.target_order, 1);

  // The 6th checkout must take sequence 6 at regular price — never collide with
  // the already-redeemed milestone 5 (the pre-fix bug raised a unique violation).
  const sixthQuote = await quote(MEMBER_A);
  assert.equal(sixthQuote.loyalty_order_seq, 6);
  assert.equal(sixthQuote.loyalty_discount_percent, 0);

  const sixth = await place(MEMBER_A);
  assert.equal(sixth.loyalty_order_seq, 6);
  assert.equal(sixth.total_amount, 2525);
  await env.setStatus(sixth.order_id, 'delivered');

  // Order 7 is regular; order 8 takes the 10% of the new cycle.
  const seventh = await placeAndDeliver(MEMBER_A);
  assert.equal(seventh.loyalty_order_seq, 7);
  assert.equal(seventh.loyalty_discount_amount, 0);

  const eighth = await placeAndDeliver(MEMBER_A);
  assert.equal(eighth.loyalty_order_seq, 8);
  assert.equal(eighth.loyalty_discount_percent, 10);
  assert.equal(eighth.loyalty_discount_amount, 245);
  assert.equal(eighth.total_amount, 2280);

  // Cycle 2 is 3/5 through, so 20% is queued for the very next order.
  const nextView = await overview(MEMBER_A);
  assert.equal(nextView.loyalty.qualifying_purchases, 8);
  assert.equal(nextView.loyalty.progress_in_cycle, 3);
  assert.equal(nextView.loyalty.available_rewards, 0);
  assert.equal(nextView.loyalty.milestones[0].state, 'completed');
  assert.equal(nextView.loyalty.milestones[2].state, 'rewarded');
  assert.equal(nextView.loyalty.milestones[3].state, 'next');
  assert.equal(nextView.loyalty.next_reward.reward_type, 'percent_20');
  void tee;
});

test('same-order ladder: milestone 5 discounts exactly one pants unit out of a mixed bag', async (t) => {
  const env = await fixtures();
  const { db, tee, pants, hoodie, quote, place, placeAndDeliver } = env;
  t.after(() => db.close());

  for (let i = 0; i < 4; i++) {
    await placeAndDeliver(MEMBER_A);
  }

  // Three pairs of the priciest pants, two tees and two hoodies in one bag.
  const bag = [
    { variant_id: pants, quantity: 3 },
    { variant_id: tee, quantity: 2 },
    { variant_id: hoodie, quantity: 2 },
  ];
  const q = await quote(MEMBER_A, bag);
  assert.equal(q.subtotal, 3 * 2650 + 2 * 2450 + 2 * 2650);
  assert.equal(q.free_reward_available, true);
  assert.equal(q.free_reward_amount, 2650);
  assert.equal(q.free_reward_product_name, 'TWS Wide Leg Pants');
  // Exactly ONE unit is discounted — never the whole basket, never several pairs.
  assert.equal(q.discount_total, 2650);
  assert.equal(q.final_total, q.subtotal - 2650 + q.shipping_cost);
  assert.equal(q.loyalty_discount_amount, 0);

  const receipt = await place(MEMBER_A, { p_items: bag });
  assert.equal(receipt.loyalty_free_reward_amount, 2650);
  assert.equal(receipt.total_amount, q.subtotal - 2650 + q.shipping_cost);

  // Every line item is still stored and charged in full; the reward is an
  // order-level discount of one unit, so inventory and totals stay consistent.
  const lines = (
    await db.query(
      `select quantity, unit_price, line_total from order_items
       where order_id = $1 order by quantity desc, unit_price desc`,
      [receipt.order_id]
    )
  ).rows;
  assert.deepEqual(
    lines.map((l) => [l.quantity, l.unit_price, l.line_total]),
    [
      [3, '2650.00', '7950.00'],
      [2, '2650.00', '5300.00'],
      [2, '2450.00', '4900.00'],
    ]
  );
  // The discount is stored once, on the order, not per line.
  assert.equal(
    (await db.query('select discount_total from orders where id = $1', [receipt.order_id])).rows[0]
      .discount_total,
    '2650.00'
  );
});

test('same-order ladder: the fifth-order pair never expires — a pants-free order keeps it unlocked', async (t) => {
  const env = await fixtures();
  const { db, pants, quote, place, placeAndDeliver, overview } = env;
  t.after(() => db.close());

  for (let i = 0; i < 4; i++) {
    const receipt = await placeAndDeliver(MEMBER_A);
    assert.equal(receipt.loyalty_order_seq, i + 1);
  }
  assert.equal((await overview(MEMBER_A)).loyalty.next_order_seq, 5);

  // Quote for a pants-free bag at milestone 5: still a VALID order, no discount.
  const teeOnly = await quote(MEMBER_A);
  assert.equal(teeOnly.loyalty_reward_type, 'free_pants');
  assert.equal(teeOnly.free_reward_available, false);
  assert.equal(teeOnly.free_reward_amount, 0);
  assert.equal(teeOnly.valid, true, 'a pants-free bag must never block checkout');
  assert.equal(teeOnly.discount_total, 0);
  assert.equal(teeOnly.final_total, 2525);

  // The order goes through at normal price and does NOT consume the milestone.
  const skipped = await place(MEMBER_A);
  assert.equal(skipped.loyalty_free_reward_amount, 0);
  assert.equal(skipped.total_amount, 2525);

  const skipRow = (
    await db.query('select loyalty_seq, loyalty_skipped from orders where id = $1', [
      skipped.order_id,
    ])
  ).rows[0];
  assert.equal(skipRow.loyalty_seq, null, 'a skipped order takes no ladder slot');
  assert.equal(skipRow.loyalty_skipped, true);

  let view = await overview(MEMBER_A);
  assert.equal(view.loyalty.qualifying_purchases, 4, 'the milestone is NOT consumed');
  assert.equal(view.loyalty.progress_in_cycle, 4);
  assert.equal(view.loyalty.milestones[4].state, 'next', 'milestone 5 stays claimable');
  assert.equal(view.loyalty.next_reward.reward_type, 'free_pants');
  assert.equal(
    (await db.query("select count(*)::int n from loyalty_rewards where reward_type = 'free_pants'"))
      .rows[0].n,
    0,
    'no reward row is created by a pants-free order'
  );

  // The customer can keep placing pants-free orders indefinitely; the pair survives.
  for (let i = 0; i < 3; i++) {
    const again = await place(MEMBER_A);
    assert.equal(again.loyalty_free_reward_amount, 0);
  }
  view = await overview(MEMBER_A);
  assert.equal(view.loyalty.milestones[4].state, 'next', 'still unlocked after more orders');
  assert.equal(view.loyalty.qualifying_purchases, 4);

  // No time-based expiry anywhere in the reward path.
  assert.equal(view.loyalty.free_reward_expires_at, null);
  const ddl = (
    await db.query(
      `select count(*)::int n from information_schema.columns
       where table_name = 'loyalty_rewards'
         and (column_name ilike '%expire%' or column_name ilike '%valid_until%')`
    )
  ).rows[0].n;
  assert.equal(ddl, 0, 'the rewards table has no expiration column');

  // A later order WITH pants finally redeems exactly one pair.
  const pantsBag = [
    { variant_id: pants, quantity: 2 },
  ];
  const redeemQuote = await quote(MEMBER_A, pantsBag);
  assert.equal(redeemQuote.loyalty_order_seq, 5, 'the sequence is finally consumed here');
  assert.equal(redeemQuote.free_reward_available, true);
  assert.equal(redeemQuote.free_reward_amount, 2650);
  assert.equal(redeemQuote.final_total, 2 * 2650 - 2650 + 0);

  const redeemed = await place(MEMBER_A, { p_items: pantsBag });
  assert.equal(redeemed.loyalty_free_reward_amount, 2650);
  await env.setStatus(redeemed.order_id, 'delivered');

  view = await overview(MEMBER_A);
  assert.equal(view.loyalty.qualifying_purchases, 5, 'the cycle is complete');
  assert.equal(view.loyalty.progress_in_cycle, 0, 'and resets to a fresh cycle');
  assert.equal(view.loyalty.milestones[0].state, 'next');
  assert.equal(view.loyalty.available_free_pants, 0, 'the pair was spent');
  assert.equal(view.loyalty.redemption_history.filter((r) => r.reward_type === 'free_pants').length, 1);
});

test('same-order ladder: the unlocked pair survives a multi-year gap and orders 6-10 repeat the cycle', async (t) => {
  const env = await fixtures();
  const { db, tee, pants, quote, place, placeAndDeliver, overview, setStatus } = env;
  t.after(() => db.close());

  // Reach milestone 5 without redeeming it.
  for (let i = 0; i < 4; i++) {
    await placeAndDeliver(MEMBER_A, { p_items: [{ variant_id: tee, quantity: 1 }] });
  }
  const skip = await place(MEMBER_A, { p_items: [{ variant_id: tee, quantity: 1 }] });
  await setStatus(skip.order_id, 'delivered');
  assert.equal((await overview(MEMBER_A)).loyalty.milestones[4].state, 'next');

  // Simulate the customer returning more than a year later: age every row this
  // account owns and re-read the reward. Nothing is time-based, so it must hold.
  await db.query(
    `update orders set created_at = created_at - interval '3 years', updated_at = updated_at - interval '3 years'
     where auth_user_id = $1`,
    [MEMBER_A.id]
  );
  await db.query(`update loyalty_rewards set created_at = created_at - interval '3 years' where auth_user_id = $1`, [
    MEMBER_A.id,
  ]);

  const later = await overview(MEMBER_A);
  assert.equal(later.loyalty.milestones[4].state, 'next', 'still unlocked after 3 years');
  assert.equal(later.loyalty.next_reward.reward_type, 'free_pants');
  assert.equal(later.loyalty.free_reward_expires_at, null);

  const staleQuote = await quote(MEMBER_A, [{ variant_id: pants, quantity: 1 }]);
  assert.equal(staleQuote.free_reward_available, true, 'still redeemable after 3 years');
  assert.equal(staleQuote.free_reward_amount, 2650);

  // Redeem it, then run a full second cycle (orders 6-10) on a fresh account.
  const env2 = await fixtures();
  t.after(() => env2.db.close());
  const { quote: q2, place: p2, placeAndDeliver: pd2, overview: ov2 } = env2;
  const seq = [];
  for (let i = 1; i <= 5; i++) {
    const bag = i === 5 ? [{ variant_id: env2.pants, quantity: 1 }] : [{ variant_id: env2.tee, quantity: 1 }];
    const q = await q2(MEMBER_B, bag);
    seq.push([q.loyalty_order_seq, q.loyalty_discount_percent, q.free_reward_amount]);
    await pd2(MEMBER_B, { p_items: bag });
  }
  assert.deepEqual(seq, [
    [1, 0, 0],
    [2, 0, 0],
    [3, 10, 0],
    [4, 20, 0],
    [5, 0, 2650],
  ]);
  const done = await ov2(MEMBER_B);
  assert.equal(done.loyalty.qualifying_purchases, 5);
  assert.equal(done.loyalty.progress_in_cycle, 0);
  assert.equal(done.loyalty.milestones[0].state, 'next');
  void p2;
});

test('same-order ladder: pending orders hold the slot, cancellation releases it', async (t) => {
  const env = await fixtures();
  const { db, pants, quote, place, overview, setStatus } = env;
  t.after(() => db.close());

  // Two completed orders -> the next checkout is order 3 with 10%.
  for (let i = 0; i < 2; i++) {
    const done = await place(MEMBER_A);
    await setStatus(done.order_id, 'delivered');
  }

  const third = await place(MEMBER_A);
  assert.equal(third.loyalty_discount_amount, 245);

  // While order 3 is in flight it occupies milestone 3, so a parallel checkout
  // cannot claim the 10% again; it becomes order 4.
  const inFlightQuote = await quote(MEMBER_A);
  assert.equal(inFlightQuote.loyalty_order_seq, 4);
  assert.equal(inFlightQuote.loyalty_discount_percent, 20);

  const overviewInFlight = await overview(MEMBER_A);
  assert.equal(overviewInFlight.loyalty.qualifying_purchases, 2);
  assert.equal(overviewInFlight.loyalty.in_flight_purchases, 1);

  // Pending orders never count as progress, even with a reward attached.
  assert.equal(overviewInFlight.loyalty.progress_in_cycle, 2);
  assert.equal(overviewInFlight.loyalty.milestones[2].state, 'applied');
  assert.equal(overviewInFlight.loyalty.milestones[2].order_reference, third.order_reference);

  // Cancelling releases the reservation and reopens the milestone.
  await setStatus(third.order_id, 'cancelled');
  const released = await overview(MEMBER_A);
  assert.equal(released.loyalty.in_flight_purchases, 0);
  assert.equal(released.loyalty.rewards.length, 0);
  assert.equal(released.loyalty.milestones[2].state, 'next');
  assert.deepEqual(
    (await db.query('select status from loyalty_rewards')).rows,
    [{ status: 'released' }]
  );

  // The next checkout reclaims the freed milestone with the 10% discount.
  const retryQuote = await quote(MEMBER_A, undefined, {});
  assert.equal(retryQuote.loyalty_order_seq, 3);
  assert.equal(retryQuote.loyalty_discount_percent, 10);
  assert.equal(retryQuote.loyalty_discount_amount, 245);

  const retried = await place(MEMBER_A);
  assert.equal(retried.loyalty_discount_percent, 10);
  await setStatus(retried.order_id, 'delivered');

  const finalView = await overview(MEMBER_A);
  assert.equal(finalView.loyalty.qualifying_purchases, 3);
  assert.equal(finalView.loyalty.rewards.length, 1);
  assert.equal(finalView.loyalty.rewards[0].status, 'redeemed');

  // A reactivated cancelled order whose reward slot was reused is refused.
  await assert.rejects(setStatus(third.order_id, 'confirmed'), /used elsewhere/);
  assert.equal(
    (await db.query('select status from orders where id = $1', [third.order_id])).rows[0].status,
    'cancelled'
  );

  // The pants milestone still works after all of that.
  const fourth = await place(MEMBER_A);
  assert.equal(fourth.loyalty_discount_percent, 20);
  await setStatus(fourth.order_id, 'delivered');
  const fifthQuote = await quote(MEMBER_A, [{ variant_id: pants, quantity: 1 }]);
  assert.equal(fifthQuote.free_reward_amount, 2650);
  assert.equal(fifthQuote.loyalty_order_seq, 5);
});

test('same-order ladder: no duplicate discounts, no reuse, no cross-customer leakage', async (t) => {
  const env = await fixtures();
  const { db, tee, pants, quote, place, overview, setStatus, asGuest, asUser } = env;
  t.after(() => db.close());

  for (let i = 0; i < 2; i++) {
    const done = await place(MEMBER_A);
    await setStatus(done.order_id, 'delivered');
  }

  // Two identical checkouts at the same sequence cannot both keep the reward:
  // the first reserves milestone 3, the second becomes order 4 (20%).
  const first = await place(MEMBER_A);
  const second = await place(MEMBER_A);
  assert.equal(first.loyalty_discount_percent, 10);
  assert.equal(second.loyalty_discount_percent, 20);
  assert.notEqual(first.loyalty_discount_amount, second.loyalty_discount_amount);
  assert.deepEqual(
    (await db.query('select milestone_seq, reward_type from loyalty_rewards order by milestone_seq')).rows,
    [
      { milestone_seq: 3, reward_type: 'percent_10' },
      { milestone_seq: 4, reward_type: 'percent_20' },
    ]
  );

  // Third parallel checkout is order 5: no pants in the bag -> no percentage
  // reward is handed to it and no free pair is discounted.
  const third = await place(MEMBER_A);
  assert.equal(third.loyalty_discount_amount, 0);
  assert.equal(third.loyalty_free_reward_amount, 0);

  // Retrying the same checkout request returns the same receipt, never a second order.
  const beforeRetry = (await db.query('select count(*) n from orders')).rows[0].n;
  const retried = await asUser(MEMBER_A, 'create_cod_order', {
    ...env.order(MEMBER_A),
    p_checkout_request_id: first.checkout_request_id,
  }).catch((error) => error);
  assert.ok(retried);
  assert.equal((await db.query('select count(*) n from orders')).rows[0].n, beforeRetry);

  // Guest checkouts get nothing, even with a member's email.
  const guestQuote = await asGuest('quote_cod_order', {
    p_items: [{ variant_id: tee, quantity: 1 }],
    p_email: MEMBER_A.email,
    p_promo_code: null,
  });
  assert.equal(guestQuote.loyalty_discount_applied, false);
  assert.equal(guestQuote.free_reward_available, false);
  const guestOrder = await asGuest('create_cod_order', env.order(MEMBER_A));
  assert.equal(guestOrder.loyalty_discount_amount, 0);
  assert.equal(guestOrder.loyalty_free_reward_amount, 0);
  const ordersAfterGuest = (await db.query('select count(*) n from orders')).rows[0].n;

  // A signed-in customer using a different email gets no loyalty benefit.
  const wrongEmail = await asUser(MEMBER_B, 'quote_cod_order', {
    p_items: [{ variant_id: tee, quantity: 1 }],
    p_email: MEMBER_A.email,
    p_promo_code: null,
  });
  assert.equal(wrongEmail.loyalty_discount_applied, false);
  const wrongEmailOrder = await asUser(MEMBER_B, 'create_cod_order', {
    ...env.order(MEMBER_A),
    p_checkout_request_id: crypto.randomUUID(),
  });
  assert.equal(wrongEmailOrder.loyalty_discount_amount, 0);

  // Member B has an independent ladder and cannot see or spend A's rewards.
  let bView = await overview(MEMBER_B);
  assert.equal(bView.loyalty.qualifying_purchases, 0);
  assert.equal(bView.loyalty.rewards.length, 0);
  // Member B's own order is the only one visible to B.
  assert.equal(bView.orders.length, 1);
  assert.equal(bView.orders[0].loyalty_discount_amount, 0);
  assert.equal((await quote(MEMBER_B, [{ variant_id: pants, quantity: 1 }])).free_reward_available, false);

  const bThird = await place(MEMBER_B);
  assert.equal(bThird.loyalty_discount_percent, 0); // B is only on order 1

  // Direct table access stays scoped by RLS and rewards are never client-written.
  await db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER_B.id]);
    assert.deepEqual((await tx.query('select * from loyalty_rewards')).rows, []);
    assert.equal((await tx.query('select * from orders')).rows.length, 2);
    assert.deepEqual((await tx.query('select * from customers')).rows, []);
  });

  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER_B.id]);
      await tx.query(
        "insert into loyalty_rewards(auth_user_id, milestone_seq, reward_type) values ($1, 3, 'percent_10')",
        [MEMBER_B.id]
      );
    }),
    /permission denied/
  );

  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec('set local role anon');
      await tx.query('select * from loyalty_rewards');
    }),
    /permission denied/
  );

  await db.transaction(async (tx) => {
    await tx.exec('set local role anon');
    assert.deepEqual((await tx.query('select * from orders')).rows, []);
  });

  // A needs no extra rows from the others' attempts.
  const aView = await overview(MEMBER_A);
  assert.equal(aView.loyalty.qualifying_purchases, 2);
  // 10% and 20% are reserved on orders 3/4. Order 5 had no pants, so no reward
  // row was created and the milestone stays claimable.
  assert.deepEqual(
    aView.loyalty.rewards.map((r) => [r.milestone_seq, r.reward_type, r.status]),
    [
      [4, 'percent_20', 'reserved'],
      [3, 'percent_10', 'reserved'],
    ]
  );
  // Two delivered + three live = milestone 5 is claimable on the next checkout.
  assert.equal(aView.loyalty.next_order_seq, 5);
  assert.equal(aView.loyalty.next_reward.reward_type, 'free_pants');
  // Nothing from another customer's attempts leaked into A's ledger.
  assert.equal(
    (await db.query('select count(*)::int n from loyalty_rewards where auth_user_id <> $1', [
      MEMBER_A.id,
    ])).rows[0].n,
    0
  );
});

test('same-order ladder: failed checkout rolls back the reservation and reward use', async (t) => {
  const env = await fixtures();
  const { db, pants, quote, place, overview, setStatus } = env;
  t.after(() => db.close());

  for (let i = 0; i < 4; i++) {
    const done = await place(MEMBER_A);
    await setStatus(done.order_id, 'delivered');
  }

  const ordersBefore = (await db.query('select count(*) n from orders')).rows[0].n;
  const stockBefore = (await db.query('select stock_quantity from product_variants where id = $1', [pants])).rows[0]
    .stock_quantity;

  // Fail at the exact moment the free-pair reservation is written.
  await db.exec(`
    create or replace function public.tws_test_fail_reservation()
    returns trigger language plpgsql as $$
    begin
      if current_setting('tws.fail_reservation', true) = 'on' then
        raise exception 'simulated checkout failure';
      end if;
      return new;
    end $$;
    create trigger tws_test_fail_reservation
      after insert or update on public.loyalty_rewards
      for each row execute function public.tws_test_fail_reservation();`);
  await db.exec("set tws.fail_reservation = 'on'");

  await assert.rejects(
    place(MEMBER_A, { p_items: [{ variant_id: pants, quantity: 1 }] }),
    /simulated checkout failure/
  );

  await db.exec('reset tws.fail_reservation');

  assert.equal((await db.query('select count(*) n from orders')).rows[0].n, ordersBefore);
  assert.equal(
    (await db.query('select stock_quantity from product_variants where id = $1', [pants])).rows[0].stock_quantity,
    stockBefore
  );
  // Only the two already-finalised percentage rewards remain; no free-pair row
  // and no orphaned reservation survived the rollback.
  assert.deepEqual(
    (await db.query('select milestone_seq, status from loyalty_rewards order by milestone_seq')).rows,
    [
      { milestone_seq: 3, status: 'redeemed' },
      { milestone_seq: 4, status: 'redeemed' },
    ]
  );
  assert.equal((await overview(MEMBER_A)).loyalty.next_order_seq, 5);

  // The customer retries normally and the pair is discounted exactly once.
  const quoteAfter = await quote(MEMBER_A, [{ variant_id: pants, quantity: 1 }]);
  assert.equal(quoteAfter.free_reward_amount, 2650);
  const receipt = await place(MEMBER_A, { p_items: [{ variant_id: pants, quantity: 1 }] });
  assert.equal(receipt.loyalty_free_reward_amount, 2650);
  assert.deepEqual(
    (await db.query("select status from loyalty_rewards where reward_type = 'free_pants'")).rows,
    [{ status: 'reserved' }]
  );
});

test('same-order ladder: migration re-applies cleanly and does not reissue historic rewards', async (t) => {
  const { readFile } = await import('node:fs/promises');
  const db = await studioDb({ upgrade: true });
  t.after(() => db.close());

  await db.exec(await readFile('supabase/migrations/011_loyalty_rewards_v2.down.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/010_account_loyalty_discounts.sql', 'utf8'));

  const staff = crypto.randomUUID();
  const user = crypto.randomUUID();
  await db.query(
    "insert into auth.users(id, email, raw_user_meta_data) values ($1,'legacy-admin@example.test','{}'::jsonb), ($2,'legacy@example.test','{}'::jsonb)",
    [staff, user]
  );
  await db.query("insert into admin_users(id, email) values ($1,'legacy-admin@example.test')", [staff]);

  const variant = (
    await db.query(
      `update product_variants v set stock_quantity = 40
       from products p where p.id = v.product_id and p.slug = 'tws-signature-tee' and v.size_name = 'L'
       returning v.id`
    )
  ).rows[0].id;

  const asUser = (name, args = {}) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
      return rpc(tx, name, args);
    });

  // Three historical delivered orders on the OLD (010) rules.
  for (let i = 0; i < 3; i++) {
    const receipt = await asUser('create_cod_order', {
      p_full_name: 'Legacy Buyer',
      p_email: 'legacy@example.test',
      p_phone: '01012345678',
      p_governorate: 'Cairo',
      p_city: 'Cairo',
      p_address: 'Legacy fixture address',
      p_notes: '',
      p_promo_code: null,
      p_items: [{ variant_id: variant, quantity: 1 }],
      p_payment_method: 'COD',
      p_checkout_request_id: crypto.randomUUID(),
      p_redeem_free_reward: false,
    });
    await db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [staff]);
      await tx.query('select public.admin_update_order_status($1, $2)', [receipt.order_id, 'delivered']);
    });
  }

  // Apply 011 twice: idempotent, and no historic reward row is minted.
  await db.exec(await readFile('supabase/migrations/011_loyalty_rewards_v2.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/011_loyalty_rewards_v2.sql', 'utf8'));
  assert.equal((await db.query('select count(*) n from loyalty_rewards')).rows[0].n, 0);

  const view = await asUser('get_customer_account_overview');
  assert.equal(view.loyalty.qualifying_purchases, 3);
  assert.equal(view.loyalty.rewards.length, 0);
  assert.equal(view.loyalty.next_order_seq, 4);

  // Their next order is order 4, which under the same-order model gets 20%.
  const nextQuote = await asUser('quote_cod_order', {
    p_items: [{ variant_id: variant, quantity: 1 }],
    p_email: 'legacy@example.test',
    p_promo_code: null,
  });
  assert.equal(nextQuote.loyalty_order_seq, 4);
  assert.equal(nextQuote.loyalty_discount_percent, 20);
  assert.equal(nextQuote.loyalty_discount_amount, 490);

  // Roll back and re-apply once more for symmetry with the 010 round-trip.
  await db.exec(await readFile('supabase/migrations/011_loyalty_rewards_v2.down.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/011_loyalty_rewards_v2.sql', 'utf8'));
  assert.equal((await db.query('select count(*) n from loyalty_rewards')).rows[0].n, 0);
});
