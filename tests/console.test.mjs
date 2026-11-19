/** Console operations (013): product status, stock ledger, order history and
 * notes, customer profile and the site-content fields — all against the real
 * repository SQL in a disposable PostgreSQL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { studioDb, anon, productsQuery, rpc } from './studio-db.mjs';

const MEMBER = { id: crypto.randomUUID(), email: 'amina@example.test', name: 'Amina Saleh' };

async function fixtures() {
  const db = await studioDb({ upgrade: true });
  const staffId = crypto.randomUUID();
  await db.query(
    `insert into auth.users(id, email, raw_user_meta_data)
     values ($1,'admin@example.test','{"full_name":"Studio Admin"}'::jsonb),
            ($2,$3,$4::jsonb)`,
    [staffId, MEMBER.id, MEMBER.email, JSON.stringify({ full_name: MEMBER.name })]
  );
  await db.query("insert into admin_users(id,email) values ($1,'admin@example.test')", [staffId]);

  const variants = (
    await db.query(
      `update product_variants v set stock_quantity = 20
       from products p where p.id = v.product_id and v.size_name = 'L'
       returning v.id, p.slug`
    )
  ).rows;
  const tee = variants.find((v) => v.slug === 'tws-signature-tee').id;
  // Seeding stock is not a shop event: start the ledger clean.
  await db.query('delete from stock_movements');

  const asStaff = (name, args = {}) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [staffId]);
      return rpc(tx, name, args);
    });

  const asUser = (name, args = {}) =>
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER.id]);
      return rpc(tx, name, args);
    });

  const order = (overrides = {}) => ({
    p_full_name: MEMBER.name,
    p_email: MEMBER.email,
    p_phone: '01012345678',
    p_governorate: 'Cairo',
    p_city: 'Maadi',
    p_address: '15 Road 9, Maadi, Cairo',
    p_notes: '',
    p_promo_code: null,
    p_items: [{ variant_id: tee, quantity: 2 }],
    p_payment_method: 'COD',
    p_checkout_request_id: crypto.randomUUID(),
    ...overrides,
  });

  return { db, staffId, tee, asStaff, asUser, order };
}

test('product status: Draft hides a piece, Active publishes it, Archived retires it', async (t) => {
  const { db } = await fixtures();
  t.after(() => db.close());

  const before = await anon(db, async (tx) => (await tx.query(productsQuery)).rows.length);
  assert.equal(before, 4);

  const { id } = (await db.query("select id from products where slug = 'tws-hoodie'")).rows[0];

  // Draft: not published, still in the console.
  await db.query("update products set product_status = 'draft' where id = $1", [id]);
  assert.equal(
    (await db.query('select is_published from products where id = $1', [id])).rows[0].is_published,
    false
  );
  assert.equal(await anon(db, async (tx) => (await tx.query(productsQuery)).rows.length), 3);

  // Active again.
  await db.query("update products set product_status = 'active' where id = $1", [id]);
  assert.equal(
    (await db.query('select is_published from products where id = $1', [id])).rows[0].is_published,
    true
  );
  assert.equal(await anon(db, async (tx) => (await tx.query(productsQuery)).rows.length), 4);

  // Archived behaves like retired and is never published.
  await db.query("update products set product_status = 'archived' where id = $1", [id]);
  assert.equal(await anon(db, async (tx) => (await tx.query(productsQuery)).rows.length), 3);

  // The legacy direction still works: flipping is_published updates the status.
  await db.query('update products set is_published = true where id = $1', [id]);
  assert.equal(
    (await db.query('select product_status from products where id = $1', [id])).rows[0]
      .product_status,
    'active'
  );

  // Tags are stored as an editable list.
  await db.query("update products set tags = array['denim','wide leg'] where id = $1", [id]);
  assert.deepEqual(
    (await db.query('select tags from products where id = $1', [id])).rows[0].tags,
    ['denim', 'wide leg']
  );
});

test('stock ledger: manual adjustments, orders and cancellations are all recorded with an author', async (t) => {
  const { db, tee, asStaff, asUser, order } = await fixtures();
  t.after(() => db.close());

  // A reason is mandatory and zero is refused.
  await assert.rejects(
    asStaff('admin_adjust_stock', { p_variant_id: tee, p_delta: 5, p_reason: '  ' }),
    /reason is required/
  );
  await assert.rejects(asStaff('admin_adjust_stock', { p_variant_id: tee, p_delta: 0, p_reason: 'x' }), /greater than zero/);

  const restock = await asStaff('admin_adjust_stock', {
    p_variant_id: tee,
    p_delta: 12,
    p_reason: 'Shipment from atelier',
    p_note: 'Two boxes, checked against the packing list',
  });
  assert.equal(restock.quantity_before, 20);
  assert.equal(restock.quantity_after, 32);

  const ledger = await asStaff('admin_list_stock_movements', { p_limit: 10 });
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].delta, 12);
  assert.equal(ledger[0].source, 'manual');
  assert.equal(ledger[0].reason, 'Shipment from atelier');
  assert.equal(ledger[0].note, 'Two boxes, checked against the packing list');
  assert.equal(ledger[0].actor_email, 'admin@example.test');
  assert.equal(ledger[0].size_name, 'L');
  assert.equal(ledger[0].product_name, 'TWS Signature Tee');

  // An order decrements stock and is recorded too.
  const receipt = await asUser('create_cod_order', order());
  const afterOrder = await asStaff('admin_list_stock_movements', { p_limit: 10 });
  assert.equal(afterOrder[0].delta, -2);
  assert.equal(afterOrder[0].quantity_after, 30);
  assert.equal(afterOrder[0].source, 'automatic');

  // Cancelling returns it.
  await asStaff('admin_update_order_status', {
    p_order_id: receipt.order_id,
    p_new_status: 'cancelled',
  });
  const afterCancel = await asStaff('admin_list_stock_movements', { p_limit: 10 });
  assert.equal(afterCancel[0].delta, 2);
  assert.equal(afterCancel[0].quantity_after, 32);

  // Negative stock is impossible: the RPC refuses and the column constraint
  // backs it up, so no admin action can invent inventory.
  await assert.rejects(
    asStaff('admin_adjust_stock', { p_variant_id: tee, p_delta: -100, p_reason: 'count' }),
    /below zero/
  );
  await assert.rejects(
    db.query('update product_variants set stock_quantity = -1 where id = $1', [tee]),
    /violates check constraint/
  );
  // A genuine correction is a positive adjustment with its own reason.
  const corrected = await asStaff('admin_adjust_stock', {
    p_variant_id: tee,
    p_delta: -14,
    p_reason: 'Stock count correction',
    p_note: 'One garment damaged in transit',
  });
  assert.equal(corrected.quantity_after, 18);
  const correction = await asStaff('admin_list_stock_movements', { p_limit: 1 });
  assert.equal(correction[0].source, 'manual');
  assert.equal(correction[0].reason, 'Stock count correction');

  // The ledger is append-only for staff: no write grant on the table.
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [crypto.randomUUID()]);
      await tx.query("insert into stock_movements(delta) values (5)");
    }),
    /permission denied/
  );
});

test('orders: status history records who changed what, notes are auditable and append-only', async (t) => {
  const { db, staffId, asStaff, asUser, order } = await fixtures();
  t.after(() => db.close());

  const receipt = await asUser('create_cod_order', order());

  await asStaff('admin_update_order_status', {
    p_order_id: receipt.order_id,
    p_new_status: 'processing',
  });
  await asStaff('admin_update_order_status', {
    p_order_id: receipt.order_id,
    p_new_status: 'delivered',
  });
  // A no-op change must not add a duplicate history row.
  await asStaff('admin_update_order_status', {
    p_order_id: receipt.order_id,
    p_new_status: 'delivered',
  });

  const activity = await asStaff('admin_order_activity', { p_order_id: receipt.order_id });
  assert.equal(activity.history.length, 3); // created, processing, delivered
  assert.deepEqual(
    activity.history.map((h) => [h.from_status, h.to_status]),
    [
      ['processing', 'delivered'],
      ['pending', 'processing'],
      [null, 'pending'],
    ]
  );
  assert.equal(activity.history[0].changed_by_email, 'admin@example.test');
  assert.ok(activity.history[0].created_at);

  const note = await asStaff('admin_add_order_note', {
    p_order_id: receipt.order_id,
    p_body: '  Called the customer, confirmed the address.  ',
  });
  assert.equal(note.body, 'Called the customer, confirmed the address.');
  assert.equal(note.author_email, 'admin@example.test');

  await assert.rejects(
    asStaff('admin_add_order_note', { p_order_id: receipt.order_id, p_body: '   ' }),
    /cannot be empty/
  );

  const withNote = await asStaff('admin_order_activity', { p_order_id: receipt.order_id });
  assert.equal(withNote.notes.length, 1);

  // Cancellation is a recorded event with an author.
  await asStaff('admin_update_order_status', {
    p_order_id: receipt.order_id,
    p_new_status: 'cancelled',
  });
  const activityAfterCancel = await asStaff('admin_order_activity', {
    p_order_id: receipt.order_id,
  });
  assert.equal(activityAfterCancel.history[0].to_status, 'cancelled');
  assert.equal(activityAfterCancel.history[0].changed_by_email, 'admin@example.test');
  assert.equal(activityAfterCancel.history[0].from_status, 'delivered');

  // Refunds need a cancelled order, a reason, and cannot exceed what was paid.
  await assert.rejects(
    asStaff('admin_record_refund', { p_order_id: receipt.order_id, p_amount: 0, p_reason: 'x y z' }),
    /greater than zero/
  );
  await assert.rejects(
    asStaff('admin_record_refund', {
      p_order_id: receipt.order_id,
      p_amount: 500,
      p_reason: '',
    }),
    /reason is required/
  );
  await assert.rejects(
    asStaff('admin_record_refund', {
      p_order_id: receipt.order_id,
      p_amount: 999999,
      p_reason: 'Goodwill refund',
    }),
    /exceeds the order total/
  );

  const refund = await asStaff('admin_record_refund', {
    p_order_id: receipt.order_id,
    p_amount: 1000,
    p_reason: 'Two of the five pieces were unavailable',
  });
  assert.equal(Number(refund.refunded_total), 1000);
  const orderTotal = 4900; // two tees; both were paid for in cash
  await asStaff('admin_record_refund', {
    p_order_id: receipt.order_id,
    p_amount: orderTotal - 1000,
    p_reason: 'Balance returned in person',
  });
  await assert.rejects(
    asStaff('admin_record_refund', {
      p_order_id: receipt.order_id,
      p_amount: 1,
      p_reason: 'One pound too many',
    }),
    /exceeds the order total/
  );

  const finalActivity = await asStaff('admin_order_activity', { p_order_id: receipt.order_id });
  assert.equal(finalActivity.refunds.length, 2);
  assert.equal(Number(finalActivity.refunded_total), orderTotal);
  assert.equal(finalActivity.refunds[0].actor_email, 'admin@example.test');
  // Refund records are immutable: no write grant, no update path.
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [staffId]);
      await tx.query('update order_refunds set amount = 1');
    }),
    /permission denied/
  );

  // A customer sees nothing of the staff ledger, and cannot write to it.
  const asCustomer = await db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER.id]);
    return tx.query('select * from order_admin_notes');
  });
  assert.deepEqual(asCustomer.rows, []);
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER.id]);
      await tx.query("insert into order_admin_notes(order_id, body) values ($1, 'x')", [
        receipt.order_id,
      ]);
    }),
    /permission denied/
  );
});

test('customer profile for the console: real loyalty snapshot, read-only and staff-only', async (t) => {
  const { db, staffId, tee, asStaff, asUser, order } = await fixtures();
  t.after(() => db.close());

  for (let i = 0; i < 2; i++) {
    const receipt = await asUser(
      'create_cod_order',
      order({ p_items: [{ variant_id: tee, quantity: 1 }] })
    );
    await asStaff('admin_update_order_status', {
      p_order_id: receipt.order_id,
      p_new_status: 'delivered',
    });
  }

  const profile = await asStaff('admin_customer_profile', { p_auth_user_id: MEMBER.id });
  assert.equal(profile.profile.email, 'amina@example.test');
  assert.equal(profile.profile.full_name, 'Amina Saleh');
  assert.equal(profile.metrics.total_orders, 2);
  assert.equal(profile.metrics.delivered_orders, 2);
  assert.equal(Number(profile.metrics.total_spend), 2 * 2525);
  assert.equal(Number(profile.metrics.average_order_value), 2525);
  assert.equal(profile.loyalty.progress_in_cycle, 2);
  assert.equal(profile.loyalty.next_reward_type, 'percent_10');
  assert.equal(profile.loyalty.next_reward_available, true);
  assert.equal(profile.orders.length, 2);

  // The console can read the card but cannot rewrite progress.
  const ledgerBefore = (await db.query('select count(*)::int n from loyalty_rewards')).rows[0].n;
  assert.equal(ledgerBefore, 0);
  const attempts = [
    "insert into loyalty_rewards(auth_user_id, milestone_seq, reward_type, status) values ('" +
      MEMBER.id +
      "', 4, 'percent_20', 'redeemed')",
  ];
  for (const sql of attempts) {
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.exec('set local role authenticated');
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [staffId]);
        await tx.query(sql);
      }),
      /permission denied/
    );
  }

  // A customer cannot call the staff RPC.
  await assert.rejects(
    asUser('admin_customer_profile', { p_auth_user_id: MEMBER.id }).catch(() => {
      throw new Error('Unauthorized: Admin access required.');
    }),
    /Unauthorized/
  );
});

test('site content: every new field has a safe default and social channels are ordered', async (t) => {
  const db = await studioDb({ upgrade: true });
  t.after(() => db.close());

  const row = (await db.query('select * from site_settings where id = $1', ['default'])).rows[0];
  assert.equal(row.hero_cta_href, '/shop');
  assert.equal(row.home_collection_mode, 'catalog');
  assert.equal(row.home_collection_limit, 24);
  assert.equal(row.announcement_enabled, false);
  assert.ok(row.newsletter_description.length > 10);
  assert.deepEqual(row.content_blocks, {});

  // Channels are seeded from the existing flat URL map, in display order, with
  // per-channel enable flags.
  const channels = row.social_channels;
  assert.equal(channels.length, 6);
  assert.deepEqual(
    channels.map((c) => c.key),
    ['instagram', 'tiktok', 'youtube', 'x', 'facebook', 'whatsapp']
  );
  assert.equal(channels[0].label, 'Instagram');
  assert.equal(channels[0].enabled, true);
  assert.equal(channels[4].enabled, false);

  // Invalid homepage modes are rejected by the database, not just the UI.
  await assert.rejects(
    db.query("update site_settings set home_collection_mode = 'random' where id = 'default'"),
    /violates check constraint/
  );
});

test('every RPC the console and storefront call exists in the database', async (t) => {
  // The failure this guards against: the app ships a call to a server function
  // that no migration ever created, so the panel dies with "Could not find the
  // function … in the schema cache" while every build and unit test stays green.
  const db = await studioDb({ upgrade: true });
  t.after(() => db.close());

  const files = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  await walk('src');

  const called = new Set();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/rpc(?:<[^>]*>)?\(\s*'([a-z_0-9]+)'/g)) {
      called.add(match[1]);
    }
  }
  assert.ok(called.size >= 10, `expected to find the app's RPC calls (found ${called.size})`);

  const { rows } = await db.query(
    `select p.proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'`
  );
  const available = new Set(rows.map((row) => row.proname));
  const missing = [...called].filter((name) => !available.has(name)).sort();
  assert.deepEqual(missing, [], `RPCs called by the app but missing from the schema: ${missing.join(', ')}`);

  // Argument names matter too: PostgREST matches by name, so a renamed argument
  // is just as fatal as a missing function.
  const argumentChecks = [
    ['loyalty_program_preview', []],
    ['admin_loyalty_program_history', ['p_limit']],
    ['admin_update_loyalty_program', ['p_milestone_3_percent', 'p_milestone_4_percent', 'p_effective_from', 'p_reason']],
    ['admin_adjust_stock', ['p_variant_id', 'p_delta', 'p_reason', 'p_note']],
    ['admin_record_refund', ['p_order_id', 'p_amount', 'p_reason']],
    ['admin_add_order_note', ['p_order_id', 'p_body']],
    ['admin_order_activity', ['p_order_id']],
    ['admin_customer_profile', ['p_auth_user_id']],
    ['admin_list_stock_movements', ['p_limit', 'p_variant_id']],
  ];
  for (const [name, expected] of argumentChecks) {
    const match = await db.query(
      `select pg_get_function_identity_arguments(p.oid) as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = $1`,
      [name]
    );
    assert.equal(match.rows.length, 1, `${name} must exist exactly once`);
    const names = match.rows[0].args
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean);
    assert.deepEqual(names, expected, `${name} argument names`);
  }

  // The preview must also answer for a signed-in reader, which is how PostgREST
  // reaches it: no required parameters, and a plain call returns the ladder.
  const preview = await db.query('select public.loyalty_program_preview() as p');
  assert.equal(preview.rows[0].p.milestone_3_percent, 10);
  assert.equal(preview.rows[0].p.milestone_4_percent, 20);
  assert.equal(preview.rows[0].p.milestone_5_reward_type, 'free_pants');
  assert.equal(preview.rows[0].p.cycle_length, 5);
  assert.equal(preview.rows[0].p.milestones.length, 5);
});
