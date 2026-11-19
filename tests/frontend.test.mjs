import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('frontend: order tracking stages, loyalty & discount UI, show-all-products, hero/PDP CSS, and simplified About page', async (t) => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
    resolve: { alias: { 'react-router-dom': 'react-router' } },
    ssr: { external: ['react', 'react-dom'] },
  });
  t.after(() => vite.close());

  const { MemoryRouter } = await vite.ssrLoadModule('react-router');

  const { ORDER_TRACKING_STEPS, resolveTrackingStage } = await vite.ssrLoadModule(
    '/src/lib/orderTracking.ts'
  );
  const { OrderTrackingResult } = await vite.ssrLoadModule(
    '/src/components/account/OrderTrackingResult.tsx'
  );
  const { AboutPage } = await vite.ssrLoadModule('/src/pages/AboutPage.tsx');
  const { HeroSection } = await vite.ssrLoadModule('/src/components/home/HeroSection.tsx');
  const { SiteSettingsProvider } = await vite.ssrLoadModule('/src/context/SiteSettingsContext.tsx');
  const { WishlistProvider } = await vite.ssrLoadModule('/src/context/WishlistContext.tsx');
  const { UIProvider } = await vite.ssrLoadModule('/src/context/UIContext.tsx');
  const { ProductPlate } = await vite.ssrLoadModule('/src/components/shop/ProductPlate.tsx');

  // 1. Verify all 4 required Order Tracking stages map accurately
  assert.deepEqual(
    ORDER_TRACKING_STEPS.map((s) => [s.step, s.label, s.description]),
    [
      [1, 'Accepted', 'Order accepted.'],
      [2, 'Preparing', 'Order is being prepared.'],
      [3, 'Ready / Not Shipped', 'Order has not left yet.'],
      [4, 'Out for Delivery', 'Order is on its way.'],
    ]
  );
  assert.equal(resolveTrackingStage('pending').label, 'Accepted');
  assert.equal(resolveTrackingStage('confirmed').label, 'Accepted');
  assert.equal(resolveTrackingStage('processing').label, 'Preparing');
  assert.equal(resolveTrackingStage('ready').label, 'Ready / Not Shipped');
  assert.equal(resolveTrackingStage('shipped').label, 'Out for Delivery');
  assert.equal(resolveTrackingStage('delivered').is_completed, true);
  assert.equal(resolveTrackingStage('cancelled').is_cancelled, true);

  // Render OrderTrackingResult for Ready / Not Shipped stage and verify real status HTML
  const trackedHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(OrderTrackingResult, {
        lookupEmail: 'amina@example.test',
        order: {
          order_reference: 'TWS-2026-ABCDEF123456',
          status: 'ready',
          tracking: resolveTrackingStage('ready'),
          payment_method: 'COD',
          subtotal: 1400,
          shipping_cost: 75,
          email_discount_amount: 0,
          loyalty_discount_amount: 140,
          loyalty_free_reward_amount: 0,
          promo_discount_amount: 0,
          discount_total: 140,
          applied_promo_code: null,
          total_amount: 1335,
          city: 'Maadi',
          governorate: 'Cairo',
          created_at: '2026-11-19T12:00:00Z',
          items: [
            {
              product_name: 'Denim bootcut',
              product_slug: 'denim-bootcut',
              product_image: null,
              color_name: 'Blue',
              color_hex: '#1e3a5f',
              size_name: 'M',
              unit_price: 1400,
              quantity: 1,
              line_total: 1400,
            },
          ],
        },
      })
    )
  );
  assert.match(trackedHtml, /TWS-2026-ABCDEF123456/);
  assert.match(trackedHtml, /1\. Accepted/);
  assert.match(trackedHtml, /2\. Preparing/);
  assert.match(trackedHtml, /3\. Ready \/ Not Shipped/);
  assert.match(trackedHtml, /Order has not left yet\./);
  assert.match(trackedHtml, /4\. Out for Delivery/);
  assert.match(trackedHtml, /Open confirmation/);

  // 2. Verify Collection / Products views do not arbitrarily hide products with .slice(0, 4)
  const piecesSrc = await readFile('src/components/home/PiecesSection.tsx', 'utf8');
  const navbarSrc = await readFile('src/components/layout/Navbar.tsx', 'utf8');
  const collectionsSrc = await readFile('src/pages/CollectionsPage.tsx', 'utf8');
  assert.equal(piecesSrc.includes('.slice(0, 4)'), false);
  assert.equal(navbarSrc.includes('.slice(0, 4)'), false);
  assert.equal(collectionsSrc.includes('<ProductPlate'), true);

  // Verify 6 distinct products all render cleanly in ProductPlate without truncation
  const sixProductsHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        WishlistProvider,
        null,
        React.createElement(
          UIProvider,
          null,
          Array.from({ length: 6 }, (_, idx) =>
            React.createElement(ProductPlate, {
              key: `prod-${idx + 1}`,
              index: idx,
              product: {
                id: `00000000-0000-4000-8000-00000000000${idx + 1}`,
                name: `Studio Piece 0${idx + 1}`,
                slug: `studio-piece-0${idx + 1}`,
                description: 'Heavyweight denim',
                fabric_info: '100% Cotton',
                fit_info: 'Relaxed',
                care_instructions: 'Wash cold',
                price: 1400 + idx * 50,
                original_price: null,
                category: 'Pants',
                collection_name: '2026 Collection',
                is_new_arrival: true,
                is_best_seller: false,
                is_trending: false,
                is_featured: true,
                is_published: true,
                sort_order: idx,
                created_at: '2026-11-19T00:00:00Z',
                updated_at: '2026-11-19T00:00:00Z',
                images: [],
                variants: [],
              },
            })
          )
        )
      )
    )
  );
  for (let i = 1; i <= 6; i++) {
    assert.match(sixProductsHtml, new RegExp(`Studio Piece 0${i}`));
    assert.match(sixProductsHtml, new RegExp(`/product/studio-piece-0${i}`));
  }

  // 3. Verify Hero & Product Details vertical spacing adjustments in src/index.css
  const css = await readFile('src/index.css', 'utf8');
  // Hero height increased on mobile & desktop while HeroSection markup stays intact
  assert.match(css, /\.campaign-paint\s*\{[^}]*height:\s*clamp\(202px,\s*50vw,\s*446px\)/);
  assert.match(css, /@media\s*\(min-width:\s*920px\)\s*\{\s*\.campaign-paint\s*\{\s*height:\s*clamp\(412px,\s*38\.5vw,\s*640px\)/);
  const heroHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(SiteSettingsProvider, null, React.createElement(HeroSection))
    )
  );
  assert.match(heroHtml, /campaign-paint/);
  assert.match(heroHtml, /Scroll down/);
  assert.match(heroHtml, /SHOP NOW/);

  // Product Details vertical spacing increased cleanly
  assert.match(css, /\.piece-spread\s*\{[^}]*padding-top:\s*calc\(var\(--header\)\s*\+\s*clamp\(20px,\s*3vw,\s*46px\)\)/);
  assert.match(css, /\.gallery-frame\s*\{[^}]*height:\s*clamp\(368px,\s*50vw,\s*768px\)/);
  assert.match(css, /\.option-row\s*\{[^}]*padding-block:\s*clamp\(16px,\s*2\.2vw,\s*26px\)/);

  // 4. Verify simplified AboutPage renders cleanly with #fit and #service anchors preserved
  const aboutHtml = renderToStaticMarkup(
    React.createElement(MemoryRouter, null, React.createElement(AboutPage))
  );
  assert.match(aboutHtml, /id="fit"/);
  assert.match(aboutHtml, /id="service"/);
  assert.match(aboutHtml, /Three Ways Studios/);
  assert.equal(aboutHtml.includes('above a fabric merchant'), false);

  // 5. Verify AccountPage renders personal account access, loyalty card, discount options, and order tracking
  const { CartProvider } = await vite.ssrLoadModule('/src/context/CartContext.tsx');
  const { CustomerAuthProvider } = await vite.ssrLoadModule('/src/context/CustomerAuthContext.tsx');
  const { AccountPage } = await vite.ssrLoadModule('/src/pages/AccountPage.tsx');
  const accountHtml = renderToStaticMarkup(
    React.createElement(
      SiteSettingsProvider,
      null,
      React.createElement(
        WishlistProvider,
        null,
        React.createElement(
          CartProvider,
          null,
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/account'] },
            React.createElement(
              UIProvider,
              null,
              React.createElement(CustomerAuthProvider, null, React.createElement(AccountPage))
            )
          )
        )
      )
    )
  );
  assert.match(accountHtml, /Loyalty card/);
  // Redesigned loyalty centrepiece: the five-circle readout and the ladder.
  assert.match(accountHtml, /Five orders\. One pair on us\./);
  assert.match(accountHtml, /10% off/);
  assert.match(accountHtml, /20% off/);
  assert.match(accountHtml, /Free pants/);
  // Milestones appear exactly once (in the card section). The old duplicated
  // "Loyalty rewards — 10% · 20% · free pants" panel must be gone.
  assert.doesNotMatch(accountHtml, /Loyalty rewards . 10% . 20% . free pants/);
  assert.match(accountHtml, /10% Email Discount/);
  assert.match(accountHtml, /do not stack/);
  assert.match(accountHtml, /Track an order/);
  assert.match(accountHtml, /Order number \(Reference\)/);
  assert.match(accountHtml, /Email on the order/);

  // The provided two-sided artwork renders as one accessible 3D-flipping card.
  const accountSourceForCard = await readFile('src/components/account/CustomerAccountBody.tsx', 'utf8');
  const { LoyaltyCard } = await vite.ssrLoadModule('/src/components/account/LoyaltyCard.tsx');
  const cardHtml = renderToStaticMarkup(
    React.createElement(LoyaltyCard, {
      memberName: 'Test Member',
      email: 'member@example.test',
      progress: 2,
    })
  );
  assert.match(cardHtml, /loyalty-card-3d/);
  assert.match(cardHtml, /loyalty-card-input/);
  assert.match(cardHtml, /loyalty-card-label/);
  // Back face is first in the DOM so it is what the customer sees initially.
  assert.ok(
    cardHtml.indexOf('loyalty-card-back.png') < cardHtml.indexOf('loyalty-card-front.png'),
    'the stamp/back face must render first'
  );
  assert.match(cardHtml, /loyalty-card-back\.png/);
  assert.match(cardHtml, /loyalty-card-front\.png/);
  assert.match(cardHtml, /2<\/strong> of 5 orders completed/);
  // Cards start on the BACK face: the front transform class must be absent
  // from the server-rendered markup, and the back face must be first.
  assert.doesNotMatch(cardHtml, /lw-card-3d is-front/);
  assert.match(cardHtml, /data-side="back"/);
  // Five circles, driven by real progress: 2 complete, 3 empty.
  for (let i = 1; i <= 5; i += 1) {
    assert.match(cardHtml, new RegExp(`data-testid="loyalty-circle-${i}"`));
  }
  assert.equal((cardHtml.match(/data-complete="true"/g) || []).length, 2);
  assert.equal((cardHtml.match(/data-complete="false"/g) || []).length, 3);

  // The artwork must never be gated behind the loyalty request.
  const pendingHtml = renderToStaticMarkup(
    React.createElement(LoyaltyCard, {
      memberName: 'Test Member',
      email: 'member@example.test',
      progress: 0,
      pending: true,
    })
  );
  assert.match(pendingHtml, /loyalty-card-back\.png/);
  assert.match(pendingHtml, /Checking your orders/);
  // While pending, the visible readout never claims a count (the alt text may
  // still describe the card, so match the rendered progress element only).
  assert.doesNotMatch(pendingHtml, /<strong>\d+<\/strong> of 5 orders completed/);
  // Pending never fakes progress: every circle is still empty.
  assert.equal((pendingHtml.match(/data-complete="true"/g) || []).length, 0);
  for (const [asset, expected] of [
    ['public/images/loyalty-card-back.png', [1337, 783]],
    ['public/images/loyalty-card-front.png', [1337, 775]],
  ]) {
    const png = await readFile(asset);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], expected);
    assert.equal(png[25], 6, 'cropped card keeps transparent pixels around its rounded corners');
  }
  // Regression: a `filter` on the flipping element silently forces
  // transform-style to flat, which paints BOTH faces at once and shows the
  // mirrored back artwork instead of the front. The shadow must sit on the
  // face images, never on .loyalty-card-3d.
  const flipStart = css.indexOf('.lw-card-3d {');
  assert.ok(flipStart > -1, '.lw-card-3d rule must exist');
  const flipBlock = css.slice(flipStart, css.indexOf('.lw-card-3d.is-front {', flipStart));
  assert.doesNotMatch(flipBlock, /filter\s*:/, '.lw-card-3d must not use filter');
  // The faces may carry the shadow, but must never flatten the 3D context.
  assert.match(css, /backface-visibility:\s*hidden/);
  assert.match(css, /transform-style:\s*preserve-3d/);
  assert.match(css, /backface-visibility:\s*hidden/);
  // The artwork must be visible before the loyalty request resolves.
  assert.match(accountSourceForCard, /pending=\{overviewLoading && !overview\}/);
  // A completed-but-empty response must produce a real state, not a spinner.
  assert.match(accountSourceForCard, /overviewEmpty/);
  assert.match(accountSourceForCard, /15000/);

  assert.match(css, /perspective:\s*\d+px/);
  assert.match(css, /\.lw-card-3d\.is-front \{\s*transform:\s*rotateY\(180deg\);?\s*\}/);
  assert.match(css, /\.lw-card-face--front \{\s*transform:\s*rotateY\(180deg\);?\s*\}/);

  // Strict same-order model must be reflected in the copy the customer reads:
  // no "save it for later / carried forward / redeem at a later checkout" claim,
  // and the milestone-5 bag is explicitly required to contain the pants.
  const checkoutSource = await readFile('src/pages/CheckoutPage.tsx', 'utf8');
  assert.match(checkoutSource, /checkout-free-reward-kept/);
  assert.match(checkoutSource, /stays unlocked/);
  assert.match(checkoutSource, /it never expires/);
  assert.doesNotMatch(checkoutSource, /checkout-free-reward-required/);
  assert.doesNotMatch(checkoutSource, /cannot be saved for a later one/);

  const accountSource = await readFile('src/components/account/CustomerAccountBody.tsx', 'utf8');
  assert.match(accountSource, /never expires/);
  assert.match(accountSource, /never use it up/);
  assert.doesNotMatch(accountSource, /Forfeited/);

  // The auto-flip is a one-shot: guarded by a ref, skipped for reduced motion,
  // and it must start from the back face.
  const cardSource = await readFile('src/components/account/LoyaltyCard.tsx', 'utf8');
  assert.match(cardSource, /prefers-reduced-motion: reduce/);
  assert.match(cardSource, /played\.current/, 'auto-flip must run at most once');
  assert.match(cardSource, /setTimeout\([\s\S]{0,200}?\b8[0-9]0\b/,
    'auto-flip must wait roughly 700-1000ms before revealing the front');
  assert.match(cardSource, /useState\(false\)/, 'card starts on the back face');
  assert.match(cardSource, /data-complete=\{done \? 'true' : 'false'\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  // Only a manually delivered order may stamp a circle: the history card must
  // say so, and progress comes from the server field, never a local counter.
  const orderCardSource = await readFile('src/components/account/AccountOrderCard.tsx', 'utf8');
  assert.match(orderCardSource, /Counts once it is marked delivered/);
  assert.match(orderCardSource, /Not counted toward your loyalty card/);
  // Progress must come from the server field. `available_free_pants` is the
  // only proof the fifth-order pair exists; a milestone in state 'next' merely
  // marks the next empty slot and would fire the banner one order too early.
  assert.match(accountSource, /loyalty\?\.progress_in_cycle \?\? 0/);
  assert.match(accountSource, /available_free_pants \|\| loyalty\?\.free_product_unlocked/);
  assert.doesNotMatch(accountSource, /loyaltyMilestones\[4\]\?\.state === 'next'/);
  assert.doesNotMatch(accountSource, /progressCount\s*=\s*[0-9]/);
  // Finishing the 5th order wraps progress_in_cycle to 0 server-side, so the
  // card must still read as full while the earned pair is unredeemed.
  assert.match(accountSource, /freeUnlocked \? 5 : \(loyalty\?\.progress_in_cycle/);
});
