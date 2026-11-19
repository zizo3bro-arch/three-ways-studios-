import test from 'node:test';
import assert from 'node:assert/strict';
import { studioDb, anon, rpc } from './studio-db.mjs';

test('upgrade: COD transactions, delivery, discounts, receipt privacy and staff policies', async (t) => {
  const db = await studioDb({ upgrade: true });
  t.after(() => db.close());
  const variant = (
    await db.query(
      `select v.id from product_variants v join products p on p.id=v.product_id where slug='tws-signature-tee' and size_name='L'`
    )
  ).rows[0].id;
  const quote = {
    p_items: [{ variant_id: variant, quantity: 1 }],
    p_email: 'buyer@example.test',
    p_promo_code: null,
  };
  const order = {
    ...quote,
    p_full_name: 'Fixture Buyer',
    p_phone: '01012345678',
    p_governorate: 'Cairo',
    p_city: 'Cairo',
    p_address: 'Test fixture address',
    p_notes: '',
    p_payment_method: 'COD',
  };
  const call = (name, args) => anon(db, (tx) => rpc(tx, name, args));
  const beforeEmailSubmit = await call('quote_cod_order', quote);
  assert.equal(beforeEmailSubmit.email_discount_applied, false);
  assert.equal(beforeEmailSubmit.email_discount_amount, 0);
  assert.equal(beforeEmailSubmit.final_total, 2525);

  await anon(db, (tx) =>
    tx.query('insert into newsletter_subscribers(email) values($1)', ['buyer@example.test'])
  );
  const q = await call('quote_cod_order', quote);
  assert.equal(q.valid, true);
  assert.equal(q.shipping_cost, 75);
  assert.equal(q.email_discount_amount, 245);
  assert.equal(q.final_total, 2280);
  const free = await call('quote_cod_order', {
    ...quote,
    p_items: [{ variant_id: variant, quantity: 2 }],
  });
  assert.equal(free.shipping_cost, 0);
  await assert.rejects(call('create_cod_order', { ...order, p_payment_method: 'unsupported' }));
  await assert.rejects(
    call('create_cod_order', { ...order, p_items: [{ variant_id: variant, quantity: 999 }] })
  );
  assert.equal((await db.query('select count(*) as n from orders')).rows[0].n, 0);
  const saved = await call('create_cod_order', order);
  assert.equal(saved.total_amount, q.final_total);
  const row = (await db.query('select * from orders where id=$1', [saved.order_id])).rows[0];
  assert.equal(row.payment_method, 'COD');
  assert.equal(Number(row.total_amount), q.final_total);
  assert.equal(
    (await db.query('select stock_quantity from product_variants where id=$1', [variant])).rows[0]
      .stock_quantity,
    7
  );
  assert.equal(
    await call('get_order_confirmation', {
      p_order_reference: saved.order_reference,
      p_email: 'other@example.test',
    }),
    null
  );
  const receipt = await call('get_order_confirmation', {
    p_order_reference: saved.order_reference,
    p_email: order.p_email,
  });
  assert.equal(receipt.total_amount, q.final_total);
  assert.equal(receipt.shipping_cost, 75);
  const { p_payment_method: unused, ...legacy } = order;
  const secondOrderSameEmail = await call('create_cod_order', legacy);
  assert.equal(secondOrderSameEmail.payment_method, 'COD');
  assert.equal(secondOrderSameEmail.email_discount_amount, 0);
  await anon(db, (tx) =>
    tx.query('insert into newsletter_subscribers(email) values($1)', ['news@example.test'])
  );
  await assert.rejects(
    anon(db, (tx) =>
      tx.query('insert into newsletter_subscribers(email) values($1)', ['news@example.test'])
    ),
    (e) => e.code === '23505'
  );
  assert.equal((await db.query('select count(*) n from newsletter_subscribers')).rows[0].n, 2);
  await anon(db, async (tx) => {
    for (const table of ['orders', 'customers', 'order_items', 'admin_users', 'newsletter_subscribers'])
      assert.deepEqual((await tx.query(`select * from ${table}`)).rows, []);
  });
  const staff = crypto.randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2)', [staff, 'staff@example.test']);
  await db.query('insert into admin_users(id,email) values($1,$2)', [staff, 'staff@example.test']);
  for (const [uid, allowed] of [
    [crypto.randomUUID(), false],
    [staff, true],
  ])
    await db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
      assert.equal((await tx.query('select public.is_admin() ok')).rows[0].ok, allowed);
      assert.equal((await tx.query('select id from orders')).rows.length, allowed ? 2 : 0);
      for (const [sql, args] of [
        [
          'update products set description=description where slug=$1 returning id',
          ['tws-signature-tee'],
        ],
        [
          'update product_variants set stock_quantity=stock_quantity where id=$1 returning id',
          [variant],
        ],
        [
          'update site_settings set newsletter_text=newsletter_text where id=$1 returning id',
          ['default'],
        ],
        ['update orders set order_notes=order_notes where id=$1 returning id', [saved.order_id]],
      ])
        assert.equal((await tx.query(sql, args)).rows.length, allowed ? 1 : 0);
      if (allowed) await tx.query("select admin_update_order_status($1,'cancelled')", [saved.order_id]);
    });
  assert.equal(
    (await db.query('select stock_quantity from product_variants where id=$1', [variant])).rows[0]
      .stock_quantity,
    7
  );

  // Registered storefront customers sync automatically, respect RLS, and exclude secrets
  const registeredId = crypto.randomUUID();
  const namelessId = crypto.randomUUID();
  await db.query(
    `insert into auth.users(id, email, encrypted_password, confirmation_token, raw_user_meta_data, created_at)
     values
       ($1, 'Nour.Hassan@example.test', '$2a$10$SECRET_HASH_VALUE', 'SECRET_CONFIRM_TOKEN', '{"full_name":"Nour Hassan"}'::jsonb, '2026-11-18T08:15:00Z'),
       ($2, 'nameless@example.test', '$2a$10$OTHER_HASH', 'OTHER_TOKEN', '{}'::jsonb, '2026-11-18T09:30:00Z')`,
    [registeredId, namelessId]
  );

  // Anon cannot list customers or register accounts
  await assert.rejects(anon(db, (tx) => tx.query('select * from public.admin_list_customers()')));
  await assert.rejects(anon(db, (tx) => tx.query('select public.register_customer_account($1)', ['X'])));

  // Authenticated non-admin customer can self-sync only their own account, cannot read customer list
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [registeredId]);
      await tx.query('select * from public.admin_list_customers()');
    })
  );
  await db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [registeredId]);
    assert.deepEqual((await tx.query('select * from public.customers')).rows, []);
    const selfRow = (
      await tx.query('select public.register_customer_account($1) as row', ['Nour Hassan'])
    ).rows[0].row;
    assert.equal(selfRow.email, 'nour.hassan@example.test');
    assert.equal(selfRow.full_name, 'Nour Hassan');
    assert.equal('encrypted_password' in selfRow, false);
    assert.equal('confirmation_token' in selfRow, false);
  });

  // Verified admin receives all real registered users + guest buyer, zero staff, zero secrets
  await db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
    const directory = (await tx.query('select * from public.admin_list_customers()')).rows;
    assert.equal(directory.length, 3);
    assert.equal(
      directory.some((c) => c.email === 'staff@example.test'),
      false
    );
    const serialized = JSON.stringify(directory);
    assert.equal(serialized.includes('SECRET_HASH_VALUE'), false);
    assert.equal(serialized.includes('SECRET_CONFIRM_TOKEN'), false);

    const nour = directory.find((c) => c.email === 'nour.hassan@example.test');
    assert.ok(nour);
    assert.equal(nour.full_name, 'Nour Hassan');
    assert.equal(nour.auth_user_id, registeredId);
    assert.equal(nour.is_registered, true);
    assert.ok(nour.registered_at);

    const nameless = directory.find((c) => c.email === 'nameless@example.test');
    assert.ok(nameless);
    assert.equal(nameless.full_name, '');
    assert.equal(nameless.is_registered, true);

    const buyer = directory.find((c) => c.email === 'buyer@example.test');
    assert.ok(buyer);
    assert.equal(buyer.full_name, 'Fixture Buyer');
    assert.equal(buyer.is_registered, false);
  });

  // When a registered customer subsequently places a COD order, it merges without duplicating
  await call('create_cod_order', {
    ...order,
    p_full_name: 'Nour Hassan',
    p_email: 'nour.hassan@example.test',
  });
  await db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
    const directory = (await tx.query('select * from public.admin_list_customers()')).rows;
    assert.equal(directory.length, 3);
    const nour = directory.find((c) => c.email === 'nour.hassan@example.test');
    assert.equal(nour.is_registered, true);
    assert.equal(nour.city, 'Cairo');
  });

  // Metadata variants (name, first_name+last_name, whitespace-only) and migration idempotency
  const [uName, uSplit, uBlank] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  await db.query(
    `insert into auth.users(id, email, raw_user_meta_data, created_at)
     values
       ($1, 'sara@example.test', '{"name":"Sara Ali"}'::jsonb, '2026-11-18T10:00:00Z'),
       ($2, 'omar@example.test', '{"first_name":"Omar","last_name":"Farouk"}'::jsonb, '2026-11-18T10:05:00Z'),
       ($3, 'blank@example.test', '{"full_name":"   "}'::jsonb, '2026-11-18T10:10:00Z')`,
    [uName, uSplit, uBlank]
  );
  const { readFile } = await import('node:fs/promises');
  await db.exec(await readFile('supabase/migrations/008_registered_customers.sql', 'utf8'));
  await db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
    const list = (await tx.query('select * from public.admin_list_customers()')).rows;
    assert.equal(list.find((c) => c.email === 'sara@example.test')?.full_name, 'Sara Ali');
    assert.equal(list.find((c) => c.email === 'omar@example.test')?.full_name, 'Omar Farouk');
    assert.equal(list.find((c) => c.email === 'blank@example.test')?.full_name, '');
  });
});

