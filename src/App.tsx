import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { CartDrawer } from './components/layout/CartDrawer';
import { Navbar } from './components/layout/Navbar';
import { SiteFooter } from './components/layout/SiteFooter';
import { MobileMenu } from './components/layout/MobileMenu';
import { SearchOverlay } from './components/overlays/SearchOverlay';
import { AccountPanel } from './components/overlays/AccountPanel';
import { CartProvider } from './context/CartContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { UIProvider, useUI } from './context/UIContext';
import { WishlistProvider } from './context/WishlistContext';
import { applyMeta } from './lib/seo';
import { HomePage } from './pages/HomePage';

const QuickView = lazy(() =>
  import('./components/shop/QuickView').then((m) => ({ default: m.QuickView }))
);
const CartPage = lazy(() => import('./pages/CartPage').then((m) => ({ default: m.CartPage })));
const PolicyPage = lazy(() => import('./pages/PolicyPage').then((m) => ({ default: m.PolicyPage })));
const ShopPage = lazy(() => import('./pages/ShopPage').then((m) => ({ default: m.ShopPage })));
const CollectionsPage = lazy(() =>
  import('./pages/CollectionsPage').then((m) => ({ default: m.CollectionsPage }))
);
const CollectionPage = lazy(() =>
  import('./pages/CollectionPage').then((m) => ({ default: m.CollectionPage }))
);
const ProductPage = lazy(() => import('./pages/ProductPage').then((m) => ({ default: m.ProductPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const JournalPage = lazy(() => import('./pages/JournalPage').then((m) => ({ default: m.JournalPage })));
const JournalEntryPage = lazy(() =>
  import('./pages/JournalEntryPage').then((m) => ({ default: m.JournalEntryPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const OrderConfirmationPage = lazy(() =>
  import('./pages/OrderConfirmationPage').then((m) => ({ default: m.OrderConfirmationPage }))
);

/* the entire admin console is a separate lazy chunk: a storefront
   visitor never downloads admin code, and an admin never downloads
   the storefront shell. */
const AdminApp = lazy(() => import('./pages/admin/AdminApp').then((m) => ({ default: m.AdminApp })));

/* ——— scroll behaviour: top on route change, element on #hash ——— */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const targetId = hash.replace(/^#/, '');
      let attempts = 0;
      let timer: number | undefined;

      const tryScroll = () => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
            block: 'start',
          });
          return;
        }
        attempts += 1;
        if (attempts < 14) timer = window.setTimeout(tryScroll, 90);
      };

      const frame = window.requestAnimationFrame(tryScroll);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <p className="tws-eyebrow animate-pulse text-ink-faint">THREE WAYS STUDIOS…</p>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();

  // ProductPage writes its own head once the product resolves, so the router
  // stays out of the way there rather than flashing a generic title.
  useEffect(() => {
    if (location.pathname.startsWith('/product/')) return;
    applyMeta(location.pathname);
  }, [location.pathname]);

  return (
    <>
      <ScrollManager />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ——— the storefront ——— */}
          <Route
            path="*"
            element={
              <StorefrontChrome>
                <StorefrontRoutes />
              </StorefrontChrome>
            }
          />

          {/* ——— the studio console, mounted separately ——— */}
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </Suspense>
    </>
  );
}

function StorefrontRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/collections" element={<CollectionsPage />} />
      <Route path="/collections/:slug" element={<CollectionPage />} />
      <Route path="/product/:slug" element={<ProductPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/journal/:slug" element={<JournalEntryPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/privacy" element={<PolicyPage privacy />} />
      <Route path="/terms" element={<PolicyPage privacy={false} />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/order-confirmation/:orderRef" element={<OrderConfirmationPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function StorefrontChrome({ children }: { children: React.ReactNode }) {
  const { quickViewSlug } = useUI();
  return (
    <>
      {/* skip link — real anchor to the first content region */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[95] focus:bg-ink focus:px-5 focus:py-3 focus:text-[10px] focus:font-bold focus:uppercase focus:tracking-[0.2em] focus:text-[#f7f4ed]"
      >
        Skip to content
      </a>

      <Navbar />

      <main className="relative z-10" id="main" tabIndex={-1}>
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </main>

      <SiteFooter />

      {/* the shell: bag, search, account, mobile menu, quick view */}
      <CartDrawer />
      <SearchOverlay />
      <AccountPanel />
      <MobileMenu />
      {quickViewSlug && (
        <Suspense fallback={null}>
          <QuickView />
        </Suspense>
      )}
    </>
  );
}

/* The auth provider lives in the admin tree, not here: the storefront
   never mounts a session, never refreshes a token and never asks
   Supabase who is signed in. A shopper's browser does not carry an
   administrative session at all. */
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteSettingsProvider>
        <WishlistProvider>
          <CartProvider>
            <BrowserRouter>
              <UIProvider>
                <AppShell />
              </UIProvider>
            </BrowserRouter>
          </CartProvider>
        </WishlistProvider>
      </SiteSettingsProvider>
    </MotionConfig>
  );
}
