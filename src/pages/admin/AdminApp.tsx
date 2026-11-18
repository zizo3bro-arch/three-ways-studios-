import { Suspense, lazy } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';

/* =========================================================
   THE STUDIO CONSOLE — a separate application tree.

   · Mounted only under /admin, in its own lazy chunk.
   · Never shares the storefront navigation, footer, cart or
     overlays: there is no way "out" to the shop except the
     deliberate "view storefront" link.
   · Every route below the login is wrapped in <RequireAdmin>,
     which waits for the session check to resolve before it
     decides anything, so a refresh on /admin never flashes the
     storefront and never renders the dashboard to a stranger.
   · The guard is UX only. The real boundary is Supabase RLS:
     every admin table policy calls public.is_admin(), and admin mutations check staff membership on the server.
   ========================================================= */

const AdminLoginPage = lazy(() =>
  import('./AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);

function requireEnvFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center paper-surface px-5 text-center">
      <div className="max-w-md">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-crimson">Studio console</p>
        <h1 className="mt-3 font-display text-3xl uppercase leading-none text-ink">
          Backend not connected
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-faint">
          This build has no Supabase credentials. Set <code className="text-ink">VITE_SUPABASE_URL</code>{' '}
          and <code className="text-ink">VITE_SUPABASE_ANON_KEY</code> in the deployment environment,
          then redeploy.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center justify-center border border-ink/25 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-ink transition-colors hover:border-ink"
        >
          View storefront
        </Link>
      </div>
    </div>
  );
}

function AdminLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center paper-surface">
      <div className="text-center">
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border border-ink/20 border-t-crimson" />
        <p className="mt-4 text-[9.5px] font-bold uppercase tracking-[0.26em] text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AdminLoading label="Verifying studio credentials" />;

  if (!user || !isAdmin) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname, reason: user && !isAdmin ? 'not-admin' : undefined }}
      />
    );
  }

  return <>{children}</>;
}

export function AdminApp() {
  if (!isSupabaseConfigured) {
    return requireEnvFallback();
  }

  return (
    <AuthProvider>
      <AdminTree />
    </AuthProvider>
  );
}

function AdminTree() {
  const { user, isAdmin, loading } = useAuth();

  return (
    <div className="min-h-screen paper-surface text-ink">
      <Suspense fallback={<AdminLoading label="Opening console" />}>
        <Routes>
          <Route
            path="login"
            element={!loading && user && isAdmin ? <Navigate to="/admin" replace /> : <AdminLoginPage />}
          />
          <Route
            path="/"
            element={
              <RequireAdmin>
                <AdminDashboardPage />
              </RequireAdmin>
            }
          />
          <Route
            path="*"
            element={
              <RequireAdmin>
                <Navigate to="/admin" replace />
              </RequireAdmin>
            }
          />
        </Routes>
      </Suspense>
    </div>
  );
}
