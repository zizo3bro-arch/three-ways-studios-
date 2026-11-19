import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Check, Eye, MessageSquarePlus, Printer, Search, X } from 'lucide-react';
import { formatEGP } from '../../lib/format';
import { adminClient as supabase } from '../../lib/adminClient';
import { rpc } from '../../lib/rpc';
import { ADMIN_STATUS_OPTIONS } from '../../lib/orderTracking';
import type { Order, OrderStatus } from '../../types/database';

interface OrderActivity {
  history: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    changed_by_email: string | null;
    created_at: string;
  }>;
  notes: Array<{ id: string; body: string; author_email: string | null; created_at: string }>;
  refunds: Array<{
    id: string;
    amount: number;
    reason: string;
    actor_email: string | null;
    created_at: string;
  }>;
  refunded_total: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Prints one order sheet through a disposable iframe, so the console layout is
 * never printed and the studio's paper look stays on the sheet. */
function printOrder(order: Order, activity: OrderActivity | null) {
  const rows = (order.order_items ?? [])
    .map(
      (item) =>
        `<tr><td>${item.product_name}<br><span>${item.color_name} / Size ${item.size_name}</span></td>` +
        `<td>${item.quantity}</td><td>${formatEGP(item.unit_price)}</td><td>${formatEGP(item.line_total)}</td></tr>`
    )
    .join('');
  const history = (activity?.history ?? [])
    .map(
      (entry) =>
        `<li>${new Date(entry.created_at).toLocaleString('en-GB')} — ${
          entry.from_status ? `${STATUS_LABELS[entry.from_status] ?? entry.from_status} → ` : ''
        }${STATUS_LABELS[entry.to_status] ?? entry.to_status}${
          entry.changed_by_email ? ` · ${entry.changed_by_email}` : ''
        }</li>`
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${order.order_reference}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font: 12px/1.5 Georgia, serif; color: #17130f; }
    h1 { font-family: Impact, sans-serif; letter-spacing: .04em; font-size: 22px; margin: 0 0 2px; }
    .muted { color: #6b6058; text-transform: uppercase; letter-spacing: .16em; font-size: 9px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #d8d0c6; vertical-align: top; }
    th { font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: #6b6058; }
    .total { text-align: right; font-weight: 700; font-size: 15px; margin-top: 10px; }
    ul { padding-left: 16px; margin: 8px 0 0; }
    .grid { display: flex; gap: 28px; margin-top: 12px; }
    .grid > div { flex: 1; }
  </style></head><body>
  <h1>THREE WAYS STUDIOS</h1>
  <p class="muted">Cash on delivery order · ${order.order_reference}</p>
  <div class="grid">
    <div><p class="muted">Customer</p>${order.customer_name}<br>${order.customer_email}<br>${order.customer_phone}</div>
    <div><p class="muted">Deliver to</p>${order.delivery_address}<br>${order.city}, ${order.governorate}</div>
    <div><p class="muted">Placed / status</p>${new Date(order.created_at).toLocaleString('en-GB')}<br>${
      STATUS_LABELS[order.status] ?? order.status
    }</div>
  </div>
  <table><thead><tr><th>Piece</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="total">Total due (COD): ${formatEGP(order.total_amount)}</p>
  ${order.order_notes ? `<p><strong>Customer note:</strong> ${order.order_notes}</p>` : ''}
  ${history ? `<p class="muted" style="margin-top:14px">Status history</p><ul>${history}</ul>` : ''}
  <p style="margin-top:18px;font-size:9px;color:#6b6058">Payment method: cash on delivery · Three Ways Studios, Cairo</p>
  </body></html>`;
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  };
}

interface AdminOrdersTabProps {
  orders: Order[];
  onRefresh: () => Promise<void>;
}

export function AdminOrdersTab({ orders, onRefresh }: AdminOrdersTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [activity, setActivity] = useState<OrderActivity | null>(null);
  const [activityState, setActivityState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [activityError, setActivityError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      const created = new Date(o.created_at).getTime();
      if (from !== null && created < from) return false;
      if (to !== null && created > to) return false;
      if (!q) return true;
      return (
        o.order_reference.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const loadActivity = useCallback(async (orderId: string) => {
    setActivityState('loading');
    setActivityError(null);
    try {
      const data = await rpc<OrderActivity>('admin_order_activity', { p_order_id: orderId });
      setActivity(data);
      setActivityState('idle');
    } catch (loadError) {
      setActivity(null);
      setActivityState('error');
      setActivityError(loadError instanceof Error ? loadError.message : 'Could not load the order record.');
    }
  }, []);

  useEffect(() => {
    if (!selectedOrder) {
      setActivity(null);
      setActivityState('idle');
      setNoteDraft('');
      setRefundAmount('');
      setRefundReason('');
      setRecordError(null);
      return;
    }
    void loadActivity(selectedOrder.id);
  }, [selectedOrder, loadActivity]);

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
      await loadActivity(orderId);
    }
  };

  const addNote = async () => {
    if (!selectedOrder || !noteDraft.trim()) return;
    setRecordBusy(true);
    setRecordError(null);
    try {
      await rpc('admin_add_order_note', {
        p_order_id: selectedOrder.id,
        p_body: noteDraft.trim(),
      });
      setNoteDraft('');
      await loadActivity(selectedOrder.id);
    } catch (saveError) {
      setRecordError(saveError instanceof Error ? saveError.message : 'The note was not saved.');
    } finally {
      setRecordBusy(false);
    }
  };

  const recordRefund = async () => {
    if (!selectedOrder) return;
    setRecordBusy(true);
    setRecordError(null);
    try {
      await rpc('admin_record_refund', {
        p_order_id: selectedOrder.id,
        p_amount: Number(refundAmount),
        p_reason: refundReason.trim(),
      });
      setRefundAmount('');
      setRefundReason('');
      await loadActivity(selectedOrder.id);
    } catch (saveError) {
      setRecordError(saveError instanceof Error ? saveError.message : 'The refund was not recorded.');
    } finally {
      setRecordBusy(false);
    }
  };

  const exportOrders = () => {
    const header = [
      'Reference',
      'Placed',
      'Customer',
      'Email',
      'Phone',
      'Governorate',
      'City',
      'Address',
      'Status',
      'Subtotal',
      'Discounts',
      'Total (COD)',
    ];
    const body = filtered.map((order) => [
      order.order_reference,
      new Date(order.created_at).toISOString(),
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      order.governorate,
      order.city,
      order.delivery_address,
      STATUS_LABELS[order.status] ?? order.status,
      order.subtotal.toFixed(2),
      order.discount_total.toFixed(2),
      order.total_amount.toFixed(2),
    ]);
    downloadCsv(`three-ways-orders-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
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
            aria-label="Filter by status"
            className="border border-ink/15 bg-paper px-3 py-2 text-xs text-ink"
          >
            <option value="all">All Statuses</option>
            {ADMIN_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-[10px] tracking-[0.1em] text-ink-faint uppercase">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="Orders placed from"
              className="border border-ink/15 bg-paper px-2 py-1.5 text-xs text-ink"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] tracking-[0.1em] text-ink-faint uppercase">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="Orders placed until"
              className="border border-ink/15 bg-paper px-2 py-1.5 text-xs text-ink"
            />
          </label>

          <button
            type="button"
            onClick={exportOrders}
            className="inline-flex items-center gap-1.5 border border-ink/20 px-3 py-2 text-[11px] tracking-[0.12em] text-ink uppercase hover:border-crimson"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> Export
          </button>
          {dateFrom || dateTo ? (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="text-[11px] text-ink-faint underline"
            >
              Clear dates
            </button>
          ) : null}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printOrder(selectedOrder, activity)}
                  className="inline-flex items-center gap-1.5 border border-ink/20 px-3 py-1.5 text-[11px] tracking-[0.1em] text-ink uppercase hover:border-crimson"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close order details"
                  className="rounded-full border border-ink/15 p-1.5 text-ink-soft hover:text-crimson"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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

            {/* Status with the loyalty rule stated where the action happens. */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-ink-faint uppercase">Status</p>
                <select
                  disabled={updatingId === selectedOrder.id}
                  value={selectedOrder.status}
                  onChange={(event) =>
                    handleStatusChange(selectedOrder.id, event.target.value as OrderStatus)
                  }
                  className="mt-1 border border-ink/20 bg-paper px-2.5 py-1 text-[11px] text-ink uppercase"
                >
                  {ADMIN_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="max-w-[34ch] text-[11px] leading-relaxed text-ink-faint">
                The loyalty card counts this order once — and only when the status is set to{' '}
                <strong className="text-ink">Delivered</strong>. Accepted, Processing and Shipped do
                not count; Cancelled never counts.
              </p>
            </div>

            {activityState === 'error' ? (
              <p role="alert" className="mt-4 text-xs text-crimson-deep">
                {activityError}{' '}
                <button className="underline" onClick={() => void loadActivity(selectedOrder.id)}>
                  Retry
                </button>
              </p>
            ) : null}

            {/* ——— history, notes, refunds ——— */}
            <div className="mt-5 grid grid-cols-1 gap-5 border-t border-ink/10 pt-4 text-xs">
              <section>
                <p className="text-[10px] tracking-[0.18em] text-ink-faint uppercase">Status history</p>
                {activityState === 'loading' && !activity ? (
                  <p className="mt-2 text-ink-faint">Loading…</p>
                ) : activity?.history.length ? (
                  <ol className="mt-2 space-y-1.5">
                    {activity.history.map((entry) => (
                      <li key={entry.id} className="flex flex-wrap justify-between gap-2">
                        <span className="text-ink-soft">
                          {entry.from_status
                            ? `${STATUS_LABELS[entry.from_status] ?? entry.from_status} → `
                            : 'Created · '}
                          <strong className="text-ink">
                            {STATUS_LABELS[entry.to_status] ?? entry.to_status}
                          </strong>
                        </span>
                        <span className="text-[10px] text-ink-faint">
                          {new Date(entry.created_at).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {entry.changed_by_email ? ` · ${entry.changed_by_email}` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-ink-faint">No status changes recorded yet.</p>
                )}
              </section>

              <section>
                <p className="text-[10px] tracking-[0.18em] text-ink-faint uppercase">Internal notes</p>
                {activity?.notes.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {activity.notes.map((note) => (
                      <li key={note.id} className="border-l-2 border-ink/15 pl-3">
                        <p className="text-ink-soft">{note.body}</p>
                        <p className="text-[10px] text-ink-faint">
                          {note.author_email} ·{' '}
                          {new Date(note.created_at).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-ink-faint">No notes yet.</p>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Add a note — calls, address changes, packing"
                    aria-label="New internal note"
                    maxLength={500}
                    className="flex-1 border border-ink/15 bg-paper/60 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void addNote()}
                    disabled={recordBusy || !noteDraft.trim()}
                    className="inline-flex items-center gap-1 border border-ink/20 px-2.5 py-1 text-[11px] uppercase hover:border-crimson disabled:opacity-40"
                  >
                    <MessageSquarePlus className="h-3 w-3" /> Add
                  </button>
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[10px] tracking-[0.18em] text-ink-faint uppercase">
                    Cancellation &amp; refunds
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    Recorded {formatEGP(Number(activity?.refunded_total ?? 0))} of{' '}
                    {formatEGP(selectedOrder.total_amount)}
                  </p>
                </div>
                {activity?.refunds.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {activity.refunds.map((refund) => (
                      <li key={refund.id} className="flex flex-wrap justify-between gap-2">
                        <span className="text-ink-soft">{refund.reason}</span>
                        <span className="text-[10px] text-ink-faint">
                          {formatEGP(Number(refund.amount))} · {refund.actor_email} ·{' '}
                          {new Date(refund.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-ink-faint">
                    {selectedOrder.status === 'cancelled'
                      ? 'Cancelled. Record any money returned below.'
                      : 'No refunds recorded. A refund record requires a cancelled order.'}
                  </p>
                )}
                {selectedOrder.status === 'cancelled' ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                      placeholder="Amount"
                      aria-label="Refund amount"
                      className="w-24 border border-ink/15 bg-paper/60 px-2 py-1 text-xs"
                    />
                    <input
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      placeholder="Reason (required)"
                      aria-label="Refund reason"
                      maxLength={300}
                      className="flex-1 border border-ink/15 bg-paper/60 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void recordRefund()}
                      disabled={recordBusy || !refundAmount || !refundReason.trim()}
                      className="inline-flex items-center gap-1 border border-ink/20 px-2.5 py-1 text-[11px] uppercase hover:border-crimson disabled:opacity-40"
                    >
                      <Check className="h-3 w-3" /> Record
                    </button>
                  </div>
                ) : null}
                {recordError ? (
                  <p role="alert" className="mt-2 text-[11px] text-crimson-deep">
                    {recordError}
                  </p>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
