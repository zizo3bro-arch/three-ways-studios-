import { test, expect } from '@playwright/test';
import { studioDb, anon, productsQuery, rpc } from './studio-db.mjs';

let db;
test.beforeAll(async () => {
  db = await studioDb();
});
test.afterAll(async () => {
  await db?.close();
});
// Only HTTP routing is substituted. Each confirmed order and subscription
// below can be read back independently from a fresh SQL query.
async function transport(page) {
  const log = [];
  await page.route('https://studio-fixture.invalid/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace('/rest/v1/', '');
    const body = req.postDataJSON();
    log.push({ path, body });
    const reply = (status, json) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: json === undefined ? '' : JSON.stringify(json),
      });
    try {
      const data = await anon(db, async (tx) => {
        if (path === 'products') {
          expect(url.searchParams.get('is_published')).toBe('eq.true');
          const slug = url.searchParams.get('slug')?.slice(3);
          if (slug) expect(url.searchParams.get('select')).toContain('size_charts(*)');
          return (await tx.query(productsQuery)).rows
            .map((r) => r.row)
            .filter((p) => !slug || p.slug === slug);
        }
        if (path === 'site_settings') return (await tx.query('select * from site_settings')).rows;
        if (path === 'newsletter_subscribers' && req.method() === 'POST') {
          await tx.query('insert into newsletter_subscribers(email) values($1)', [body.email]);
          return;
        }
        if (path.startsWith('rpc/')) return rpc(tx, path.slice(4), body);
        throw Error(`Unexpected endpoint: ${path}`);
      });
      await reply(path === 'newsletter_subscribers' ? 201 : 200, data);
    } catch (e) {
      await reply(e.code === '23505' ? 409 : 400, { message: e.message, code: e.code });
    }
  });
  return log;
}
const routePiece = '/product/tws-signature-tee';
const shot = (page, name) => page.screenshot({ path: `.verify/${name}.png`, fullPage: true });

