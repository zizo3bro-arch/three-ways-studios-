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
  assert.match(accountHtml, /Rewards across 5 completed orders/);
  assert.match(accountHtml, /10% OFF/);
  assert.match(accountHtml, /20% OFF/);
  assert.match(accountHtml, /Free pants/);
  assert.match(accountHtml, /Loyalty rewards . 10% . 20% . free pants/);
  assert.match(accountHtml, /10% Email Discount/);
  assert.match(accountHtml, /do not stack/);
  assert.match(accountHtml, /Track an order/);
  assert.match(accountHtml, /Order number \(Reference\)/);
  assert.match(accountHtml, /Email on the order/);

  // The provided two-sided artwork renders as one accessible 3D-flipping card.
  const { LoyaltyCard } = await vite.ssrLoadModule('/src/components/account/LoyaltyCard.tsx');
  const cardHtml = renderToStaticMarkup(
    React.createElement(LoyaltyCard, {
      memberName: 'Test Member',
      email: 'member@example.test',
      progress: 2,
    })
  );
  assert.match(cardHtml, /loyalty-card-3d/);
  assert.match(cardHtml, /data-side="back"/);
  assert.match(cardHtml, /Show the front of your rewards card/);
  assert.match(cardHtml, /loyalty-card-back\.png/);
  assert.match(cardHtml, /loyalty-card-front\.png/);
  assert.match(cardHtml, /2\/5/);
  for (const [asset, expected] of [
    ['public/images/loyalty-card-back.png', [637, 368]],
    ['public/images/loyalty-card-front.png', [636, 364]],
  ]) {
    const png = await readFile(asset);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], expected);
    assert.equal(png[25], 6, 'cropped card keeps transparent pixels around its rounded corners');
  }
  assert.match(css, /perspective:\s*1200px/);
  assert.match(css, /transform:\s*rotateY\(180deg\)/);
  assert.match(css, /backface-visibility:\s*hidden/);

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
  assert.match(accountSource, /This reward never/);
  assert.match(accountSource, /stays unlocked until you redeem it/);
  assert.doesNotMatch(accountSource, /Forfeited/);
});