test('legacy promo record regression, verified totals and idempotent checkout', async (t) => {
  const db = await studioDb({ legacyCheckout: true });
  t.after(() => db.close());
  const { readFile } = await import('node:fs/promises');
  const install = async (name) => db.exec(await readFile(`supabase/migrations/${name}.sql`, 'utf8'));
  const [{ id: variant }] = (
    await db.query(`select v.id from product_variants v join products p on p.id=v.product_id
      where p.slug='tws-signature-tee' and v.size_name='L' and v.color_name='Black'`)
  ).rows;
  const quote = {
    p_items: [{ variant_id: variant, quantity: 1, unit_price: 1, available_stock: 999 }],
    p_email: 'buyer@example.test',
    p_promo_code: null,
  };
  const legacyOrder = {
    ...quote,
    p_full_name: 'Fixture Buyer',
    p_phone: '01012345678',
    p_governorate: 'Cairo',
    p_city: 'Cairo',
    p_address: '42 Test Street, floor 2',
    p_notes: '',
  };
  const call = (name, args) => anon(db, (tx) => rpc(tx, name, args));
  const noPromoRecord = (e) =>
    e.code === '55000' && e.message === 'record "v_promo_rule" is not assigned yet';
  await assert.rejects(call('quote_cod_order', quote), noPromoRecord);
  await assert.rejects(call('create_cod_order', legacyOrder), noPromoRecord);
  await assert.rejects(install('009_checkout_idempotency'), /Apply or re-apply 007/);
  await db.exec('ROLLBACK');

  await install('007_cod_checkout');
  await install('003_functions_and_storage'); // simulate a database whose stored RPCs drifted
  await assert.rejects(install('009_checkout_idempotency'), /re-apply 007/);
  await db.exec('ROLLBACK');
  await install('007_cod_checkout');
  await install('009_checkout_idempotency');
  await install('009_checkout_idempotency'); // safe to re-run
  for (const code of [null, '  ']) {
    const q = await call('quote_cod_order', { ...quote, p_promo_code: code });
    assert.equal(q.valid, true);
    assert.equal(q.promo_code_applied, null);
    assert.equal(q.promo_error, null);
    assert.equal(q.items[0].unit_price, 2450);
    assert.equal(q.items[0].available_stock, 8);
    assert.equal(q.subtotal, 2450);
    assert.equal(q.shipping_cost, 75);
    assert.equal(q.discount_total, 245);
    assert.equal(q.final_total, 2280);
  }
  const noEmail = await call('quote_cod_order', { ...quote, p_email: null });
  assert.equal(noEmail.discount_total, 0);
  assert.equal(noEmail.final_total, 2525);
  const freeShipping = await call('quote_cod_order', {
    ...quote,
    p_items: [{ variant_id: variant, quantity: 2 }],
  });
  assert.equal(freeShipping.shipping_cost, 0);
  assert.equal(freeShipping.final_total, 4410);
  const unavailable = await call('quote_cod_order', {
    ...quote,
    p_items: [{ variant_id: variant, quantity: 9 }],
  });
  assert.equal(unavailable.valid, false);
  assert.match(unavailable.stock_errors.join(' '), /Only 8 left/);

  await db.exec(`insert into discount_rules (rule_type, code, name, discount_percent, is_active, ends_at, min_order_amount, max_uses)
    values ('promo_code', 'FIXTURE10', 'Valid test code', 10, true, null, 0, 1),
           ('promo_code', 'INACTIVE', 'Inactive test code', 10, false, null, 0, null),
           ('promo_code', 'EXPIRED', 'Expired test code', 10, true, now() - interval '1 day', 0, null),
           ('promo_code', 'MINIMUM', 'Minimum test code', 10, true, null, 3000, null)`);
  const order = { ...legacyOrder, p_payment_method: 'COD', p_checkout_request_id: crypto.randomUUID() };
  for (const [code, message] of [
    ['MISSING', /Invalid or inactive/],
    ['INACTIVE', /Invalid or inactive/],
    ['EXPIRED', /expired/],
    ['MINIMUM', /Minimum order/],
  ]) {
    const q = await call('quote_cod_order', { ...quote, p_promo_code: code });
    assert.match(q.promo_error, message);
    assert.equal(q.promo_discount_amount, 0);
    await assert.rejects(call('create_cod_order', { ...order, p_promo_code: code }), /invalid, expired/);
  }
  assert.equal((await db.query('select count(*) n from orders')).rows[0].n, 0);
  const valid = { ...order, p_promo_code: ' fixture10 ' };
  const q = await call('quote_cod_order', { ...quote, p_promo_code: valid.p_promo_code });
  assert.equal(q.promo_code_applied, 'FIXTURE10');
  assert.equal(q.email_discount_amount, 245);
  assert.equal(q.promo_discount_amount, 220.50);
  assert.equal(q.discount_total, 465.50);
  assert.equal(q.final_total, 2059.50);
  const saved = await call('create_cod_order', valid);
  const duplicate = await call('create_cod_order', valid); // still succeeds after promo limit is hit
  assert.equal(saved.total_amount, q.final_total);
  assert.equal(saved.payment_method, 'COD');
  assert.equal(saved.order_id, duplicate.order_id);
  assert.equal(saved.order_reference, duplicate.order_reference);
  assert.equal(saved.total_amount, duplicate.total_amount);
  await assert.rejects(
    call('create_cod_order', { ...valid, p_email: 'another@example.test' }),
    /cannot be reused with that email/
  );
  const exhausted = await call('quote_cod_order', { ...quote, p_promo_code: valid.p_promo_code });
  assert.match(exhausted.promo_error, /usage limit/);
  await assert.rejects(
    call('create_cod_order', { ...valid, p_checkout_request_id: crypto.randomUUID() }),
    /invalid, expired/
  );
  const { rows: orders } = await db.query('select * from orders');
  assert.equal(orders.length, 1);
  assert.equal(orders[0].checkout_request_id, valid.p_checkout_request_id);
  assert.equal(Number(orders[0].shipping_cost), q.shipping_cost);
  assert.equal(Number(orders[0].total_amount), q.final_total);
  const { rows: lines } = await db.query('select variant_id, quantity, unit_price, line_total from order_items');
  assert.deepEqual(lines, [{ variant_id: variant, quantity: 1, unit_price: '2450.00', line_total: '2450.00' }]);
  assert.equal((await db.query('select stock_quantity from product_variants where id=$1', [variant])).rows[0].stock_quantity, 7);
  assert.equal((await db.query("select uses_count from discount_rules where code='FIXTURE10'")).rows[0].uses_count, 1);
  assert.equal((await db.query('select count(*) n from discount_usage where order_id=$1', [saved.order_id])).rows[0].n, 2);
});

