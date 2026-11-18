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
  assert.equal((await call('create_cod_order', legacy)).payment_method, 'COD');
  await anon(db, (tx) =>
    tx.query('insert into newsletter_subscribers(email) values($1)', ['news@example.test'])
  );
  await assert.rejects(
    anon(db, (tx) =>
      tx.query('insert into newsletter_subscribers(email) values($1)', ['news@example.test'])
    ),
    (e) => e.code === '23505'
  );
  assert.equal((await db.query('select count(*) n from newsletter_subscribers')).rows[0].n, 1);
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
