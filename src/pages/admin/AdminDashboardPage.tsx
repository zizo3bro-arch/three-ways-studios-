import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Box,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCw,
  ShoppingBag,
  Tag,
  Users,
} from 'lucide-react';
import { AdminContentTab } from '../../components/admin/AdminContentTab';
import { AdminCustomersTab } from '../../components/admin/AdminCustomersTab';
import { AdminDiscountsTab } from '../../components/admin/AdminDiscountsTab';
import { AdminInventoryTab } from '../../components/admin/AdminInventoryTab';
import { AdminOrdersTab } from '../../components/admin/AdminOrdersTab';
import { AdminOverviewTab } from '../../components/admin/AdminOverviewTab';
import { AdminProductsTab } from '../../components/admin/AdminProductsTab';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Customer, DiscountRule, Order, Product } from '../../types/database';

type AdminTab =
  | 'overview'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'discounts'
  | 'content';

const TABS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Box },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'discounts', label: 'Discounts', icon: Tag },
  { id: 'content', label: 'Website Content', icon: FileText },
];

export function AdminDashboardPage() {
  const { user, isAdmin, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Admin Dashboard — THREE WAYS STUDIOS';
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
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoadingData(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadAll();
    }
  }, [isAdmin, loadAll]);

  if (!isSupabaseConfigured) {
    return <Navigate to="/admin/login" replace />;
  }

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-[75vh] max-w-4xl items-center justify-center px-5 pt-28">
        <p className="text-xs tracking-[0.22em] text-[#9e9494] uppercase">
          Verifying Studio Credentials...
        </p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 pt-26 pb-20 sm:px-8 lg:px-12">
      {/* Top Admin Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/12 pb-6">
        <div>
          <p className="text-[10px] tracking-[0.24em] text-[#d4121b] uppercase">
            THREE WAYS STUDIOS · PRIVATE STUDIO CONSOLE
          </p>
          <h1 className="mt-1.5 text-2xl font-normal text-white">Admin Dashboard</h1>
          <p className="mt-1 text-xs text-[#9e9494]">Signed in as {user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadAll}
            disabled={loadingData}
            className="inline-flex items-center gap-1.5 border border-white/20 px-4 py-2 text-[11px] tracking-[0.14em] text-[#e6dfdf] uppercase hover:border-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 border border-white/20 px-4 py-2 text-[11px] tracking-[0.14em] text-[#e6dfdf] uppercase hover:border-white"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Storefront
          </Link>

          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 border border-[#b30e16]/50 px-4 py-2 text-[11px] tracking-[0.14em] text-[#e87a80] uppercase hover:bg-[#b30e16] hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs transition-all ${
                active
                  ? 'bg-[#b30e16] font-medium text-white'
                  : 'border border-white/15 bg-black/35 text-[#cfc6c6] hover:border-white/40 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {fetchError && (
        <div className="mt-6 border border-[#ff6b6b]/40 bg-[#2a090c] p-4 text-xs text-[#ffb3b3]">
          {fetchError}
        </div>
      )}

      {/* Active Tab Content */}
      <div className="mt-8">
        {activeTab === 'overview' && (
          <AdminOverviewTab
            orders={orders}
            products={products}
            onNavigateTab={(t) => setActiveTab(t)}
          />
        )}
        {activeTab === 'products' && (
          <AdminProductsTab products={products} onRefresh={loadAll} />
        )}
        {activeTab === 'inventory' && (
          <AdminInventoryTab products={products} onRefresh={loadAll} />
        )}
        {activeTab === 'orders' && <AdminOrdersTab orders={orders} onRefresh={loadAll} />}
        {activeTab === 'customers' && (
          <AdminCustomersTab customers={customers} orders={orders} />
        )}
        {activeTab === 'discounts' && (
          <AdminDiscountsTab discounts={discounts} onRefresh={loadAll} />
        )}
        {activeTab === 'content' && <AdminContentTab />}
      </div>
    </main>
  );
}
