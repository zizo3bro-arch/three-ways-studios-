import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { CartDrawer } from './components/layout/CartDrawer';
import { Navbar } from './components/layout/Navbar';
import { SiteFooter } from './components/layout/SiteFooter';
import { MobileMenu } from './components/layout/MobileMenu';
import { SearchOverlay } from './components/overlays/SearchOverlay';
import { AccountPanel } from './components/overlays/AccountPanel';
import { QuickView } from './components/shop/QuickView';
import { ScrollProgress } from './components/ui/ScrollProgress';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { UIProvider } from './context/UIContext';
import { WishlistProvider } from './context/WishlistContext';
import { HomePage } from './pages/HomePage';

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
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() =>
  import('./pages/OrderConfirmationPage').then((m) => ({ default: m.OrderConfirmationPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminLoginPage = lazy(() =>
  import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);

/* ——— titles, so a refresh on any page keeps the house voice ——— */
const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, 'THREE WAYS STUDIOS — Fashion Beyond Limits'],
  [/^\/shop/, 'The Shop — THREE WAYS STUDIOS'],
  [/^\/collections\/[^/]+/, 'Collection — THREE WAYS STUDIOS'],
  [/^\/collections/, 'Collections — THREE WAYS STUDIOS'],
  [/^\/about/, 'The House — THREE WAYS STUDIOS'],
  [/^\/journal\/[^/]+/, 'Journal — THREE WAYS STUDIOS'],
  [/^\/journal/, 'The Journal — THREE WAYS STUDIOS'],
  [/^\/checkout/, 'Checkout (Cash on Delivery) — THREE WAYS STUDIOS'],
  [/^\/order-confirmation/, 'Order confirmed — THREE WAYS STUDIOS'],
  [/^\/admin/, 'Studio Dashboard — THREE WAYS STUDIOS'],
];

function titleForPath(pathname: string): string | null {
  for (const [pattern, title] of TITLES) {
    if (pattern.test(pathname)) return title;
  }
  return null;
}

/* ——— scroll behaviour: top on route change, element on #hash ——— */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const targetId = hash.replace(/^#/, '');
      let attempts = 0;

      const tryScroll = () => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        attempts += 1;
        if (attempts < 14) window.setTimeout(tryScroll, 90);
      };

      window.requestAnimationFrame(tryScroll);
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    const title = titleForPath(location.pathname);
    if (title && !location.pathname.startsWith('/product/')) document.title = title;
  }, [location.pathname]);

  if (isAdminRoute) {
    return (
      <div className="tws-paper min-h-screen text-ink">
        <ScrollManager />
        <ScrollProgress />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </div>
    );
  }

  return (
    <div className="tws-paper relative min-h-screen text-ink">
      <ScrollManager />
      <ScrollProgress />

      {/* skip link — real anchor to the first content region */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[95] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-[10px] focus:font-bold focus:uppercase focus:tracking-[0.2em] focus:text-ivory"
      >
        Skip to content
      </a>

      <Navbar />

      <main className="relative z-10" id="main" tabIndex={-1}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/:slug" element={<CollectionPage />} />
            <Route path="/product/:slug" element={<ProductPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/journal/:slug" element={<JournalEntryPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation/:orderRef" element={<OrderConfirmationPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>

      <SiteFooter />

      {/* the shell: bag, search, account, mobile menu, quick view */}
      <CartDrawer />
      <SearchOverlay />
      <AccountPanel />
      <MobileMenu />
      <QuickView />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
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
      </AuthProvider>
    </MotionConfig>
  );
}
