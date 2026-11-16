import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { CartDrawer } from './components/CartDrawer';
import { Navbar } from './components/Navbar';
import { SiteFooter } from './components/SiteFooter';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { WishlistProvider } from './context/WishlistContext';
import { HomePage } from './pages/HomePage';

const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const OrderConfirmationPage = lazy(() =>
  import('./pages/OrderConfirmationPage').then((m) => ({ default: m.OrderConfirmationPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminLoginPage = lazy(() =>
  import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppShell() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="relative min-h-screen bg-[#f5f2eb] text-[#201d1a]">
      <ScrollToTop />

      {!isAdminRoute && <Navbar />}
      {!isAdminRoute && <CartDrawer />}

      <div className="relative">
        <Suspense
          fallback={
            <div className="flex min-h-[70vh] items-center justify-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#8d867d]">
              THREE WAYS STUDIOS…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation/:orderRef" element={<OrderConfirmationPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>

      {!isAdminRoute && <SiteFooter />}
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
                <AppShell />
              </BrowserRouter>
            </CartProvider>
          </WishlistProvider>
        </SiteSettingsProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
