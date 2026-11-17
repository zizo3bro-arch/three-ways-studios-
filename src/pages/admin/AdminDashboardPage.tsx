import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import type { Customer, DiscountRule, Order, Product } from '../../types/database';

/* =========================================================
   THE DASHBOARD
   Same data, same tabs, same Supabase calls as before — rewrapped
   in a console that can actually be worked in: a fixed rail on
   desktop, a drawer on mobile, a live status strip, and a clear
   separation between the console and the storefront.
   ========================================================= */

type AdminTab =
  | 'overview'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'discounts'
  | 'content';

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
  { id: 'customers', label: 'Customers', hint: 'Buyers and history', icon: Users },
  { id: 'discounts', label: 'Discounts', hint: 'Promo rules', icon: Tag },
  { id: 'content', label: 'Site content', hint: 'Hero, nav, footer', icon: FileText },
];

export function AdminDashboardPage() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [railOpen, setRailOpen] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    document.title = 'Studio Console — THREE WAYS STUDIOS';
  }, []);

  const loadAll = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    setLoadingData(true);
    setFetchError(null);

    try {
      const [prodRes, orderRes, custRes, discRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, images:product_images(*), variants:product_variants(*), size_charts:size_charts(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('discount_rules').select('*').order('created_at', { ascending: false }),
      ]);

      if (prodRes.error) throw new Error(prodRes.error.message);
      if (orderRes.error) throw new Error(orderRes.error.message);
      if (custRes.error) throw new Error(custRes.error.message);
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
      setCustomers((custRes.data ?? []) as Customer[]);
      setDiscounts((discRes.data ?? []) as DiscountRule[]);
      setLastSynced(new Date());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) void loadAll();
  }, [isAdmin, loadAll]);

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
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0e0a09]">
      {/* ——— mobile top bar ——— */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-[#0e0a09]/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Open console navigation"
          className="flex h-9 w-9 items-center justify-center border border-white/15 text-white"
        >
          <Menu className="h-4 w-4" />
        </button>
        <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#bd1a22]">
          Studio console
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="flex h-9 w-9 items-center justify-center border border-white/15 text-[#a89e98]"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="lg:flex">
        {/* ——— rail ——— */}
        <aside
          className={[
            'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-white/10 bg-[#0e0a09] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            railOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/three-ways-studios-logo.png"
                alt=""
                className="h-8 w-8 object-contain"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                  Three Ways
                </p>
                <p className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#bd1a22]">
                  Studio console
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRailOpen(false)}
              aria-label="Close navigation"
              className="text-[#8d8480] lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav aria-label="Console sections" className="flex-1 overflow-y-auto px-3 py-4">
            <p className="px-2 pb-2 text-[8.5px] font-bold uppercase tracking-[0.26em] text-[#5f5854]">
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
                          ? 'bg-white/[0.07] text-white'
                          : 'text-[#a89e98] hover:bg-white/[0.04] hover:text-white',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-7 w-7 shrink-0 items-center justify-center border transition-colors',
                          active
                            ? 'border-[#bd1a22] bg-[#bd1a22] text-white'
                            : 'border-white/12 text-[#8d8480] group-hover:border-white/30',
                        ].join(' ')}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium">{tab.label}</span>
                        <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.1em] text-[#5f5854]">
                          {tab.hint}
                        </span>
                      </span>
                      {typeof count === 'number' && count > 0 ? (
                        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[#8d8480]">
                          {count}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-white/10 px-4 py-4">
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[#8d8480]">Signed in</p>
            <p className="mt-0.5 truncate text-[11.5px] text-white">{user?.email}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 border border-white/15 text-[9px] font-bold uppercase tracking-[0.14em] text-[#e6dfdf] transition-colors hover:border-white/50"
              >
                <ExternalLink className="h-3 w-3" />
                Site
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex h-9 items-center justify-center gap-1.5 border border-[#bd1a22]/50 text-[9px] font-bold uppercase tracking-[0.14em] text-[#e87a80] transition-colors hover:bg-[#bd1a22] hover:text-white"
              >
                <LogOut className="h-3 w-3" />
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
        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-7 lg:px-9 lg:pt-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#bd1a22]">
                {activeMeta.label}
              </p>
              <h1 className="mt-1.5 font-display text-[1.9rem] uppercase leading-none tracking-[0.01em] text-white sm:text-[2.3rem]">
                {activeMeta.label}
              </h1>
              <p className="mt-1.5 text-[11.5px] text-[#8d8480]">
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
                className="inline-flex h-9 items-center gap-1.5 border border-white/20 px-3.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#e6dfdf] transition-colors hover:border-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {fetchError ? (
            <div
              role="alert"
              className="mt-5 border-l-2 border-[#bd1a22] bg-[rgba(189,26,34,0.1)] px-4 py-3 text-[11.5px] leading-relaxed text-[#f0b9b6]"
            >
              <p className="font-semibold">Supabase said:</p>
              <p className="mt-1">{fetchError}</p>
              <p className="mt-2 text-[#c39a98]">
                Check that the migration in <code>supabase/</code> has been applied and that your
                account has a row in <code>public.admin_users</code>.
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
                  'shrink-0 border px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] transition-colors',
                  activeTab === tab.id
                    ? 'border-[#bd1a22] bg-[#bd1a22] text-white'
                    : 'border-white/15 text-[#a89e98]',
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
            {activeTab === 'customers' && <AdminCustomersTab customers={customers} orders={orders} />}
            {activeTab === 'discounts' && <AdminDiscountsTab discounts={discounts} onRefresh={loadAll} />}
            {activeTab === 'content' && <AdminContentTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
