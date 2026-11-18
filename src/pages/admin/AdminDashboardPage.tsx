import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  ShoppingBag,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { AdminContentTab } from '../../components/admin/AdminContentTab';
import { AdminCustomersTab } from '../../components/admin/AdminCustomersTab';
import { AdminDiscountsTab } from '../../components/admin/AdminDiscountsTab';
import { AdminInventoryTab } from '../../components/admin/AdminInventoryTab';
import { AdminOrdersTab } from '../../components/admin/AdminOrdersTab';
import { AdminOverviewTab } from '../../components/admin/AdminOverviewTab';
import { AdminProductsTab } from '../../components/admin/AdminProductsTab';
import { useAuth } from '../../context/AuthContext';
import { adminClient as supabase } from '../../lib/adminClient';
import { studioUrl } from '../../lib/supabase';
import type { Customer, DiscountRule, Order, Product } from '../../types/database';

/* =========================================================
   THE DASHBOARD
   Same data, same tabs, same Supabase boundary: a fixed rail on
   desktop, a drawer on mobile, a live status strip, and a clear
   separation between the console and the storefront.
   ========================================================= */

type AdminTab = 'overview' | 'products' | 'inventory' | 'orders' | 'customers' | 'discounts' | 'content';

const TABS: Array<{
  id: AdminTab;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', hint: 'Trading at a glance', icon: LayoutDashboard },
  { id: 'products', label: 'Products', hint: 'Create and edit pieces', icon: Package },
  { id: 'inventory', label: 'Inventory', hint: 'Stock by size', icon: Box },
  { id: 'orders', label: 'Orders', hint: 'COD pipeline', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', hint: 'Accounts and buyers', icon: Users },
  { id: 'discounts', label: 'Discounts', hint: 'Promo rules', icon: Tag },
  { id: 'content', label: 'Site content', hint: 'Hero, nav, footer', icon: FileText },
];

/** Project only non-sensitive customer profile & delivery columns into UI state. */
function toSafeCustomer(row: Record<string, unknown>): Customer {
  const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const createdAt = str(row.created_at);
  const registeredAt = str(row.registered_at) || createdAt || null;
  const authUserId = str(row.auth_user_id) || null;
  return {
    id: str(row.id),
    auth_user_id: authUserId,
    full_name: str(row.full_name),
    email: str(row.email),
    phone: str(row.phone),
    governorate: str(row.governorate),
    city: str(row.city),
    address: str(row.address),
    is_registered: Boolean(row.is_registered || authUserId),
    registered_at: registeredAt,
    created_at: createdAt,
    updated_at: str(row.updated_at) || createdAt,
  };
}

async function fetchAdminCustomers(): Promise<{ customers: Customer[]; legacyFallback: boolean }> {
  if (!supabase) return { customers: [], legacyFallback: false };

  const rpcRes = await supabase.rpc('admin_list_customers');
  if (!rpcRes.error) {
    const rows = Array.isArray(rpcRes.data) ? rpcRes.data : [];
    return {
      customers: rows
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map(toSafeCustomer)
        .filter((item) => Boolean(item.id && item.email)),
      legacyFallback: false,
    };
  }

  // Missing RPC signature on an installation that has not run migration 008 yet:
  // preserve existing direct table query under admin RLS without failing the console.
  if (rpcRes.error.code === 'PGRST202') {
    const tableRes = await supabase
      .from('customers')
      .select('id, full_name, email, phone, governorate, city, address, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (tableRes.error) throw new Error(tableRes.error.message);
    return {
      customers: (tableRes.data ?? []).map((item) =>
        toSafeCustomer(item as unknown as Record<string, unknown>)
      ),
      legacyFallback: true,
    };
  }

  throw new Error(rpcRes.error.message);
}

export function AdminDashboardPage() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [railOpen, setRailOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLegacyMode, setCustomersLegacyMode] = useState(false);
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    document.title = 'Studio Console — THREE WAYS STUDIOS';
  }, []);

  const refreshCustomers = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    try {
      const result = await fetchAdminCustomers();
      setCustomers(result.customers);
      setCustomersLegacyMode(result.legacyFallback);
      setLastSynced(new Date());
    } catch {
      // Preserve last verified list during silent background refresh.
    }
  }, [isAdmin]);

  const loadAll = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    setLoadingData(true);
    setFetchError(null);

    try {
      const [prodRes, orderRes, custResult, discRes] = await Promise.all([
        supabase
          .from('products')
          .select(
            '*, images:product_images(*), variants:product_variants(*), size_charts:size_charts(*)'
          )
          .order('created_at', { ascending: false }),
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
        fetchAdminCustomers(),
        supabase.from('discount_rules').select('*').order('created_at', { ascending: false }),
      ]);

      if (prodRes.error) throw new Error(prodRes.error.message);
      if (orderRes.error) throw new Error(orderRes.error.message);
      if (discRes.error) throw new Error(discRes.error.message);

      setProducts(
        (prodRes.data ?? []).map((p: Product) => ({
          ...p,
          price: Number(p.price),
          original_price: p.original_price !== null ? Number(p.original_price) : null,
          images: [...(p.images ?? [])].sort((a, b) => a.display_order - b.display_order),
          size_charts: [...(p.size_charts ?? [])].sort((a, b) => a.size_order - b.size_order),
        }))
      );
      setOrders((orderRes.data ?? []) as Order[]);
      setCustomers(custResult.customers);
      setCustomersLegacyMode(custResult.legacyFallback);
      setDiscounts((discRes.data ?? []) as DiscountRule[]);
      setLastSynced(new Date());
      hasLoadedOnce.current = true;
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) void loadAll();
  }, [isAdmin, loadAll]);

  // Keep the customer directory fresh automatically when opening the Customers tab
  // or returning focus to the console after a storefront signup.
  useEffect(() => {
    if (!isAdmin || activeTab !== 'customers') return;
    if (hasLoadedOnce.current) void refreshCustomers();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshCustomers();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeTab, isAdmin, refreshCustomers]);

  // Subscribe to live public.customers inserts/updates so newly registered users
  // appear automatically without a manual page reload.
  useEffect(() => {
    const client = supabase;
    if (!client || !isAdmin || !studioUrl || studioUrl.includes('.invalid')) return;
    const channel = client
      .channel('tws-admin-customers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        void refreshCustomers();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [isAdmin, refreshCustomers]);

  const activeMeta = useMemo(() => TABS.find((tab) => tab.id === activeTab) ?? TABS[0], [activeTab]);

  const pendingOrders = orders.filter((order) => order.status === 'pending').length;

  const counts: Partial<Record<AdminTab, number>> = {
    products: products.length,
    orders: orders.length,
    customers: customers.length,
    discounts: discounts.length,
  };

  const handleSelect = (tab: AdminTab) => {
    setActiveTab(tab);
    setRailOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/admin/login', { replace: true });
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  return (
    <div className="min-h-screen paper-surface">
      {/* ——— mobile top bar ——— */}
      <div className="sticky top-0 z-40 flex h-15 items-center justify-between gap-3 border-b border-ink/12 paper-surface px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Open console navigation"
          className="flex h-10 w-10 items-center justify-center border border-ink/18 text-ink"
        >
          <Menu className="h-4 w-4" />
        </button>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-crimson">Studio console</p>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="flex h-10 w-10 items-center justify-center border border-ink/18 text-ink-faint"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="lg:flex">
        {/* ——— rail ——— */}
        <aside
          className={[
            'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-ink/12 paper-surface transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            railOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3 border-b border-ink/12 px-5 py-5">
            <div className="flex items-center gap-3">
              <img src="/assets/three-ways-studios-logo.png" alt="" className="h-9 w-9 object-contain" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink">Three Ways</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-crimson">
                  Studio console
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRailOpen(false)}
              aria-label="Close navigation"
              className="text-ink-faint lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav aria-label="Console sections" className="flex-1 overflow-y-auto px-3 py-4">
            <p className="px-2 pb-2 text-[9.5px] font-bold uppercase tracking-[0.24em] text-ink-faint">
              Manage
            </p>
            <ul className="space-y-0.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                const count = counts[tab.id];
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(tab.id)}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'group flex w-full items-center gap-3 px-2.5 py-2.5 text-left transition-colors',
                        active
                          ? 'bg-crimson/8 text-ink'
                          : 'text-ink-faint hover:bg-ink/[0.04] hover:text-crimson',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-8 w-8 shrink-0 items-center justify-center border transition-colors',
                          active
                            ? 'border-crimson bg-crimson text-paper'
                            : 'border-ink/14 text-ink-faint group-hover:border-ink/30',
                        ].join(' ')}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium">{tab.label}</span>
                        <span className="mt-0.5 block truncate text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                          {tab.hint}
                        </span>
                      </span>
                      {typeof count === 'number' && count > 0 ? (
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink-faint">
                          {count}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-ink/12 px-4 py-4">
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-ink-faint">Signed in</p>
            <p className="mt-0.5 truncate text-[12.5px] text-ink">{user?.email}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-1.5 border border-ink/18 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-ink/50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Site
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex h-10 items-center justify-center gap-1.5 border border-crimson/50 text-[10px] font-bold uppercase tracking-[0.14em] text-crimson-deep transition-colors hover:bg-crimson-deep hover:text-paper"
              >
                <LogOut className="h-3.5 w-3.5" />
                Out
              </button>
            </div>
          </div>
        </aside>

        {railOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setRailOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
        ) : null}

        {/* ——— content ——— */}
        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-7 lg:px-10 lg:pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/12 pb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-crimson">
                {activeMeta.label}
              </p>
              <h1 className="mt-1.5 font-display text-[2rem] uppercase leading-none tracking-[0.01em] text-ink sm:text-[2.45rem]">
                {activeMeta.label}
              </h1>
              <p className="mt-1.5 text-[12.5px] text-ink-faint">
                {fetchError
                  ? 'Data could not be loaded — see the notice below.'
                  : loadingData
                    ? 'Synchronising with Supabase…'
                    : lastSynced
                      ? `Synced ${lastSynced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${pendingOrders} pending ${pendingOrders === 1 ? 'order' : 'orders'}`
                      : activeMeta.hint}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadAll()}
                disabled={loadingData}
                className="inline-flex h-10 items-center gap-1.5 border border-ink/22 px-4 text-[10.5px] font-bold uppercase tracking-[0.15em] text-ink-soft transition-colors hover:border-ink disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {fetchError ? (
            <div
              role="alert"
              className="mt-5 border-l-2 border-crimson bg-[rgba(189,26,34,0.1)] px-4 py-3 text-[12.5px] leading-relaxed text-crimson-deep"
            >
              <p className="font-semibold">Supabase said:</p>
              <p className="mt-1">{fetchError}</p>
              <p className="mt-2 text-ink-faint">
                Check that the migration in <code>supabase/</code> has been applied and that your account
                has a row in <code>public.admin_users</code>.
              </p>
            </div>
          ) : null}

          {/* mobile tab strip */}
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelect(tab.id)}
                className={[
                  'shrink-0 border px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.13em] transition-colors',
                  activeTab === tab.id
                    ? 'border-crimson bg-crimson text-paper'
                    : 'border-ink/18 text-ink-faint',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-7">
            {activeTab === 'overview' && (
              <AdminOverviewTab
                orders={orders}
                products={products}
                onNavigateTab={(t) => setActiveTab(t)}
              />
            )}
            {activeTab === 'products' && <AdminProductsTab products={products} onRefresh={loadAll} />}
            {activeTab === 'inventory' && <AdminInventoryTab products={products} onRefresh={loadAll} />}
            {activeTab === 'orders' && <AdminOrdersTab orders={orders} onRefresh={loadAll} />}
            {activeTab === 'customers' && (
              <AdminCustomersTab
                customers={customers}
                orders={orders}
                legacyMode={customersLegacyMode}
                onRefresh={refreshCustomers}
              />
            )}
            {activeTab === 'discounts' && (
              <AdminDiscountsTab discounts={discounts} onRefresh={loadAll} />
            )}
            {activeTab === 'content' && <AdminContentTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
