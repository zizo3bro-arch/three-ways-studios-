/** Disposable PostgreSQL, never imported by the app. Only the Supabase-owned
 * auth/storage schemas and the HTTP transport are test scaffolding; policies,
 * tables, discount rules, transactions and receipts are the repository SQL. */
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

export async function studioDb({ upgrade = false, legacyCheckout = false } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(
      id uuid primary key,
      email text,
      encrypted_password text,
      confirmation_token text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      deleted_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text); alter table storage.objects enable row level security;
    alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`);
  const run = async (path) => db.exec(await readFile(`supabase/${path}`, 'utf8'));
  if (upgrade || legacyCheckout) {
    for (const f of [
      '001_schema',
      '002_rls_policies',
      '003_functions_and_storage',
      '004_initial_config',
    ])
      await run(`migrations/${f}.sql`);
  } else await run('full_setup.sql');
  await run('migrations/006_admin_hardening_safe.sql');
  if (upgrade && !legacyCheckout) await run('migrations/007_cod_checkout.sql');
  await run('migrations/008_registered_customers.sql');
  if (!legacyCheckout) {
    await run('migrations/009_checkout_idempotency.sql');
    await run('migrations/010_account_loyalty_discounts.sql');
    await run('migrations/011_loyalty_rewards_v2.sql');
    await run('migrations/012_loyalty_delivery_unlock.sql');
    await run('migrations/013_console_operations.sql');
  }
  await run('migrations/014_email_notifications.sql');
  const catalog = [
    [
      'TWS Signature Tee',
      'tws-signature-tee',
      2450,
      ['signature-tee', 'signature-back', 'signature-detail', 'fabric-detail'],
    ],
    ['TWS Cross Tee', 'tws-cross-tee', 2450, ['cross-tee']],
    ['TWS Wide Leg Pants', 'tws-wide-leg-pants', 2650, ['wide-leg-pants']],
    ['TWS Hoodie', 'tws-hoodie', 2650, ['hoodie']],
  ];
  for (const [i, [name, slug, price, photos]] of catalog.entries()) {
    const { id } = (
      await db.query(
        `insert into products(name,slug,price,is_published,is_new_arrival,description,collection_name,sort_order,category) values($1,$2,$3,true,true,$4,'2026 Collection',$5,$6) returning id`,
        [
          name,
          slug,
          price,
          'Premium oversized fit. Signature Three Ways Studios design with high-quality fabric.',
          i,
          i === 2 ? 'Pants' : 'Streetwear',
        ]
      )
    ).rows[0];
    for (const [j, img] of photos.entries())
      await db.query(
        `insert into product_images(product_id,url,alt_text,display_order,is_primary) values($1,$2,$3,$4,$5)`,
        [id, `/media/campaign/${img}.webp`, `${name}, view ${j + 1}`, j, j === 0]
      );
    for (const size of ['S', 'M', 'L', 'XL', 'XXL'])
      await db.query(
        `insert into product_variants(product_id,color_name,size_name,stock_quantity) values($1,$2,$3,$4)`,
        [id, i === 1 ? 'Ivory' : 'Black', size, size === 'XXL' ? 0 : 8]
      );
    if (i === 0) {
      await db.query(
        `insert into product_variants(product_id,color_name,size_name,stock_quantity) values($1,'Charcoal','M',2)`,
        [id]
      );
      await db.query(
        `insert into size_charts(product_id,size_name,waist_cm,weight_min_kg,weight_max_kg,height_min_cm,height_max_cm) values($1,'M','82',61,77,163,183)`,
        [id]
      );
    }
  }
  return db;
}
export const anon = (db, fn) =>
  db.transaction(async (tx) => {
    await tx.exec('set local role anon');
    return fn(tx);
  });
export const productsQuery = `select to_jsonb(p) || jsonb_build_object('images',(select jsonb_agg(i order by display_order) from product_images i where i.product_id=p.id),'variants',(select jsonb_agg(v order by size_name) from product_variants v where v.product_id=p.id),'size_charts',(select jsonb_agg(c) from size_charts c where c.product_id=p.id)) as row from products p where is_published order by sort_order`;
export const quoteArgs = ['p_items', 'p_email', 'p_promo_code'];
export const orderArgs = [
  'p_full_name',
  'p_email',
  'p_phone',
  'p_governorate',
  'p_city',
  'p_address',
  'p_notes',
  'p_items',
  'p_promo_code',
];
export async function rpc(tx, name, body = {}) {
  const keys =
    name === 'quote_cod_order'
      ? [...quoteArgs, ...('p_redeem_free_reward' in body ? ['p_redeem_free_reward'] : [])]
      : name === 'get_order_confirmation' || name === 'track_order'
        ? ['p_order_reference', 'p_email']
        : name === 'get_customer_account_overview' || name === 'loyalty_program_preview'
          ? []
          : name === 'admin_customer_profile'
            ? ['p_auth_user_id']
            : name === 'admin_adjust_stock'
              ? ['p_variant_id', 'p_delta', 'p_reason', ...('p_note' in body ? ['p_note'] : [])]
              : name === 'admin_add_order_note'
                ? ['p_order_id', 'p_body']
                : name === 'admin_record_refund'
                  ? ['p_order_id', 'p_amount', 'p_reason']
                  : name === 'admin_order_activity'
                  ? ['p_order_id']
                  : name === 'admin_list_stock_movements'
                    ? [...('p_limit' in body ? ['p_limit'] : [])]
                    : name === 'admin_update_order_status'
                      ? ['p_order_id', 'p_new_status']
                      : name === 'admin_loyalty_program_history'
            ? ['p_limit']
            : name === 'admin_update_loyalty_program'
              ? [
                  'p_milestone_3_percent',
                  'p_milestone_4_percent',
                  'p_effective_from',
                  'p_reason',
                ]
          : name === 'create_cod_order'
            ? [
                ...orderArgs,
                ...('p_payment_method' in body ? ['p_payment_method'] : []),
                ...('p_checkout_request_id' in body ? ['p_checkout_request_id'] : []),
                ...('p_redeem_free_reward' in body ? ['p_redeem_free_reward'] : []),
              ]
            : null;
  if (!keys || keys.some((k) => !(k in body)) || keys.length !== Object.keys(body).length)
    throw Error('Unexpected RPC signature');
  if (!keys.length) {
    const result = await tx.query(`select public.${name}() as result`);
    return result.rows[0].result;
  }
  const types = {
    p_items: 'jsonb',
    p_checkout_request_id: 'uuid',
    p_redeem_free_reward: 'boolean',
    p_milestone_3_percent: 'numeric',
    p_milestone_4_percent: 'numeric',
    p_effective_from: 'timestamptz',
    p_limit: 'integer',
    p_auth_user_id: 'uuid',
    p_variant_id: 'uuid',
    p_delta: 'integer',
    p_allow_negative: 'boolean',
    p_order_id: 'uuid',
    p_amount: 'numeric',
  };
  const params = keys.map((k, i) => `${k} => $${i + 1}::${types[k] || 'text'}`).join(',');
  const result = await tx.query(
    `select public.${name}(${params}) as result`,
    keys.map((k) => (k === 'p_items' ? JSON.stringify(body[k]) : body[k]))
  );
  return result.rows[0].result;
}
