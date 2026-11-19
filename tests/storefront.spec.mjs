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
async function transport(page, database = db) {
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
      const data = await anon(database, async (tx) => {
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
async function fillDelivery(page, email) {
  await page.getByLabel('Full name').fill('Fixture Buyer');
  await page.getByLabel('Phone number').fill('+20 101 234 5678');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('City / district').fill('Cairo');
  await page.getByLabel('Complete address').fill('42 Test Street, floor 2');
}

// Synthesize actual Chromium single-finger and two-finger touch gestures.
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

async function pinch(page, cx, cy, startHalfSpread, endHalfSpread) {
  const cdp = await page.context().newCDPSession(page);
  const pts = (half) => [
    { x: Math.round(cx - half), y: Math.round(cy - half * 0.35), id: 1 },
    { x: Math.round(cx + half), y: Math.round(cy + half * 0.35), id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(startHalfSpread) });
  for (let i = 1; i <= 10; i++) {
    const half = startHalfSpread + ((endHalfSpread - startHalfSpread) * i) / 10;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(half) });
    await new Promise((r) => setTimeout(r, 18));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function doubleTap(page, x, y) {
  const cdp = await page.context().newCDPSession(page);
  for (let tap = 0; tap < 2; tap++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1 }],
    });
    await new Promise((r) => setTimeout(r, 25));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (tap === 0) await new Promise((r) => setTimeout(r, 90));
  }
  await cdp.detach();
}

