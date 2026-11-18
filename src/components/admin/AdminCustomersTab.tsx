import { useState } from 'react';
import { History, X } from 'lucide-react';
import { formatEGP } from '../../lib/format';
import type { Customer, Order } from '../../types/database';

interface AdminCustomersTabProps {
  customers: Customer[];
  orders: Order[];
}

export function AdminCustomersTab({ customers, orders }: AdminCustomersTabProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const ordersByCustomer = (customerId: string) => orders.filter((o) => o.customer_id === customerId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium tracking-[0.2em] text-ink uppercase">
          Customers ({customers.length})
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          Verified buyer contacts, delivery details, and COD order histories.
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="border border-ink/12 bg-transparent p-10 text-center text-xs text-ink-faint">
          No customers recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto border border-ink/12 bg-transparent">
          <table className="w-full min-w-[740px] text-left text-xs">
            <thead>
              <tr className="border-b border-ink/12 text-[10px] tracking-[0.18em] text-ink-faint uppercase">
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">Location</th>
                <th className="p-4 font-medium">Orders</th>
                <th className="p-4 font-medium">Total Spent</th>
                <th className="p-4 text-right font-medium">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {customers.map((c) => {
                const custOrders = ordersByCustomer(c.id);
                const spend = custOrders
                  .filter((o) => o.status !== 'cancelled')
                  .reduce((s, o) => s + Number(o.total_amount), 0);
                return (
                  <tr key={c.id} className="hover:bg-ink/[0.02]">
                    <td className="p-4">
                      <p className="font-medium text-ink">{c.full_name}</p>
                      <p className="text-[11px] text-ink-faint">{c.email}</p>
                    </td>
                    <td className="p-4 text-ink-soft">{c.phone}</td>
                    <td className="p-4 text-ink-soft">
                      {c.city}, {c.governorate}
                    </td>
                    <td className="p-4 text-ink">{custOrders.length}</td>
                    <td className="p-4 font-medium text-ink">{formatEGP(spend)}</td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className="inline-flex items-center gap-1.5 border border-ink/20 px-3 py-1.5 text-[11px] text-ink hover:border-ink"
                      >
                        <History className="h-3.5 w-3.5" /> History
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto border border-ink/15 paper-surface p-6">
            <div className="flex items-center justify-between border-b border-ink/12 pb-4">
              <div>
                <h3 className="text-base font-medium text-ink">{selectedCustomer.full_name}</h3>
                <p className="text-xs text-ink-faint">{selectedCustomer.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-full border border-ink/15 p-1.5 text-ink-soft hover:text-crimson"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 border-b border-ink/10 pb-4 text-xs text-ink-soft">
              <p>Phone: {selectedCustomer.phone}</p>
              <p className="mt-1">
                Address: {selectedCustomer.address}, {selectedCustomer.city},{' '}
                {selectedCustomer.governorate}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-[10px] tracking-[0.18em] text-ink-faint uppercase">Order History</p>
              {ordersByCustomer(selectedCustomer.id).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between border border-ink/10 bg-ink/[0.02] p-3 text-xs"
                >
                  <div>
                    <p className="font-mono font-medium text-ink">{o.order_reference}</p>
                    <p className="text-[11px] text-ink-faint">
                      {new Date(o.created_at).toLocaleDateString()} · {o.status.toUpperCase()}
                    </p>
                  </div>
                  <span className="font-medium text-ink">{formatEGP(o.total_amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