// Synthesize actual Chromium touch input, not a JavaScript scrollLeft change.
async function drag(page, x, y, dx, dy) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await send('touchStart', x, y);
  for (let i = 1; i <= 12; i++) {
    await send('touchMove', x + (dx * i) / 12, y + (dy * i) / 12);
    await new Promise((r) => setTimeout(r, 22));
  }
  await send('touchEnd');
  await cdp.detach();
}
test('touch gallery: both directions, vertical scroll, tap, all real frames', async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 660 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await transport(page);
  await page.goto(routePiece);
  const rail = page.locator('.gallery-rail');
  await expect(rail.locator('img')).toHaveCount(4);
  const thumb = page.locator('.gallery-thumbs button');
  await expect(thumb.nth(0)).toHaveAttribute('aria-pressed', 'true');
  const box = await rail.boundingBox();
  const y = box.y + box.height * 0.55;
  await page.touchscreen.tap(190, y);
  await expect(thumb.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await drag(page, 300, y, -232, 4);
  await expect(thumb.nth(1)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
  await drag(page, 70, y, 235, -3);
  await expect(thumb.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await drag(page, 180, y, 4, -137);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(35);
  await expect(thumb.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await ctx.close();
});
test('cart, persisted COD order, failed writes, receipt, newsletter and customer account', async ({
  page,
}) => {
  const log = await transport(page);
  await page.goto('/');
  const email = `list-${Date.now()}@example.test`;
  await page.locator('#studio-email').fill(email);
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await expect(page.getByText('You’re on the list.', { exact: false })).toBeVisible();
  expect(
    (await db.query('select email from newsletter_subscribers where email=$1', [email])).rows
  ).toHaveLength(1);
  await page.locator('#studio-email').fill(email);
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await expect(page.getByText('This address is already on the studio list.')).toBeVisible();
  await page.route('**/newsletter_subscribers', (r) =>
    r.fulfill({ status: 503, json: { message: 'Service unavailable' } })
  );
  await page.locator('#studio-email').fill('failed@example.test');
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Subscription not confirmed');
  await page.goto(routePiece);
  await page.getByRole('button', { name: 'Next product image' }).click();
  await expect(page.locator('.gallery-pager')).toContainText('2 / 4');
  await page.getByRole('button', { name: /View image 4:/ }).click();
  await expect(page.locator('.gallery-pager')).toContainText('4 / 4');
  await page.getByRole('button', { name: 'Size guide', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Size guide' })).toContainText('82');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Charcoal', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Available sizes' }).getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.getByRole('button', { name: 'L', exact: true }).click();
  await expect(page.getByRole('button', { name: 'XXL', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save piece', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  const bag = page.getByRole('dialog', { name: 'Shopping bag' });
  await expect(bag).toContainText('Size: L · Black');
  await bag.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(bag.locator('.cart-total')).toContainText('4,900');
  await bag.getByRole('button', { name: /Decrease quantity/ }).click();
  await bag.getByRole('link', { name: 'View full cart' }).click();
  await page.reload();
  await expect(page.locator('.cart-lines li')).toHaveCount(1);
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  const radio = page.getByRole('radio');
  await expect(radio).toHaveCount(1);
  await expect(radio).toBeChecked();
  await page.getByText('Pay the courier in cash when your order arrives.').click();
  await expect(radio).toBeFocused();
  await page.getByLabel('Full name').fill('Fixture Buyer');
  await page.getByLabel('Phone number').fill('+20 101 234 5678');
  await page.getByLabel('Email address', { exact: true }).fill('buyer@example.test');
  await page.getByLabel('City / district').fill('Cairo');
  await page.getByLabel('Complete address').fill('42 Test Street, floor 2');
  await expect(page.locator('.cart-total')).toContainText('2,280');
  const creation = '**/rpc/create_cod_order';
  await page.route(creation, (r) =>
    r.fulfill({ status: 500, json: { message: 'Transaction not confirmed' } })
  );
  const confirm = page.getByRole('button', { name: 'Confirm COD order' });
  await confirm.click();
  await expect(page.getByRole('alert')).toContainText('Transaction not confirmed');
  expect(page.url()).toContain('/checkout');
  expect((await db.query('select count(*) n from orders')).rows[0].n).toBe(0);
  await page.unroute(creation);
  await confirm.click();
  await expect(page.getByRole('heading', { name: /Thank you/ })).toBeVisible();
  expect(log.find((r) => r.path === 'rpc/create_cod_order')?.body.p_payment_method).toBe('COD');
  const {
    rows: [order],
  } = await db.query('select total_amount,payment_method,order_reference from orders');
  expect(Number(order.total_amount)).toBe(2280);
  expect(order.payment_method).toBe('COD');
  expect(page.url()).toContain(order.order_reference);
  await page.getByRole('button', { name: 'Your customer account' }).click();
  const account = page.getByRole('dialog', { name: 'Account', exact: true });
  await expect(account).toContainText('TWS Signature Tee');
  await expect(account.locator('a[href^="/admin"]')).toHaveCount(0);
  await account.getByLabel('Reference').fill(order.order_reference);
  await account.getByLabel('Email on the order').fill('buyer@example.test');
  await account.getByRole('button', { name: 'Find my order' }).click();
  await expect(account.getByRole('link', { name: 'Open confirmation' })).toBeVisible();
});
test('errors never replace catalog or quote with invented items, stock or receipts', async ({
  page,
}) => {
  await transport(page);
  await page.goto(routePiece);
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.route('**/rpc/quote_cod_order', (r) =>
    r.fulfill({ status: 503, json: { message: 'Inventory unavailable' } })
  );
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  await expect(page.getByRole('alert')).toContainText('Inventory unavailable');
  await expect(page.getByRole('button', { name: 'Confirm COD order' })).toBeDisabled();
  await page.getByRole('link', { name: 'Edit cart', exact: true }).first().click();
  await page.getByRole('button', { name: 'Remove TWS Signature Tee', exact: true }).click();
  await expect(page.getByText('Your bag is empty.')).toBeVisible();
  await page.route(/\/rest\/v1\/products\?/, (r) =>
    r.fulfill({ status: 400, json: { message: 'Collection unavailable' } })
  );
  await page.goto('/shop');
  await expect(page.getByRole('alert')).toContainText('Collection unavailable');
  await expect(page.locator('.product-plate')).toHaveCount(0);
  await page.evaluate(() =>
    sessionStorage.setItem('tws_order_FAKE', JSON.stringify({ order_reference: 'FAKE' }))
  );
  await page.goto('/order-confirmation/FAKE');
  await expect(page.getByRole('button', { name: 'Open the receipt' })).toBeVisible();
});
test('all routes, account boundary, responsive grid and no horizontal document overflow', async ({
  page,
}) => {
  await transport(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [320, 360, 375, 390, 430, 724, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 1000 });
    for (const path of ['/', routePiece, '/cart', '/checkout']) {
      await page.goto(path);
      await page.locator('main h1').first().waitFor({ state: 'attached' });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${width} ${path}`
      ).toBe(true);
      if (path === '/') {
        await expect(page.locator('.product-plate')).toHaveCount(4);
        if (width >= 1024)
          expect(
            await page
              .locator('.product-grid')
              .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)
          ).toBe(4);
      }
      if ([390, 724, 1440].includes(width) && [routePiece, '/'].includes(path))
        await shot(page, `${width}-${path === '/' ? 'home' : 'product'}`);
    }
  }
  for (const path of [
    '/shop',
    '/collections',
    '/collections/2026-collection',
    '/collections/unknown',
    '/product/unknown',
    '/about',
    '/journal',
    '/journal/against-the-skinny',
    '/journal/selvedge-by-the-metre',
    '/journal/cairo-4am',
    '/journal/missing',
    '/terms',
    '/privacy',
    '/order-confirmation/TWS-unknown',
    '/missing',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  }
  await page.goto('/shop?piece=tws-signature-tee');
  await expect(page.getByRole('dialog', { name: 'Quick view' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/');
  await page.getByRole('button', { name: 'Search pieces' }).click();
  await page.getByLabel('Search products by name').fill('cross');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/product\/tws-cross-tee/);
  for (const path of ['/admin', '/admin/login', '/admin/inventory']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('populated cart, drawer and checkout at small, tablet and large breakpoints', async ({ page }) => {
  await transport(page);
  await page.goto(routePiece);
  await page.getByRole('button', { name: 'L', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/product/tws-cross-tee');
  await page.getByRole('button', { name: 'L', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.keyboard.press('Escape');
  for (const width of [320, 375, 390, 430, 724, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 900 ? 780 : 900 });
    await page.goto('/cart');
    await expect(page.locator('.cart-lines li')).toHaveCount(2);
    await expect(page.locator('.cart-total')).toContainText('4,900');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `cart ${width}`
    ).toBe(true);
    if (width === 390 || width === 724) await shot(page, `${width}-cart`);
    await page.getByRole('button', { name: 'Shopping bag, 2 items' }).click();
    const bag = page.getByRole('dialog', { name: 'Shopping bag' });
    await expect(bag.locator('.cart-lines li')).toHaveCount(2);
    const panel = await bag.locator('.cart-drawer').boundingBox();
    expect(panel.width).toBeLessThanOrEqual(width + 1);
    await bag.getByRole('link', { name: 'Proceed to checkout' }).click();
    await expect(page.locator('.checkout-summary li')).toHaveCount(2);
    await expect(page.locator('.checkout-summary .cart-total')).toContainText('4,900');
    for (const control of await page.locator('form :is(input,select,textarea,button)').all()) {
      const b = await control.boundingBox();
      if (b) expect(b.x >= -1 && b.x + b.width <= width + 1, `checkout control at ${width}`).toBe(true);
    }
    if (width === 390 || width === 1440) await shot(page, `${width}-checkout`);
  }
});

test('staff tabs require membership; customer account never inherits a staff session', async ({
  page,
}) => {
  // The identity provider is a test double, not a production password test.
  // Membership reads and admin data queries still run under real Postgres RLS.
  const staff = crypto.randomUUID(),
    customer = crypto.randomUUID(),
    password = crypto.randomUUID();
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
    staff,
    'staff@example.test',
    customer,
    'customer@example.test',
  ]);
  await db.query('insert into admin_users(id,email) values($1,$2)', [staff, 'staff@example.test']);
  const sessions = new Map();
  const asPublic = [];
  await page.route('https://studio-fixture.invalid/**', async (route) => {
    const r = route.request(),
      url = new URL(r.url()),
      body = r.postDataJSON();
    const path = url.pathname;
    const reply = (json, status = 200) => route.fulfill({ status, json });
    if (path === '/auth/v1/token') {
      const id = body.email === 'staff@example.test' ? staff : customer;
      if (body.password !== password) return reply({ message: 'Invalid login credentials' }, 400);
      const now = Math.floor(Date.now() / 1000);
      const user = {
        id,
        email: body.email,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: {},
        created_at: new Date().toISOString(),
      };
      const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const token = [
        enc({ alg: 'HS256', typ: 'JWT' }),
        enc({ sub: id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
        Buffer.from(crypto.randomUUID()).toString('base64url'),
      ].join('.');
      sessions.set(token, id);
      return reply({
        access_token: token,
        token_type: 'bearer',
        refresh_token: crypto.randomUUID(),
        expires_in: 3600,
        user,
      });
    }
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
    const uid = sessions.get(((await r.headerValue('authorization')) || '').replace('Bearer ', ''));
    const name = path.replace('/rest/v1/', '');
    try {
      const result = await db.transaction(async (tx) => {
        if (uid) {
          await tx.exec('set local role authenticated');
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
        } else await tx.exec('set local role anon');
        if (name === 'products') {
          if (url.searchParams.has('is_published')) asPublic.push(!uid);
          return (await tx.query(productsQuery)).rows.map((v) => v.row);
        }
        if (name === 'product_variants' && r.method() === 'PATCH') {
          expect(Object.keys(body)).toEqual(['stock_quantity']);
          return (
            await tx.query(
              'update product_variants set stock_quantity=$1 where id=$2 and updated_at=$3::timestamptz returning id',
              [
                body.stock_quantity,
                url.searchParams.get('id')?.slice(3),
                url.searchParams.get('updated_at')?.slice(3),
              ]
            )
          ).rows;
        }
        if (name === 'admin_users')
          return (
            await tx.query('select id from admin_users where id=$1', [
              url.searchParams.get('id')?.slice(3),
            ])
          ).rows;
        if (name === 'orders')
          return (
            await tx.query(
              'select o.*, (select jsonb_agg(i) from order_items i where i.order_id=o.id) as order_items from orders o'
            )
          ).rows;
        if (['customers', 'site_settings', 'discount_rules'].includes(name))
          return (await tx.query(`select * from ${name}`)).rows;
        throw Error('Unexpected test request');
      });
      return reply(result);
    } catch (e) {
      return reply({ message: e.message }, 400);
    }
  });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  async function login(email) {
    await page.locator('#admin-email').fill(email);
    await page.locator('#admin-password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
  await login('customer@example.test');
  await expect(page.getByRole('alert')).toContainText('not authorised');
  await expect(page.getByRole('navigation', { name: 'Console sections' })).toHaveCount(0);
  await login('staff@example.test');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Console sections' });
  for (const tab of ['Products', 'Inventory', 'Orders', 'Customers', 'Discounts', 'Site content']) {
    await nav.getByRole('button', { name: new RegExp(`^${tab}`) }).click();
    await expect(page.locator('main h1')).toHaveText(tab);
    if (tab === 'Inventory') {
      const stock = page.getByRole('spinbutton', {
        name: 'Stock for TWS Cross Tee, Ivory, size M',
        exact: true,
      });
      const row = page.getByRole('row').filter({ has: stock });
      const id = (
        await db.query(
          "select v.id from product_variants v join products p on p.id=v.product_id where p.slug='tws-cross-tee' and v.size_name='M'"
        )
      ).rows[0].id;
      // A sale after this screen was loaded must not be overwritten by the stale edit.
      await db.query('update product_variants set stock_quantity=stock_quantity-1 where id=$1', [id]);
      await stock.fill('12');
      await row.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Stock changed');
      expect(
        (await db.query('select stock_quantity from product_variants where id=$1', [id])).rows[0]
          .stock_quantity
      ).toBe(7);
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
      await row.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(row.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
      expect(
        (await db.query('select stock_quantity from product_variants where id=$1', [id])).rows[0]
          .stock_quantity
      ).toBe(12);
      await shot(page, 'admin-inventory');
    }
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `mobile admin ${tab}`
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Your customer account' }).click();
  await expect(page.getByRole('dialog', { name: 'Account', exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  expect(asPublic).toContain(true);
  expect(asPublic).not.toContain(false);
});
