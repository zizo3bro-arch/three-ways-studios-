/** Visual evidence for the customer account and the mobile homepage.
 *
 * Like the other browser suites this runs against the real repository SQL in a
 * disposable PostgreSQL and intercepts only the Supabase HTTP transport, so the
 * screenshots show real server-derived loyalty state — not fixtures baked into
 * the UI.
 *
 * Output: docs/screenshots-account/*.png (committed) and .verify/*.png.
 */
import { test, expect } from '@playwright/test';
import { studioDb, productsQuery, rpc } from './studio-db.mjs';

const ORIGIN = 'https://studio-fixture.invalid';
const MEMBER = { id: crypto.randomUUID(), email: 'amina@example.test', name: 'Amina Saleh' };

let db;
let variantId;

async function seed() {
  const database = await studioDb({ upgrade: true });
  await database.query(`insert into auth.users(id, email, raw_user_meta_data) values ($1,$2,$3::jsonb)`, [
    MEMBER.id,
    MEMBER.email,
    JSON.stringify({ full_name: MEMBER.name }),
  ]);
  variantId = (
    await database.query(
      `update product_variants v set stock_quantity = 60
       from products p where p.id = v.product_id and p.slug = 'tws-signature-tee' and v.size_name = 'L'
       returning v.id`
    )
  ).rows[0].id;
  return database;
}

function session() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  return {
    access_token: 'fixture-access-token',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: expiresAt,
    refresh_token: 'fixture-refresh-token',
    user: {
      id: MEMBER.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: MEMBER.email,
      email_confirmed_at: new Date().toISOString(),
      created_at: '2026-02-14T10:00:00Z',
      updated_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: MEMBER.name },
      identities: [],
    },
  };
}

async function transport(page, database) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataJSON?.() ?? undefined;
    const reply = (status, json) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: json === undefined ? '' : JSON.stringify(json),
      });

    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/user')) return reply(200, session().user);
      if (url.pathname.endsWith('/logout')) return reply(204);
      return reply(200, session());
    }

    const path = url.pathname.replace('/rest/v1/', '');
    try {
      const data = await database.transaction(async (tx) => {
        if (path.startsWith('rpc/')) {
          const name = path.slice(4);
          await tx.exec('set local role authenticated');
          await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER.id]);
          if (name === 'register_customer_account') {
            return (await tx.query('select public.register_customer_account($1) as r', [
              body?.p_full_name ?? null,
            ])).rows[0].r;
          }
          return rpc(tx, name, body ?? {});
        }
        await tx.exec('set local role anon');
        if (path === 'products') {
          return (await tx.query(productsQuery)).rows.map((r) => r.row);
        }
        if (path === 'site_settings') return (await tx.query('select * from site_settings')).rows;
        throw Error(`Unexpected endpoint: ${path}`);
      });
      return reply(200, data);
    } catch (error) {
      return reply(400, { message: error.message, code: error.code });
    }
  });
}

async function placeOrder(database, quantity = 1) {
  const receipt = await database.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [MEMBER.id]);
    return rpc(tx, 'create_cod_order', {
      p_full_name: MEMBER.name,
      p_email: MEMBER.email,
      p_phone: '01012345678',
      p_governorate: 'Cairo',
      p_city: 'Maadi',
      p_address: '15 Road 9, Maadi, Cairo',
      p_notes: '',
      p_promo_code: null,
      p_items: [{ variant_id: variantId, quantity }],
      p_payment_method: 'COD',
      p_checkout_request_id: crypto.randomUUID(),
    });
  });
  return receipt;
}

async function deliver(database, orderId) {
  await database.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
      (await tx.query("select id from admin_users limit 1")).rows[0].id,
    ]);
    await tx.query('select public.admin_update_order_status($1,$2)', [orderId, 'delivered']);
  });
}

test.beforeAll(async () => {
  db = await seed();
  // A staff account is required to perform the manual Delivered step.
  const staffId = crypto.randomUUID();
  await db.query("insert into auth.users(id,email) values ($1,'staff@example.test')", [staffId]);
  await db.query("insert into admin_users(id,email) values ($1,'staff@example.test')", [staffId]);
});

test.afterAll(async () => {
  await db?.close();
});