test('account overview, 4-stage order tracking, completed purchase history, 5/5 loyalty reward and non-stacking 10% discounts', async (t) => {
  const db = await studioDb({ upgrade: true });
  t.after(() => db.close());

  // Increase stock so we can run a full 6+ order lifecycle cleanly
  const variant = (
    await db.query(
      `update product_variants v
       set stock_quantity = 40
       from products p
       where p.id = v.product_id and p.slug = 'tws-signature-tee' and v.size_name = 'L'
       returning v.id`
    )
  ).rows[0].id;

  const staffId = crypto.randomUUID();
  const memberA = crypto.randomUUID();
  const memberB = crypto.randomUUID();
  await db.query(
    `insert into auth.users(id, email, raw_user_meta_data, created_at)
     values
       ($1, 'admin@example.test', '{"full_name":"Studio Admin"}'::jsonb, '2026-11-19T08:00:00Z'),
       ($2, 'amina@example.test', '{"full_name":"Amina Saleh"}'::jsonb, '2026-11-19T08:10:00Z'),
       ($3, 'tarek@example.test', '{"full_name":"Tarek Nabil"}'::jsonb, '2026-11-19T08:20:00Z')`,
    [staffId, memberA, memberB]
  );
  await db.query('insert into admin_users(id, email) values ($1, $2)', [staffId, 'admin@example.test']);

  const asAnon = (name, args) => anon(db, (tx) => rpc(tx, name, args));
  const asUser = (uid, name, args = {}) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
      return rpc(tx, name, args);
    });
  const setOrderStatus = (orderId, newStatus) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [staffId]);
      await tx.query('select public.admin_update_order_status($1, $2)', [orderId, newStatus]);
    });

  // 1. Privacy & isolation: anon is rejected by GRANT; memberA & memberB only ever see their own profile/orders
  await assert.rejects(asAnon('get_customer_account_overview', {}), /permission denied/);
  const initialOverview = await asUser(memberA, 'get_customer_account_overview');
  assert.equal(initialOverview.profile.email, 'amina@example.test');
  assert.equal(initialOverview.profile.full_name, 'Amina Saleh');
  assert.equal(initialOverview.purchase_summary.completed_purchases, 0);
  assert.equal(initialOverview.loyalty.progress_in_cycle, 0);
  assert.equal(initialOverview.loyalty.purchases_remaining, 5);
  assert.equal(initialOverview.loyalty.free_product_unlocked, false);
  assert.equal(initialOverview.discounts.loyalty_discount_eligible, false);
  assert.equal(initialOverview.discounts.email_discount_eligible, false);

  const baseOrder = {
    p_full_name: 'Amina Saleh',
    p_email: 'amina@example.test',
    p_phone: '01012345678',
    p_governorate: 'Cairo',
    p_city: 'Maadi',
    p_address: '15 Road 9, Maadi, Cairo',
    p_notes: '',
    p_promo_code: null,
    p_items: [{ variant_id: variant, quantity: 1 }],
    p_payment_method: 'COD',
  };

  // 2. Option 2 (Email Discount 10%): requires email submission, works once, cannot be reused
  await anon(db, (tx) =>
    tx.query('insert into newsletter_subscribers(email) values ($1)', ['amina@example.test'])
  );
  const afterSubscribeOverview = await asUser(memberA, 'get_customer_account_overview');
  assert.equal(afterSubscribeOverview.discounts.email_submitted, true);
  assert.equal(afterSubscribeOverview.discounts.email_discount_eligible, true);

  const qOrder1 = await asUser(memberA, 'quote_cod_order', {
    p_items: baseOrder.p_items,
    p_email: baseOrder.p_email,
    p_promo_code: null,
    p_redeem_free_reward: false,
  });
  assert.equal(qOrder1.email_discount_applied, true);
  assert.equal(qOrder1.email_discount_amount, 245);
  assert.equal(qOrder1.loyalty_discount_applied, false);
  assert.equal(qOrder1.final_total, 2280);

  const order1 = await asUser(memberA, 'create_cod_order', {
    ...baseOrder,
    p_checkout_request_id: crypto.randomUUID(),
    p_redeem_free_reward: false,
  });
  assert.equal(order1.email_discount_amount, 245);
  assert.equal(order1.total_amount, 2280);

  // Immediately trying again with the same email cannot reuse the 10% Email Discount
  const qRepeatEmail = await asUser(memberA, 'quote_cod_order', {
    p_items: baseOrder.p_items,
    p_email: baseOrder.p_email,
    p_promo_code: null,
    p_redeem_free_reward: false,
  });
  assert.equal(qRepeatEmail.email_discount_applied, false);
  assert.equal(qRepeatEmail.email_discount_already_used, true);
  assert.equal(qRepeatEmail.discount_total, 0);

  // 3. Order Tracking across all 4 required progression stages + privacy check
  assert.equal(
    await asAnon('track_order', {
      p_order_reference: order1.order_reference,
      p_email: 'tarek@example.test',
    }),
    null
  );

  const stageAssertions = [
    ['pending', 1, 'Accepted', 'Order accepted.'],
    ['confirmed', 1, 'Accepted', 'Order accepted.'],
    ['processing', 2, 'Preparing', 'Order is being prepared.'],
    ['ready', 3, 'Ready / Not Shipped', 'Order has not left yet.'],
    ['shipped', 4, 'Out for Delivery', 'Order is on its way.'],
  ];
  for (const [status, expectedStep, expectedLabel, expectedDesc] of stageAssertions) {
    await setOrderStatus(order1.order_id, status);
    const tracked = await asAnon('track_order', {
      p_order_reference: order1.order_reference,
      p_email: 'amina@example.test',
    });
    assert.equal(tracked.status, status);
    assert.equal(tracked.tracking.step, expectedStep);
    assert.equal(tracked.tracking.label, expectedLabel);
    assert.equal(tracked.tracking.description, expectedDesc);
    assert.equal(tracked.tracking.is_completed, false);
  }

  // While shipped (not yet delivered), completed_purchases MUST still be 0!
  assert.equal(
    (await asUser(memberA, 'get_customer_account_overview')).purchase_summary.completed_purchases,
    0
  );

  // Deliver Order 1 -> now completed_purchases = 1!
  await setOrderStatus(order1.order_id, 'delivered');
  const afterDeliver1 = await asUser(memberA, 'get_customer_account_overview');
  assert.equal(afterDeliver1.purchase_summary.completed_purchases, 1);
  assert.equal(afterDeliver1.loyalty.progress_in_cycle, 1);
  assert.equal(afterDeliver1.loyalty.purchases_remaining, 4);

  // Member B still sees 0 orders (strict isolation)
  const memberBOverview = await asUser(memberB, 'get_customer_account_overview');
  assert.equal(memberBOverview.purchase_summary.completed_purchases, 0);
  assert.equal(memberBOverview.orders.length, 0);

  // Cancelled orders NEVER count as completed purchases
  const cancelledOrder = await asUser(memberA, 'create_cod_order', {
    ...baseOrder,
    p_checkout_request_id: crypto.randomUUID(),
    p_redeem_free_reward: false,
  });
  await setOrderStatus(cancelledOrder.order_id, 'cancelled');
  const afterCancel = await asUser(memberA, 'get_customer_account_overview');
  assert.equal(afterCancel.purchase_summary.completed_purchases, 1);
  assert.equal(afterCancel.purchase_summary.total_orders, 2);
  assert.equal(
    afterCancel.orders.find((o) => o.order_reference === cancelledOrder.order_reference)?.is_cancelled,
    true
  );

  // Complete purchases #2 and #3. Under the same-order model, order 3 itself
  // carries the 10% reward at the moment it is placed.
  for (let i = 0; i < 2; i++) {
    const ord = await asUser(memberA, 'create_cod_order', {
      ...baseOrder,
      p_checkout_request_id: crypto.randomUUID(),
      p_redeem_free_reward: false,
    });
    if (i === 1) {
      assert.equal(ord.loyalty_discount_percent, 10);
      assert.equal(ord.loyalty_discount_amount, 245);
    } else {
      assert.equal(ord.loyalty_discount_amount, 0);
    }
    await setOrderStatus(ord.order_id, 'delivered');
  }

  const after3 = await asUser(memberA, 'get_customer_account_overview');
  assert.equal(after3.purchase_summary.completed_purchases, 3);
  assert.equal(after3.loyalty.progress_in_cycle, 3);
  assert.equal(after3.loyalty.purchases_remaining, 2);
  assert.equal(after3.discounts.loyalty_discount_eligible, true);
  assert.equal(after3.discounts.loyalty_discount_percent, 20);
  assert.equal(after3.loyalty.redemption_history.length, 1);

  // Guest typing Amina's email CANNOT spoof a loyalty reward
  const spoofAttempt = await asAnon('quote_cod_order', {
    p_items: baseOrder.p_items,
    p_email: 'amina@example.test',
    p_promo_code: null,
    p_redeem_free_reward: false,
  });
  assert.equal(spoofAttempt.loyalty_discount_applied, false);
  assert.equal(spoofAttempt.discount_total, 0);

  // Non-stacking: a reward and the one-time email discount never combine.
  // Member B's order 3 itself carries 10%; subscribing afterwards still leaves
  // B's order 4 with only the 20% reward, never 20% + 10%.
  for (let i = 0; i < 3; i++) {
    const ordB = await asUser(memberB, 'create_cod_order', {
      ...baseOrder,
      p_full_name: 'Tarek Nabil',
      p_email: 'tarek@example.test',
      p_checkout_request_id: crypto.randomUUID(),
      p_redeem_free_reward: false,
    });
    if (i === 2) {
      assert.equal(ordB.loyalty_discount_percent, 10);
      assert.equal(ordB.loyalty_discount_amount, 245);
    }
    await setOrderStatus(ordB.order_id, 'delivered');
  }
  await anon(db, (tx) =>
    tx.query('insert into newsletter_subscribers(email) values ($1)', ['tarek@example.test'])
  );
  const nonStackQuote = await asUser(memberB, 'quote_cod_order', {
    p_items: baseOrder.p_items,
    p_email: 'tarek@example.test',
    p_promo_code: null,
    p_redeem_free_reward: false,
  });
  assert.equal(nonStackQuote.both_discounts_eligible, true);
  assert.equal(nonStackQuote.loyalty_discount_applied, true);
  assert.equal(nonStackQuote.email_discount_applied, false);
  assert.equal(nonStackQuote.loyalty_discount_percent, 20);
  assert.equal(nonStackQuote.loyalty_discount_amount, 490);
  assert.equal(nonStackQuote.email_discount_amount, 0);
  assert.equal(nonStackQuote.discount_total, 490);

  // B's order 4 keeps only the 20% reward despite the now-available email discount.
  const bOrder4 = await asUser(memberB, 'create_cod_order', {
    ...baseOrder,
    p_full_name: 'Tarek Nabil',
    p_email: 'tarek@example.test',
    p_checkout_request_id: crypto.randomUUID(),
    p_redeem_free_reward: false,
  });
  assert.equal(bOrder4.loyalty_discount_percent, 20);
  assert.equal(bOrder4.loyalty_discount_amount, 490);
  assert.equal(bOrder4.email_discount_amount, 0);
  await setOrderStatus(bOrder4.order_id, 'delivered');

  // Order 4 gets 20% on itself; order 5 gets one free pair of pants on itself.
  const order4 = await asUser(memberA, 'create_cod_order', {
    ...baseOrder,
    p_checkout_request_id: crypto.randomUUID(),
    p_redeem_free_reward: false,
  });
  assert.equal(order4.loyalty_discount_percent, 20);
  assert.equal(order4.loyalty_discount_amount, 490);
  await setOrderStatus(order4.order_id, 'delivered');

  const pantsVariant = (
    await db.query(
      `select v.id from product_variants v join products p on p.id = v.product_id
       where p.slug = 'tws-wide-leg-pants' and v.size_name = 'L'`
    )
  ).rows[0].id;

  // A tee-only bag at milestone 5 is a normal order; the pair stays unlocked.
  const fifthTeeOnly = await asUser(memberA, 'create_cod_order', {
    ...baseOrder,
    p_checkout_request_id: crypto.randomUUID(),
    p_redeem_free_reward: false,
  });
  assert.equal(fifthTeeOnly.loyalty_free_reward_amount, 0);
  assert.equal(fifthTeeOnly.loyalty_discount_amount, 0);
  await setOrderStatus(fifthTeeOnly.order_id, 'delivered');

  const after5 = await asUser(memberA, 'get_customer_account_overview');
  assert.equal(after5.purchase_summary.completed_purchases, 5);
  // The milestone was NOT consumed: the customer is still at 4/5 with the pair open.
  assert.equal(after5.loyalty.qualifying_purchases, 4);
  assert.equal(after5.loyalty.progress_in_cycle, 4);
  assert.equal(after5.loyalty.milestones[4].state, 'next');
  assert.equal(after5.loyalty.next_reward.reward_type, 'free_pants');
  assert.equal(after5.loyalty.redeemed_rewards, 2);
  assert.equal(after5.loyalty.rewards.filter((r) => r.reward_type === 'free_pants').length, 0);

  // Guest typing Member A's email cannot obtain the pair either.
  const guestRedeemAttempt = await asAnon('quote_cod_order', {
    p_items: [...baseOrder.p_items, { variant_id: pantsVariant, quantity: 1 }],
    p_email: 'amina@example.test',
    p_promo_code: null,
  });
  assert.equal(guestRedeemAttempt.free_reward_available, false);
  assert.equal(guestRedeemAttempt.free_reward_applied, false);
  assert.equal(guestRedeemAttempt.free_reward_amount, 0);

  // The very next order WITH pants redeems exactly one pair — however long the wait.
  const mixedBag = [
    { variant_id: variant, quantity: 2 },
    { variant_id: pantsVariant, quantity: 2 },
  ];
  const freeQuote = await asUser(memberA, 'quote_cod_order', {
    p_items: mixedBag,
    p_email: 'amina@example.test',
    p_promo_code: null,
  });
  assert.equal(freeQuote.loyalty_order_seq, 5);
  assert.equal(freeQuote.free_reward_available, true);
  assert.equal(freeQuote.free_reward_amount, 2650);
  assert.equal(freeQuote.free_reward_product_name, 'TWS Wide Leg Pants');
  // 2x2450 + 2x2650 = 10200, minus one pair, free shipping over 3500.
  assert.equal(freeQuote.discount_total, 2650);
  assert.equal(freeQuote.final_total, 7550);

  const ordersBeforeRedeem = (await db.query('select count(*) n from orders')).rows[0].n;
  const redeemedOrder = await asUser(memberA, 'create_cod_order', {
    ...baseOrder,
    p_items: mixedBag,
    p_checkout_request_id: crypto.randomUUID(),
  });
  assert.equal(redeemedOrder.loyalty_free_reward_amount, 2650);
  assert.equal(redeemedOrder.total_amount, 7550);
  assert.equal((await db.query('select count(*) n from orders')).rows[0].n, ordersBeforeRedeem + 1);
  await setOrderStatus(redeemedOrder.order_id, 'delivered');

  const afterRedeem = await asUser(memberA, 'get_customer_account_overview');
  assert.equal(afterRedeem.loyalty.qualifying_purchases, 5);
  assert.equal(afterRedeem.loyalty.progress_in_cycle, 0, 'the cycle resets to order 1');
  assert.equal(afterRedeem.loyalty.milestones[0].state, 'next');
  assert.equal(afterRedeem.loyalty.available_free_pants, 0);
  assert.equal(afterRedeem.loyalty.redemption_history.length, 3);

  // Verify 010 down migration rolls back cleanly and 010 up migration re-applies cleanly
  const { readFile } = await import('node:fs/promises');
  const rollbackDb = await studioDb({ upgrade: true });
  t.after(() => rollbackDb.close());
  await rollbackDb.exec(
    await readFile('supabase/migrations/011_loyalty_rewards_v2.down.sql', 'utf8')
  );
  await rollbackDb.exec(
    await readFile('supabase/migrations/010_account_loyalty_discounts.down.sql', 'utf8')
  );
  await rollbackDb.exec(
    await readFile('supabase/migrations/010_account_loyalty_discounts.sql', 'utf8')
  );
  await rollbackDb.exec(
    await readFile('supabase/migrations/011_loyalty_rewards_v2.sql', 'utf8')
  );
});

