import { useMemo, useState } from 'react';
import { Eye, Search, X } from 'lucide-react';
import { formatEGP } from '../../lib/format';
import { adminClient as supabase } from '../../lib/adminClient';
import { ADMIN_STATUS_OPTIONS } from '../../lib/orderTracking';
import type { Order, OrderStatus } from '../../types/database';

interface AdminOrdersTabProps {
  orders: Order[];
  onRefresh: () => Promise<void>;
}

export function AdminOrdersTab({ orders, onRefresh }: AdminOrdersTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_reference.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (!supabase) return;
    setUpdatingId(orderId);
    setStatusError(null);
    const { error } = await supabase.rpc('admin_update_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
    });
    setUpdatingId(null);
    if (error) {
      setStatusError(error.message);
      return;
    }
    await onRefresh();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-ink uppercase">
            COD Orders ({orders.length})
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            Manage status progression. Cancelling an order automatically restores variant stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-3.5 w-3.5 text-ink-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref, name, email, phone..."
              className="border border-ink/15 bg-paper/50 py-2 pr-3 pl-8 text-xs text-ink placeholder-ink-faint focus:border-crimson focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
            className="border border-ink/15 bg-paper px-3 py-2 text-xs text-ink"
          >
            <option value="all">All Statuses</option>
            {ADMIN_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusError && (
        <p className="border border-crimson-deep/40 bg-crimson/8 p-3 text-xs text-crimson-deep">
          {statusError}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="border border-ink/12 bg-transparent p-10 text-center text-xs text-ink-faint">
          No orders match your search criteria.
        </div>
      ) : (
        <div className="overflow-x-auto border border-ink/12 bg-transparent">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead>
              <tr className="border-b border-ink/12 text-[10px] tracking-[0.18em] text-ink-faint uppercase">
                <th className="p-4 font-medium">Reference</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Location</th>
                <th className="p-4 font-medium">COD Total</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 text-right font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-ink/[0.02]">
                  <td className="p-4 font-mono font-medium text-ink">
                    {order.order_reference}
                    <p className="font-sans text-[10px] text-ink-faint">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-ink">{order.customer_name}</p>
                    <p className="text-[11px] text-ink-faint">
                      {order.customer_email} · {order.customer_phone}
                    </p>
                  </td>
                  <td className="p-4 text-ink-soft">
                    {order.city}, {order.governorate}
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-ink">{formatEGP(order.total_amount)}</span>
                    {order.discount_total > 0 && (
                      <p className="text-[10px] text-crimson-deep">
                        -{formatEGP(order.discount_total)} disc.
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <select
                      disabled={updatingId === order.id}
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                      className="border border-ink/20 bg-paper px-2.5 py-1 text-[11px] text-ink uppercase"
                    >
                      {ADMIN_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="inline-flex items-center gap-1.5 border border-ink/20 px-3 py-1.5 text-[11px] text-ink hover:border-ink"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-ink/15 paper-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/12 pb-4">
              <div>
                <p className="text-[10px] tracking-[0.2em] text-crimson uppercase">
                  Order Details (COD)
                </p>
                <h3 className="mt-1 font-mono text-lg text-ink">{selectedOrder.order_reference}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full border border-ink/15 p-1.5 text-ink-soft hover:text-crimson"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 border-b border-ink/10 pb-5 text-xs sm:grid-cols-2">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-ink-faint uppercase">Customer</p>
                <p className="mt-1 font-medium text-ink">{selectedOrder.customer_name}</p>
                <p className="text-ink-soft">{selectedOrder.customer_email}</p>
                <p className="text-ink-soft">{selectedOrder.customer_phone}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.18em] text-ink-faint uppercase">
                  Delivery Address
                </p>
                <p className="mt-1 text-ink-soft">{selectedOrder.delivery_address}</p>
                <p className="text-ink-soft">
                  {selectedOrder.city}, {selectedOrder.governorate}
                </p>
                {selectedOrder.order_notes && (
                  <p className="mt-1 text-ink-faint">Notes: {selectedOrder.order_notes}</p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2.5 border-b border-ink/10 pb-5 text-xs">
              <p className="text-[10px] tracking-[0.18em] text-ink-faint uppercase">Items</p>
              {(selectedOrder.order_items ?? []).map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-ink-soft">
                    {item.product_name} ({item.color_name} / {item.size_name}) × {item.quantity}
                  </span>
                  <span className="text-ink">{formatEGP(item.line_total)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>{formatEGP(selectedOrder.subtotal)}</span>
              </div>
              {(selectedOrder.loyalty_discount_amount ?? 0) > 0 && (
                <div className="flex justify-between text-crimson-deep">
                  <span>
                    Loyalty reward — order {selectedOrder.loyalty_order_seq ?? ''} of card (
                    {selectedOrder.loyalty_discount_percent ?? 10}%)
                  </span>
                  <span>-{formatEGP(selectedOrder.loyalty_discount_amount!)}</span>
                </div>
              )}
              {selectedOrder.email_discount_amount > 0 && (
                <div className="flex justify-between text-crimson-deep">
                  <span>Email Discount</span>
                  <span>-{formatEGP(selectedOrder.email_discount_amount)}</span>
                </div>
              )}
              {(selectedOrder.loyalty_free_reward_amount ?? 0) > 0 && (
                <div className="flex justify-between text-crimson-deep">
                  <span>
                    Loyalty free pair (5/5)
                    {selectedOrder.loyalty_free_reward_product_name
                      ? ` — ${selectedOrder.loyalty_free_reward_product_name}`
                      : ''}
                  </span>
                  <span>-{formatEGP(selectedOrder.loyalty_free_reward_amount!)}</span>
                </div>
              )}
              {selectedOrder.promo_discount_amount > 0 && (
                <div className="flex justify-between text-crimson-deep">
                  <span>Promo ({selectedOrder.applied_promo_code})</span>
                  <span>-{formatEGP(selectedOrder.promo_discount_amount)}</span>
                </div>
              )}
              {selectedOrder.shipping_cost !== undefined && (
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatEGP(selectedOrder.shipping_cost)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-ink/10 pt-2 text-sm font-medium text-ink">
                <span>Total (COD)</span>
                <span>{formatEGP(selectedOrder.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