test('touch gallery: swipe, vertical scroll, tap full-screen lightbox, double-tap, pinch, drag, nav & close', async ({
  browser,
  baseURL,
}) => {
  const ctx = await browser.newContext({
    baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
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

  // 1. Swipe right-to-left and left-to-right through actual product frames without opening lightbox
  await drag(page, 310, y, -240, 4);
  await expect(thumb.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog', { name: /image viewer/i })).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(5);
  await drag(page, 70, y, 240, -3);
  await expect(thumb.nth(0)).toHaveAttribute('aria-pressed', 'true');

  // 2. Vertical scroll on gallery works normally
  await drag(page, 180, y, 4, -145);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(35);
  await expect(thumb.nth(0)).toHaveAttribute('aria-pressed', 'true');

  // 3. Tap image opens full-screen lightbox displaying actual image large & proportional
  const updatedBox = await rail.boundingBox();
  await page.touchscreen.tap(195, updatedBox.y + updatedBox.height * 0.5);
  const viewer = page.getByRole('dialog', { name: 'TWS Signature Tee image viewer' });
  await expect(viewer).toBeVisible();
  const lockedOffset = await page.evaluate(() => Math.abs(parseFloat(document.body.style.top || '0')));
  expect(lockedOffset).toBeGreaterThan(35);
  await expect(viewer.locator('.lightbox-counter')).toHaveText('1 / 4');
  const viewerImg = viewer.locator('.lightbox-image');
  await expect(viewerImg).toHaveAttribute('src', '/media/campaign/signature-tee.webp');

  const fitMetrics = await viewerImg.evaluate((img) => {
    const r = img.getBoundingClientRect();
    return {
      w: r.width,
      h: r.height,
      x: r.x,
      y: r.y,
      renderedRatio: r.width / r.height,
      naturalRatio: img.naturalWidth / img.naturalHeight,
    };
  });
  expect(fitMetrics.w).toBeGreaterThan(340); // uses >87% of 390px mobile screen
  expect(Math.abs(fitMetrics.renderedRatio - fitMetrics.naturalRatio)).toBeLessThan(0.015);
  await shot(page, '390-lightbox');

  // 4. Background scroll stays strictly locked while viewer is open (incl. iOS/mobile fixed body lock)
  expect(
    await page.evaluate(() => ({
      locked: document.documentElement.classList.contains('tws-scroll-locked'),
      overflow: getComputedStyle(document.documentElement).overflowY,
      bodyPosition: getComputedStyle(document.body).position,
      scrollY: window.scrollY,
    }))
  ).toEqual({ locked: true, overflow: 'hidden', bodyPosition: 'fixed', scrollY: 0 });

  // 5. Double-tap to zoom in, drag while zoomed in, and double-tap to zoom back out
  const stage = viewer.getByTestId('lightbox-stage');
  const stageBox = await stage.boundingBox();
  const cx = stageBox.x + stageBox.width / 2;
  const cy = stageBox.y + stageBox.height / 2;

  await doubleTap(page, cx, cy);
  await expect(stage).toHaveAttribute('data-zoom', '2.50');
  const zoomedBeforeDrag = await viewerImg.boundingBox();
  expect(zoomedBeforeDrag.width).toBeGreaterThan(fitMetrics.w * 2.3);

  await drag(page, cx + 60, cy + 40, -110, -70);
  const zoomedAfterDrag = await viewerImg.boundingBox();
  expect(zoomedAfterDrag.x).toBeLessThan(zoomedBeforeDrag.x - 40);
  expect(zoomedAfterDrag.y).toBeLessThan(zoomedBeforeDrag.y - 25);
  await expect(viewer.locator('.lightbox-counter')).toHaveText('1 / 4');
  expect(
    await page.evaluate(() => ({
      scrollY: window.scrollY,
      top: Math.abs(parseFloat(document.body.style.top || '0')),
    }))
  ).toEqual({ scrollY: 0, top: lockedOffset });
  await shot(page, '390-lightbox-zoomed');

  await doubleTap(page, cx, cy);
  await expect(stage).toHaveAttribute('data-zoom', '1.00');

  // 6. Pinch-to-zoom outward & inward on mobile
  await pinch(page, cx, cy, 42, 115);
  const pinchZoom = Number(await stage.getAttribute('data-zoom'));
  expect(pinchZoom).toBeGreaterThan(2.0);
  await pinch(page, cx, cy, 115, 38);
  await expect(stage).toHaveAttribute('data-zoom', '1.00');

  // 7. Navigate across real gallery images without closing the viewer (swipe + arrow + thumb)
  await drag(page, 310, cy, -210, 2);
  await expect(viewer.locator('.lightbox-counter')).toHaveText('2 / 4');
  await expect(viewerImg).toHaveAttribute('src', '/media/campaign/signature-back.webp');

  await viewer.getByRole('button', { name: 'Next image in viewer' }).click();
  await expect(viewer.locator('.lightbox-counter')).toHaveText('3 / 4');
  await expect(viewerImg).toHaveAttribute('src', '/media/campaign/signature-detail.webp');

  await viewer.getByRole('button', { name: 'Show image 4 of 4' }).click();
  await expect(viewer.locator('.lightbox-counter')).toHaveText('4 / 4');
  await expect(viewerImg).toHaveAttribute('src', '/media/campaign/fabric-detail.webp');

  // 8. Clear close button dismisses viewer, syncs inline gallery, and restores scroll
  await viewer.getByRole('button', { name: 'Close image viewer' }).click();
  await expect(viewer).toHaveCount(0);
  await expect(thumb.nth(3)).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.classList.contains('tws-scroll-locked'))).toBe(
    false
  );
  expect(Math.abs((await page.evaluate(() => scrollY)) - lockedOffset)).toBeLessThanOrEqual(1);
  await ctx.close();
});

test('desktop full-screen viewer: wheel zoom, mouse drag, double-click, keyboard nav & single-photo piece', async ({
  page,
}) => {
  await transport(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(routePiece);
  await page.locator('.gallery-frame img').first().click();

  const viewer = page.getByRole('dialog', { name: 'TWS Signature Tee image viewer' });
  await expect(viewer).toBeVisible();
  const stage = viewer.getByTestId('lightbox-stage');
  const img = viewer.locator('.lightbox-image');

  const initial = await img.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      w: r.width,
      h: r.height,
      ratio: r.width / r.height,
      natural: el.naturalWidth / el.naturalHeight,
    };
  });
  expect(initial.h).toBeGreaterThan(640);
  expect(Math.abs(initial.ratio - initial.natural)).toBeLessThan(0.015);
  await shot(page, '1440-lightbox');

  // Mouse-wheel zoom in
  const sBox = await stage.boundingBox();
  const mx = sBox.x + sBox.width / 2;
  const my = sBox.y + sBox.height / 2;
  await page.mouse.move(mx, my);
  await page.mouse.wheel(0, -380);
  const wheelScale = Number(await stage.getAttribute('data-zoom'));
  expect(wheelScale).toBeGreaterThan(1.7);
  expect(await page.evaluate(() => scrollY)).toBe(0);

  // Desktop mouse drag when zoomed in
  const beforePan = await img.boundingBox();
  await page.mouse.down();
  await page.mouse.move(mx - 140, my - 90, { steps: 8 });
  await page.mouse.up();
  const afterPan = await img.boundingBox();
  expect(afterPan.x).toBeLessThan(beforePan.x - 60);
  expect(afterPan.y).toBeLessThan(beforePan.y - 40);
  await expect(viewer).toBeVisible();

  // Double-click resets zoom; keyboard ArrowRight switches image; Escape closes
  await page.mouse.dblclick(mx, my);
  await expect(stage).toHaveAttribute('data-zoom', '1.00');
  await page.keyboard.press('ArrowRight');
  await expect(viewer.locator('.lightbox-counter')).toHaveText('2 / 4');
  await expect(img).toHaveAttribute('src', '/media/campaign/signature-back.webp');
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);

  // Single-image product never invents placeholder slides
  await page.goto('/product/tws-cross-tee');
  await page.locator('.gallery-frame img').first().click();
  const singleViewer = page.getByRole('dialog', { name: 'TWS Cross Tee image viewer' });
  await expect(singleViewer).toBeVisible();
  await expect(singleViewer.locator('.lightbox-counter')).toHaveText('1 / 1');
  await expect(singleViewer.getByRole('button', { name: 'Next image in viewer' })).toHaveCount(0);
  await singleViewer.getByRole('button', { name: 'Close image viewer' }).click();
  await expect(singleViewer).toHaveCount(0);
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
  await fillDelivery(page, 'buyer@example.test');
  await page.getByRole('button', { name: 'Submit email for 10% discount' }).click();
  await expect(page.locator('.cart-total')).toContainText('2,280');
  const creation = '**/rpc/create_cod_order';
  await page.route(creation, (r) =>
    r.fulfill({ status: 500, json: { message: 'Transaction not confirmed' } })
  );
  const confirm = page.getByRole('button', { name: 'Confirm order', exact: true });
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
  await expect(account.getByTestId('order-tracking-result')).toContainText('1. Accepted');
  await expect(account.getByTestId('order-tracking-result')).toContainText('3. Ready / Not Shipped');
  await expect(account.getByRole('link', { name: 'Open confirmation' })).toBeVisible();
});
test('checkout gates confirmation, retries verification, and safely recovers a committed promo order', async ({ page }) => {
  await transport(page);
  const buyer = 'promo-buyer@example.test';
  const [{ id: variant, stock_quantity: stock }] = (
    await db.query(`select v.id, v.stock_quantity from product_variants v join products p on p.id=v.product_id
      where p.slug='tws-cross-tee' and v.size_name='L'`)
  ).rows;
  await db.exec(`insert into discount_rules (name, code, rule_type, discount_percent)
    values ('Fixture 10%', 'FIXTURE10', 'promo_code', 10)`);

  await page.goto('/product/tws-cross-tee');
  await page.getByRole('button', { name: 'L', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  const confirm = page.getByRole('button', { name: 'Confirm order', exact: true });
  const total = page.locator('.checkout-summary .cart-total dd');
  const summary = page.locator('.checkout-summary .cart-totals');
  await expect(total).toHaveText('EGP 2,525');
  await expect(confirm).toBeDisabled(); // a server quote is not sufficient without delivery details
  await fillDelivery(page, buyer);
  await expect(confirm).toBeEnabled();
  await page.getByLabel('Phone number').fill('123');
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Phone number').fill('+20 101 234 5678');
  await expect(confirm).toBeEnabled();

  const applyCode = async (code) => {
    await page.getByLabel('Promo code').fill(code);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
  };
  await applyCode('DOES-NOT-EXIST');
  await expect(page.getByRole('alert')).toContainText('Invalid or inactive promo code.');
  await expect(confirm).toBeDisabled();
  await expect(total).toHaveText('—');

  const quote = '**/rpc/quote_cod_order';
  await page.route(quote, (r) =>
    r.fulfill({ status: 400, json: { message: 'Inventory unavailable' } })
  );
  await page.getByRole('button', { name: 'Remove code' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not verify this bag: Inventory unavailable');
  await expect(confirm).toBeDisabled();
  await page.unroute(quote);
  await page.getByRole('button', { name: 'Submit email for 10% discount' }).click();
  await expect(total).toHaveText('EGP 2,280');
  await expect(confirm).toBeEnabled();

  // Verification is not a reservation. A real stock change must be rejected at write time.
  await db.query('update product_variants set stock_quantity=0 where id=$1', [variant]);
  await confirm.click();
  await expect(page.getByText(/currently out of stock/)).toBeVisible();
  await expect(confirm).toBeDisabled();
  expect((await db.query('select id from orders where customer_email=$1', [buyer])).rows).toHaveLength(0);
  await db.query('update product_variants set stock_quantity=$2 where id=$1', [variant, stock]);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(confirm).toBeEnabled();

  await applyCode(' fixture10 ');
  await expect(total).toHaveText('EGP 2,059.50');
  await expect(summary).toContainText('EGP 2,450');
  await expect(summary).toContainText('EGP 75');
  await expect(summary).toContainText('−EGP 245');
  await expect(summary).toContainText('−EGP 220.50');
  await expect(confirm).toBeEnabled();
  const attempts = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/rpc/create_cod_order')) attempts.push(r.postDataJSON());
  });
  await page.route('**/rpc/create_cod_order', async (route) => {
    // Lose the response, not the transaction: the first RPC really commits.
    await anon(db, (tx) => rpc(tx, 'create_cod_order', route.request().postDataJSON()));
    await route.fulfill({ status: 502, json: { message: 'Confirmation response interrupted' } });
  }, { times: 1 });
  await page.locator('form.checkout-spread').evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole('alert')).toContainText('Confirmation response interrupted');
  expect(attempts).toHaveLength(1);
  const [saved] = (await db.query('select * from orders where customer_email=$1', [buyer])).rows;
  expect(saved.checkout_request_id).toBe(attempts[0].p_checkout_request_id);

  await page.reload();
  await fillDelivery(page, buyer);
  await applyCode('FIXTURE10');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByRole('heading', { name: /Thank you/ })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${saved.order_reference}$`));
  await expect(page.locator('dl').getByText('EGP 2,059.50', { exact: true })).toBeVisible();
  expect(attempts.map((a) => a.p_checkout_request_id)).toEqual([saved.checkout_request_id, saved.checkout_request_id]);
  expect((await db.query('select id from orders where customer_email=$1', [buyer])).rows).toEqual([{ id: saved.id }]);
  expect(Number(saved.total_amount)).toBe(2059.50);
  expect(saved.payment_method).toBe('COD');
  expect((await db.query('select stock_quantity from product_variants where id=$1', [variant])).rows[0].stock_quantity).toBe(stock - 1);
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
  await expect(page.getByRole('button', { name: 'Confirm order', exact: true })).toBeDisabled();
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
  for (const width of [320, 360, 375, 390, 430, 724, 768, 919, 920, 1024, 1440, 1920]) {
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
        const noGlobalScaleHack = await page.evaluate(() =>
          [document.documentElement, document.body, document.querySelector('main')].every((el) => {
            if (!el) return true;
            const cs = getComputedStyle(el);
            return (cs.zoom === '1' || cs.zoom === 'normal' || !cs.zoom) && cs.transform === 'none';
          })
        );
        expect(noGlobalScaleHack).toBe(true);
        const cols = await page
          .locator('.product-grid')
          .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
        expect(cols).toBe(width >= 1024 ? 4 : 2);
        const art = await page.locator('.campaign-paint').boundingBox();
        const previousHeight = width < 920
          ? Math.min(416, Math.max(178, width * 0.47))
          : Math.min(604, Math.max(384, width * 0.36));
        expect(art.height - previousHeight, `hero height added at ${width}px`).toBeGreaterThan(10);
        expect(art.height - previousHeight, `hero height added at ${width}px`).toBeLessThan(48);
        await expect(page.locator('.campaign').getByRole('link', { name: 'Shop now' })).toBeInViewport();
      }
      if ([390, 724, 1440].includes(width) && [routePiece, '/'].includes(path))
        await shot(page, `${width}-${path === '/' ? 'home' : 'product'}`);
    }
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const hero = page.locator('.campaign');
    await hero.getByRole('link', { name: 'Scroll down' }).click();
    await expect(page).toHaveURL(/#products$/);
    await expect(page.locator('#products h2')).toBeInViewport();
    await hero.getByRole('link', { name: 'Shop now' }).click();
    await expect(page).toHaveURL(/\/shop$/);
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

test('product recommendations use the published, in-stock catalog below purchase options', async ({ page }) => {
  const catalogDb = await studioDb();
  try {
    await transport(page, catalogDb);
    const recommendations = page.getByRole('region', { name: 'YOU MAY ALSO LIKE' });
    const links = recommendations.locator('a.product-plate');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(routePiece);
      await expect(links).toHaveCount(3);
      expect(await links.evaluateAll((cards) => cards.map((card) => card.getAttribute('href')))).toEqual([
        '/product/tws-cross-tee',
        '/product/tws-hoodie',
        '/product/tws-wide-leg-pants',
      ]); // Same collection and category rank above same collection only.
      const main = await page.locator('.piece-spread').boundingBox();
      const rail = await recommendations.boundingBox();
      expect(rail.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
      expect(rail.x).toBeGreaterThanOrEqual(0);
      expect(rail.x + rail.width).toBeLessThanOrEqual(width + 1);
      const columns = await recommendations.locator('.product-grid').evaluate(
        (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length
      );
      expect(columns).toBe(width >= 1024 ? 4 : 2);
      await expect(links.first().locator('h3')).toHaveText('TWS Cross Tee');
      await expect(links.first().locator('p')).toHaveText('EGP 2,450');
      const image = links.first().getByRole('img', { name: 'TWS Cross Tee, view 1' });
      await expect(image).toHaveAttribute('src', '/media/campaign/cross-tee.webp');
      await links.first().scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      if (width === 1440 || width === 390) await shot(page, `${width}-recommendations`);
    }

    await links.first().click();
    await expect(page).toHaveURL(/\/product\/tws-cross-tee$/);
    await expect(page.getByRole('heading', { name: 'TWS Cross Tee', level: 1 })).toBeVisible();
    await expect(recommendations.locator('a[href="/product/tws-cross-tee"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'M', exact: true }).click();
    await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Shopping bag' })).toContainText('Size: M · Ivory');

    await catalogDb.exec(`
      update products set is_published=false where slug='tws-wide-leg-pants';
      update product_variants set is_active=false where product_id=(select id from products where slug='tws-hoodie');
      update products set price=2399.50 where slug='tws-cross-tee';
    `);
    await page.goto(routePiece);
    await expect(links).toHaveCount(1);
    await expect(links.first().locator('p')).toHaveText('EGP 2,399.50');
    await catalogDb.exec(`update product_variants set stock_quantity=0
      where product_id=(select id from products where slug='tws-cross-tee')`);
    const listing = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/rest/v1/products' && !url.searchParams.has('slug');
    });
    await page.reload();
    await (await listing).finished();
    await expect(page.getByRole('button', { name: 'Add to bag', exact: true })).toBeEnabled();
    await expect(recommendations).toHaveCount(0);
  } finally {
    await catalogDb.close();
  }
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
    await expect(page.locator('.checkout-summary .cart-totals')).toContainText('Included');
    for (const control of await page.locator('form :is(input,select,textarea,button)').all()) {
      const b = await control.boundingBox();
      if (b) expect(b.x >= -1 && b.x + b.width <= width + 1, `checkout control at ${width}`).toBe(true);
    }
    if (width === 390 || width === 1440) await shot(page, `${width}-checkout`);
  }
});

test('customer registration appears in admin Customers tab; staff RLS & session isolation hold', async ({
  page,
}) => {
  // The identity endpoint is a local GoTrue test double backed by real Postgres auth.users;
  // triggers, RPCs, membership checks and admin data reads execute real repository SQL & RLS.
  const staff = crypto.randomUUID();
  const namelessUser = crypto.randomUUID();
  const staffPassword = `Staff!${crypto.randomUUID()}`;
  const customerPassword = `Cust!${crypto.randomUUID()}`;
  const passwords = new Map([[staff, staffPassword]]);

  await db.query(
    `insert into auth.users(id, email, encrypted_password, confirmation_token, raw_user_meta_data, created_at)
     values
       ($1, 'staff@example.test', 'HASH_STAFF_SECRET', 'TOK_STAFF_SECRET', '{"full_name":"Studio Staff"}'::jsonb, '2026-11-10T09:00:00Z'),
       ($2, 'nameless.member@example.test', 'HASH_NAMELESS_SECRET', 'TOK_NAMELESS_SECRET', '{}'::jsonb, '2026-11-17T14:20:00Z')`,
    [staff, namelessUser]
  );
  await db.query('insert into admin_users(id,email) values($1,$2)', [staff, 'staff@example.test']);

  const sessions = new Map();
  const asPublic = [];
  const makeSession = (row) => {
    const now = Math.floor(Date.now() / 1000);
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = [
      enc({ alg: 'HS256', typ: 'JWT' }),
      enc({ sub: row.id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
      Buffer.from(`SIG_SECRET_${crypto.randomUUID()}`).toString('base64url'),
    ].join('.');
    sessions.set(token, row.id);
    return {
      access_token: token,
      token_type: 'bearer',
      refresh_token: `REFRESH_SECRET_${crypto.randomUUID()}`,
      expires_in: 3600,
      user: {
        id: row.id,
        email: row.email,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: row.raw_user_meta_data || {},
        identities: [{ id: row.id, user_id: row.id, provider: 'email' }],
        created_at: new Date(row.created_at).toISOString(),
      },
    };
  };

  await page.route('https://studio-fixture.invalid/**', async (route) => {
    const r = route.request(),
      url = new URL(r.url()),
      body = r.postDataJSON();
    const path = url.pathname;
    const reply = (json, status = 200) => route.fulfill({ status, json });

    if (path === '/auth/v1/signup') {
      const id = crypto.randomUUID();
      const email = String(body.email || '').trim().toLowerCase();
      const meta = body.data && typeof body.data === 'object' ? body.data : {};
      const { rows } = await db.query(
        `insert into auth.users(id, email, encrypted_password, confirmation_token, raw_user_meta_data, created_at)
         values($1, $2, $3, $4, $5::jsonb, now())
         returning id, email, raw_user_meta_data, created_at`,
        [id, email, `BCRYPT_HASH_${body.password}`, `CONFIRM_TOK_${id}`, JSON.stringify(meta)]
      );
      passwords.set(id, body.password);
      return reply(makeSession(rows[0]));
    }

    if (path === '/auth/v1/token') {
      const email = String(body.email || '').trim().toLowerCase();
      const { rows } = await db.query(
        'select id, email, raw_user_meta_data, created_at from auth.users where lower(email)=$1 limit 1',
        [email]
      );
      const found = rows[0];
      if (!found || passwords.get(found.id) !== body.password) {
        return reply({ message: 'Invalid login credentials' }, 400);
      }
      return reply(makeSession(found));
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

        if (name === 'rpc/register_customer_account') {
          return (
            await tx.query('select public.register_customer_account($1) as row', [
              body?.p_full_name ?? null,
            ])
          ).rows[0].row;
        }
        if (name === 'rpc/get_customer_account_overview') {
          return (await tx.query('select public.get_customer_account_overview() as row')).rows[0]
            .row;
        }
        if (name === 'rpc/track_order') {
          return rpc(tx, 'track_order', body);
        }
        if (name === 'rpc/admin_list_customers') {
          return (await tx.query('select * from public.admin_list_customers()')).rows;
        }
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
        throw Error(`Unexpected test request: ${name}`);
      });
      return reply(result);
    } catch (e) {
      return reply({ message: e.message }, 400);
    }
  });

  // 1. Register a real new customer account directly from the storefront Account panel
  const newCustomerEmail = 'layla.mansour@example.test';
  const newCustomerName = 'Layla Mansour';
  await page.goto('/');
  await page.getByRole('button', { name: 'Your customer account' }).click();
  const accountDialog = page.getByRole('dialog', { name: 'Account', exact: true });
  await accountDialog.getByLabel('Full name').fill(newCustomerName);
  await accountDialog.getByLabel('Account email').fill(newCustomerEmail);
  await accountDialog.getByLabel('Password', { exact: true }).fill(customerPassword);
  await accountDialog
    .locator('form')
    .first()
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(accountDialog.getByRole('heading', { name: newCustomerName })).toBeVisible();
  await expect(accountDialog).toContainText(newCustomerEmail);
  await expect(accountDialog.getByTestId('loyalty-card')).toContainText('0/5');
  await expect(accountDialog.getByTestId('loyalty-remaining-copy')).toContainText(
    '5 purchases remaining'
  );
  await accountDialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(accountDialog.getByLabel('Account email')).toBeVisible();
  await page.keyboard.press('Escape');

  // 2. Customer credentials must be denied access to /admin; staff succeeds
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  async function login(email, pwd) {
    await page.locator('#admin-email').fill(email);
    await page.locator('#admin-password').fill(pwd);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
  await login(newCustomerEmail, customerPassword);
  await expect(page.getByRole('alert')).toContainText('not authorised');
  await expect(page.getByRole('navigation', { name: 'Console sections' })).toHaveCount(0);

  await login('staff@example.test', staffPassword);
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
    if (tab === 'Customers') {
      // Newly registered customer appears automatically with real name, email, date & ID
      const laylaDbId = (
        await db.query('select id from public.customers where email=$1', [newCustomerEmail])
      ).rows[0].id;
      const laylaRow = page.getByTestId('admin-customer-row').filter({ hasText: newCustomerEmail });
      await expect(laylaRow).toBeVisible();
      await expect(laylaRow).toContainText(newCustomerName);
      await expect(laylaRow).toContainText('Account');
      await expect(laylaRow).toContainText(laylaDbId.slice(0, 8));
      await expect(laylaRow.locator('time')).toBeVisible();

      // Missing name handled gracefully
      const namelessRow = page
        .getByTestId('admin-customer-row')
        .filter({ hasText: 'nameless.member@example.test' });
      await expect(namelessRow).toContainText('No name provided');
      await expect(namelessRow.locator('time')).toBeVisible();

      // Staff excluded; no passwords or auth tokens anywhere in console markup
      await expect(
        page.getByTestId('admin-customer-row').filter({ hasText: 'staff@example.test' })
      ).toHaveCount(0);
      const html = await page.locator('main').innerText();
      for (const secret of [
        customerPassword,
        staffPassword,
        'BCRYPT_HASH_',
        'CONFIRM_TOK_',
        'HASH_NAMELESS_SECRET',
        'TOK_NAMELESS_SECRET',
        'REFRESH_SECRET_',
        'SIG_SECRET_',
      ]) {
        expect(html).not.toContain(secret);
      }

      await shot(page, '1280-admin-customers');

      // Search by name, email and ID
      const search = page.getByLabel('Search customers');
      await search.fill('Layla');
      await expect(page.getByTestId('admin-customer-row')).toHaveCount(1);
      await expect(laylaRow).toBeVisible();
      await search.fill(laylaDbId.slice(0, 8));
      await expect(page.getByTestId('admin-customer-row')).toHaveCount(1);
      await search.fill('nonexistent-person-xyz');
      await expect(page.getByText('No customers match your current search or filter.')).toBeVisible();
      await page.getByRole('button', { name: 'Reset search' }).click();
      await expect(laylaRow).toBeVisible();

      // Customer detail modal shows full ID, registration date and safe empty order state
      await laylaRow.getByRole('button', { name: 'View' }).click();
      const modal = page.getByRole('dialog', { name: 'Customer details' });
      await expect(modal).toContainText(newCustomerName);
      await expect(modal).toContainText(newCustomerEmail);
      await expect(modal).toContainText(laylaDbId);
      await expect(modal).toContainText('No COD orders placed yet.');
      await modal.getByRole('button', { name: 'Close customer details' }).click();
      await expect(modal).toHaveCount(0);

      // Mobile view shows stacked customer cards with zero overflow
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(
        page.getByTestId('admin-customer-card').filter({ hasText: newCustomerEmail })
      ).toBeVisible();
      await shot(page, '390-admin-customers');
    }
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `mobile admin ${tab}`
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  // 3. Storefront stays completely isolated from the admin session
  await page.goto('/');
  await page.getByRole('button', { name: 'Your customer account' }).click();
  const afterAccount = page.getByRole('dialog', { name: 'Account', exact: true });
  await expect(afterAccount).toBeVisible();
  await expect(afterAccount).not.toContainText('staff@example.test');
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  expect(asPublic).toContain(true);
  expect(asPublic).not.toContain(false);
});
