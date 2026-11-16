import { AlertTriangle, CheckCircle2, Clock, Package, ShoppingBag, TrendingUp } from 'lucide-react';
import { formatEGP } from '../../lib/format';
import type { Order, Product, ProductVariant } from '../../types/database';

interface AdminOverviewTabProps {
  orders: Order[];
  products: Product[];
  onNavigateTab: (tab: 'products' | 'inventory' | 'orders') => void;
}

export function AdminOverviewTab({ orders, products, onNavigateTab }: AdminOverviewTabProps) {
  const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
  const totalRevenue = nonCancelled.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const completedCount = orders.filter((o) => o.status === 'delivered').length;

  const lowStockVariants: Array<{ productName: string; variant: ProductVariant }> = [];
  for (const p of products) {
    for (const v of p.variants ?? []) {
      if (v.is_active && v.stock_quantity <= v.low_stock_threshold) {
        lowStockVariants.push({ productName: p.name, variant: v });
      }
    }
  }

  const recentOrders = orders.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-white/12 bg-black/45 p-5">
          <div className="flex items-center justify-between text-[#9e9494]">
            <span className="text-[10px] tracking-[0.2em] uppercase">Total Revenue</span>
            <TrendingUp className="h-4 w-4 text-[#d4121b]" />
          </div>
          <p className="mt-3 text-2xl font-medium text-white">{formatEGP(totalRevenue)}</p>
          <p className="mt-1 text-[11px] text-[#847878]">
            {nonCancelled.length} active COD orders
          </p>
        </div>

        <div className="border border-white/12 bg-black/45 p-5">
          <div className="flex items-center justify-between text-[#9e9494]">
            <span className="text-[10px] tracking-[0.2em] uppercase">Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-[#d4121b]" />
          </div>
          <p className="mt-3 text-2xl font-medium text-white">{orders.length}</p>
          <p className="mt-1 text-[11px] text-[#847878]">All statuses combined</p>
        </div>

        <div className="border border-white/12 bg-black/45 p-5">
          <div className="flex items-center justify-between text-[#9e9494]">
            <span className="text-[10px] tracking-[0.2em] uppercase">Pending Orders</span>
            <Clock className="h-4 w-4 text-[#e89d6b]" />
          </div>
          <p className="mt-3 text-2xl font-medium text-white">{pendingCount}</p>
          <p className="mt-1 text-[11px] text-[#847878]">Awaiting confirmation</p>
        </div>

        <div className="border border-white/12 bg-black/45 p-5">
          <div className="flex items-center justify-between text-[#9e9494]">
            <span className="text-[10px] tracking-[0.2em] uppercase">Delivered Orders</span>
            <CheckCircle2 className="h-4 w-4 text-[#7bd389]" />
          </div>
          <p className="mt-3 text-2xl font-medium text-white">{completedCount}</p>
          <p className="mt-1 text-[11px] text-[#847878]">Completed COD deliveries</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Orders Activity */}
        <div className="border border-white/12 bg-black/45 p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-xs font-medium tracking-[0.2em] text-white uppercase">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="text-[10px] tracking-[0.18em] text-[#e87a80] uppercase hover:text-white"
            >
              Manage Orders
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#9e9494]">
              No orders placed yet.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-white/8">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-4 py-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-mono font-medium text-white">{o.order_reference}</p>
                    <p className="truncate text-[11px] text-[#9e9494]">
                      {o.customer_name} · {o.governorate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{formatEGP(o.total_amount)}</p>
                    <span className="inline-block border border-white/15 px-2 py-0.5 text-[10px] tracking-[0.12em] text-[#cfc6c6] uppercase">
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low-Stock Alerts */}
        <div className="border border-white/12 bg-black/45 p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="flex items-center gap-2 text-xs font-medium tracking-[0.2em] text-white uppercase">
              <AlertTriangle className="h-3.5 w-3.5 text-[#e89d6b]" />
              Low-Stock Alerts ({lowStockVariants.length})
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="text-[10px] tracking-[0.18em] text-[#e87a80] uppercase hover:text-white"
            >
              Update Stock
            </button>
          </div>

          {lowStockVariants.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#9e9494]">
              <Package className="mx-auto mb-2 h-6 w-6 opacity-50" />
              All active variants are healthy or no variants created yet.
            </div>
          ) : (
            <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {lowStockVariants.map(({ productName, variant }) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between border border-white/10 bg-black/30 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{productName}</p>
                    <p className="text-[11px] text-[#9e9494]">
                      {variant.color_name} · Size {variant.size_name}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold ${
                      variant.stock_quantity === 0
                        ? 'bg-[#b30e16] text-white'
                        : 'bg-[#e89d6b]/20 text-[#e89d6b]'
                    }`}
                  >
                    {variant.stock_quantity === 0 ? 'OUT' : `${variant.stock_quantity} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
