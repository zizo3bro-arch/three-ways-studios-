import { useMemo, useState } from 'react';
import { Eye, Search, X } from 'lucide-react';
import { formatEGP } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { Order, OrderStatus } from '../../types/database';

interface AdminOrdersTabProps {
  orders: Order[];
  onRefresh: () => Promise<void>;
}

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

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
          <h2 className="text-sm font-medium tracking-[0.2em] text-white uppercase">
            COD Orders ({orders.length})
          </h2>
          <p className="mt-1 text-xs text-[#9e9494]">
            Manage status progression. Cancelling an order automatically restores variant stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-3.5 w-3.5 text-[#847878]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref, name, email, phone..."
              className="border border-white/15 bg-black/50 py-2 pr-3 pl-8 text-xs text-white placeholder-[#685e5e] focus:border-[#b30e16] focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
            className="border border-white/15 bg-[#0c0708] px-3 py-2 text-xs text-white"
          >
            <option value="all">All Statuses</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusError && (
        <p className="border border-[#ff6b6b]/40 bg-[#2a090c] p-3 text-xs text-[#ffb3b3]">
          {statusError}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="border border-white/12 bg-black/40 p-10 text-center text-xs text-[#9e9494]">
          No orders match your search criteria.
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/12 bg-black/45">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/12 text-[10px] tracking-[0.18em] text-[#9e9494] uppercase">
                <th className="p-4 font-medium">Reference</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Location</th>
                <th className="p-4 font-medium">COD Total</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 text-right font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 font-mono font-medium text-white">
                    {order.order_reference}
                    <p className="font-sans text-[10px] text-[#847878]">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-white">{order.customer_name}</p>
                    <p className="text-[11px] text-[#9e9494]">
                      {order.customer_email} · {order.customer_phone}
                    </p>
                  </td>
                  <td className="p-4 text-[#cfc6c6]">
                    {order.city}, {order.governorate}
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-white">
                      {formatEGP(order.total_amount)}
                    </span>
                    {order.discount_total > 0 && (
                      <p className="text-[10px] text-[#e87a80]">
                        -{formatEGP(order.discount_total)} disc.
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <select
                      disabled={updatingId === order.id}
                      value={order.status}
                      onChange={(e) =>
                        handleStatusChange(order.id, e.target.value as OrderStatus)
                      }
                      className="border border-white/20 bg-[#0d0708] px-2.5 py-1 text-[11px] text-white uppercase"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="inline-flex items-center gap-1.5 border border-white/20 px-3 py-1.5 text-[11px] text-white hover:border-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-white/15 bg-[#0a0607] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/12 pb-4">
              <div>
                <p className="text-[10px] tracking-[0.2em] text-[#d4121b] uppercase">
                  Order Details (COD)
                </p>
                <h3 className="mt-1 font-mono text-lg text-white">
                  {selectedOrder.order_reference}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full border border-white/15 p-1.5 text-[#cfc6c6] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 border-b border-white/10 pb-5 text-xs sm:grid-cols-2">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-[#9e9494] uppercase">Customer</p>
                <p className="mt-1 font-medium text-white">{selectedOrder.customer_name}</p>
                <p className="text-[#cfc6c6]">{selectedOrder.customer_email}</p>
                <p className="text-[#cfc6c6]">{selectedOrder.customer_phone}</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.18em] text-[#9e9494] uppercase">
                  Delivery Address
                </p>
                <p className="mt-1 text-[#cfc6c6]">{selectedOrder.delivery_address}</p>
                <p className="text-[#cfc6c6]">
                  {selectedOrder.city}, {selectedOrder.governorate}
                </p>
                {selectedOrder.order_notes && (
                  <p className="mt-1 text-[#9e9494]">Notes: {selectedOrder.order_notes}</p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2.5 border-b border-white/10 pb-5 text-xs">
              <p className="text-[10px] tracking-[0.18em] text-[#9e9494] uppercase">Items</p>
              {(selectedOrder.order_items ?? []).map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-[#e6dfdf]">
                    {item.product_name} ({item.color_name} / {item.size_name}) × {item.quantity}
                  </span>
                  <span className="text-white">{formatEGP(item.line_total)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-[#cfc6c6]">
                <span>Subtotal</span>
                <span>{formatEGP(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.email_discount_amount > 0 && (
                <div className="flex justify-between text-[#e87a80]">
                  <span>Email Discount</span>
                  <span>-{formatEGP(selectedOrder.email_discount_amount)}</span>
                </div>
              )}
              {selectedOrder.promo_discount_amount > 0 && (
                <div className="flex justify-between text-[#e87a80]">
                  <span>Promo ({selectedOrder.applied_promo_code})</span>
                  <span>-{formatEGP(selectedOrder.promo_discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-medium text-white">
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