test('account page: the supplied card, the flip, and 2/5 → 3/5 → 4/5 progression', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
    baseURL: 'http://127.0.0.1:4184',
  });
  await context.addInitScript((value) => {
    window.localStorage.setItem('tws-customer-auth', value);
  }, JSON.stringify(session()));
  const page = await context.newPage();
  await transport(page, db);

  // Two delivered orders → 2/5 with the 10% unlocked for the next order.
  const first = await placeOrder(db);
  await deliver(db, first.order_id);
  const second = await placeOrder(db);
  await deliver(db, second.order_id);

  await page.goto('/account');
  await expect(page.getByTestId('loyalty-card')).toBeVisible();
  await expect(page.getByTestId('loyalty-progress-line')).toContainText('2/5');

  // The card must start on its BACK face, then flip to the front by itself.
  const card = page.getByTestId('loyalty-card-3d');
  await expect(card).toHaveAttribute('data-side', 'back');
  await page.screenshot({ path: '.verify/account-card-back.png', fullPage: false });
  await expect(card).toHaveAttribute('data-side', 'front', { timeout: 6000 });
  await page.screenshot({ path: '.verify/account-card-front.png', fullPage: false });

  await page.screenshot({ path: 'docs/screenshots-account/01-account-desktop.png', fullPage: true });

  // 3/5 — the 20% is unlocked.
  const third = await placeOrder(db);
  await deliver(db, third.order_id);
  await page.reload();
  await expect(page.getByTestId('loyalty-progress-line')).toContainText('3/5');
  await expect(page.getByTestId('loyalty-remaining-copy')).toContainText('20% off');
  await page.screenshot({ path: 'docs/screenshots-account/02-account-3-of-5.png', fullPage: true });

  // 4/5 — the free pair is unlocked immediately after the fourth delivery.
  const fourth = await placeOrder(db);
  await deliver(db, fourth.order_id);
  await page.reload();
  await expect(page.getByTestId('loyalty-progress-line')).toContainText('4/5');
  await expect(page.getByTestId('loyalty-unlocked-banner')).toBeVisible();
  await expect(page.getByTestId('loyalty-unlocked-banner')).toContainText('never expires');
  // Circle five is the reward, not another checkmark.
  await expect(page.getByTestId('loyalty-circle-5')).toHaveClass(/is-ready/);
  await page.screenshot({ path: 'docs/screenshots-account/03-account-4-of-5.png', fullPage: true });
  await page.screenshot({ path: '.verify/account-4-of-5-card.png' });

  // Tapping flips it back and forth on demand.
  await page.getByTestId('loyalty-card-label').click();
  await expect(card).toHaveAttribute('data-side', 'back');
  await page.getByTestId('loyalty-card-label').click();
  await expect(card).toHaveAttribute('data-side', 'front');

  await context.close();
});

test('account page on mobile', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'no-preference',
    baseURL: 'http://127.0.0.1:4184',
  });
  await context.addInitScript(
    (value) => window.localStorage.setItem('tws-customer-auth', value),
    JSON.stringify(session())
  );
  const page = await context.newPage();
  await transport(page, db);
  await page.goto('/account');
  await expect(page.getByTestId('loyalty-progress-line')).toContainText('4/5');
  await expect(page.getByTestId('loyalty-card-3d')).toHaveAttribute('data-side', 'front', {
    timeout: 6000,
  });
  await page.screenshot({ path: 'docs/screenshots-account/04-account-mobile.png', fullPage: true });
  await page.screenshot({ path: '.verify/account-mobile-card.png' });

  // The flip works with a tap on touch too.
  await page.getByTestId('loyalty-card-label').tap();
  await expect(page.getByTestId('loyalty-card-3d')).toHaveAttribute('data-side', 'back');
  await page.screenshot({ path: '.verify/account-mobile-card-back.png' });
  await context.close();
});

test('mobile homepage: hero height and garment plate size', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    baseURL: 'http://127.0.0.1:4184',
  });
  const page = await context.newPage();
  await transport(page, db);
  await page.goto('/');
  await expect(page.locator('.product-grid')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots-account/05-home-mobile.png', fullPage: false });
  await page.screenshot({ path: '.verify/home-mobile-full.png', fullPage: true });

  const hero = await page.locator('.campaign').boundingBox();
  const plates = await page.locator('.plate-photo').first().boundingBox();
  const images = await page.locator('.plate-photo img').first().boundingBox();
  // The hero is the immersive first screen; the garment fills most of its plate.
  expect(hero.height).toBeGreaterThan(620);
  expect(plates.height).toBeGreaterThan(240);
  expect(images.height / plates.height).toBeGreaterThan(0.95);
  expect(images.width / plates.width).toBeGreaterThan(0.68);

  await context.close();
});
