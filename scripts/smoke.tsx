/* Temporary render smoke test (not part of the shipped app). */
import fs from 'node:fs';
import { AuthProvider } from '../src/context/AuthContext';
import { SiteSettingsProvider } from '../src/context/SiteSettingsContext';
import { WishlistProvider } from '../src/context/WishlistContext';
import { CartProvider } from '../src/context/CartContext';
import { UIProvider } from '../src/context/UIContext';
import { AppShell } from '../src/App';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { createElement as h } from 'react';

const store = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.window === 'undefined') {
  const windowStub = {
    localStorage: localStorageStub,
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }),
    scrollTo() {},
    addEventListener() {},
    removeEventListener() {},
    setTimeout: (fn: () => void) => setTimeout(fn, 0),
    clearTimeout: (id: number) => clearTimeout(id),
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0),
    innerWidth: 1440,
    innerHeight: 900,
  };
  g.window = windowStub;
  g.document = {
    documentElement: { classList: { add() {}, remove() {}, contains: () => false } },
    body: { classList: { add() {}, remove() {} }, appendChild() {} },
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
  };
  g.localStorage = localStorageStub;
  g.matchMedia = (windowStub as { matchMedia: () => unknown }).matchMedia;
}

const routes: Array<[string, RegExp | null, string]> = [
  ['/', /tws-spray/, 'hero paint'],
  ['/', /FASHION/, 'hero tagline'],
  ['/shop', /All pieces/i, 'shop heading'],
  ['/collections', /Collection/i, 'collections list'],
  ['/collections/drop-01-2026', /Drop 01/, 'collection detail'],
  ['/product/the-midnight-wide-flare', /Midnight Wide-Flare/, 'pdp title'],
  ['/product/the-onyx-super-flare', /Onyx Super-Flare/, 'pdp title 2'],
  ['/about', /fashion beyond limits/i, 'about manifesto'],
  ['/journal', /atelier/i, 'journal index'],
  ['/journal/against-the-skinny', /AGAINST THE SKINNY/, 'journal entry'],
  ['/checkout', /Cash on delivery only/, 'checkout'],
  ['/order-confirmation/TWS-123456', /Order verification|verification/i, 'confirmation'],
  ['/nope-404', /404/, 'not found'],
  ['/?piece=the-onyx-super-flare', /quick view|Add to bag/i, 'quick view'],
];

let failures = 0;

for (const [route, pattern, label] of routes) {
  try {
    const html = renderToStaticMarkup(
      h(
        MotionConfig,
        { reducedMotion: 'user' } as Record<string, unknown>,
        h(
          AuthProvider,
          null,
          h(
            SiteSettingsProvider,
            null,
            h(
              WishlistProvider,
              null,
              h(
                CartProvider,
                null,
                h(MemoryRouter, { initialEntries: [route] }, h(UIProvider, null, h(AppShell, null)))
              )
            )
          )
        )
      )
    );
    if (route === '/' && !globalThis.__dumped) { globalThis.__dumped = true; fs.writeFileSync('/tmp/home.html', html); }
    const missing = pattern && !pattern.test(html) ? ` ⚠ missing ${label}` : '';
    if (missing) failures += 1;
    console.log(`✓ ${route.padEnd(38)} ${String(html.length).padStart(7)} chars${missing}`);
  } catch (error) {
    failures += 1;
    console.log(`✗ ${route}\n   ${(error as Error).message}`);
    console.log((error as Error).stack?.split('\n').slice(1, 5).join('\n') ?? '');
  }
}

(async () => {
/* ---- deep pass: render the interior pages directly (the router path
   above renders Suspense fallbacks for lazy chunks, which proves nothing
   about the page bodies themselves) ---- */
const { default: seededStore } = { default: store };
seededStore.set(
  'tws_cart_v2',
  JSON.stringify([
    {
      variant_id: 'v-mny-m',
      product_id: 'demo-midnight-wide-flare',
      product_name: 'The Midnight Wide-Flare',
      product_slug: 'the-midnight-wide-flare',
      product_image: '/images/pants-navy.png',
      color_name: 'Midnight Navy',
      color_hex: '#152c4e',
      size_name: 'M',
      unit_price: 2450,
      original_price: 2750,
      quantity: 1,
      max_stock: 15,
    },
  ])
);

const pages = await Promise.all([
  import('../src/pages/ShopPage').then((m) => ['shop', m.ShopPage, /All pieces/i]),
  import('../src/pages/CollectionsPage').then((m) => ['collections', m.CollectionsPage, /Collection 01/i]),
  import('../src/pages/CollectionPage').then((m) => ['collection', m.CollectionPage, /pieces/i]),
  import('../src/pages/ProductPage').then((m) => ['pdp', m.ProductPage, /Add size/i]),
  import('../src/pages/AboutPage').then((m) => ['about', m.AboutPage, /Sizes &amp; fit/i]),
  import('../src/pages/JournalPage').then((m) => ['journal', m.JournalPage, /Lead entry/i]),
  import('../src/pages/JournalEntryPage').then((m) => ['entry', m.JournalEntryPage, /Read the entry|Next in the journal/i]),
  import('../src/pages/CheckoutPage').then((m) => ['checkout', m.CheckoutPage, /Place cash-on-delivery order/i]),
  import('../src/pages/OrderConfirmationPage').then((m) => ['confirmation', m.OrderConfirmationPage, /Order TWS-123456/i]),
  import('../src/pages/NotFoundPage').then((m) => ['404', m.NotFoundPage, /404/]),
]);

for (const [name, Page, pattern] of pages as Array<[string, () => JSX.Element, RegExp]>) {
  const route =
    name === 'collection'
      ? '/collections/drop-01-2026'
      : name === 'pdp'
        ? '/product/the-midnight-wide-flare'
        : name === 'entry'
          ? '/journal/against-the-skinny'
          : name === 'confirmation'
            ? '/order-confirmation/TWS-123456'
            : `/${name}`;

  const paramPath: Record<string, string> = {
    collection: '/collections/:slug',
    pdp: '/product/:slug',
    entry: '/journal/:slug',
    confirmation: '/order-confirmation/:orderRef',
  };
  const routed = paramPath[name]
    ? h(Routes, null, h(Route, { path: paramPath[name], element: h(Page, null) }))
    : h(Page, null);

  try {
    const html = renderToStaticMarkup(
      h(
        MotionConfig,
        { reducedMotion: 'user' } as Record<string, unknown>,
        h(
          SiteSettingsProvider,
          null,
          h(
            WishlistProvider,
            null,
            h(
              CartProvider,
              null,
              h(MemoryRouter, { initialEntries: [route] }, h(UIProvider, null, routed))
            )
          )
        )
      )
    );
    const missing = pattern.test(html) ? '' : ` ⚠ missing marker ${pattern}`;
    if (missing) failures += 1;
    console.log(`· ${name.padEnd(14)} ${String(html.length).padStart(7)} chars${missing}`);
  } catch (error) {
    failures += 1;
    console.log(`✗ ${name}\n   ${(error as Error).message}`);
  }
}

console.log(failures === 0 ? '\nALL ROUTES RENDER CLEAN' : `\n${failures} ISSUE(S)`);

})();
