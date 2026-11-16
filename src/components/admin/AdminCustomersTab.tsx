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

  const ordersByCustomer = (customerId: string) =>
    orders.filter((o) => o.customer_id === customerId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium tracking-[0.2em] text-white uppercase">
          Customers ({customers.length})
        </h2>
        <p className="mt-1 text-xs text-[#9e9494]">
          Verified buyer contacts, delivery details, and COD order histories.
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="border border-white/12 bg-black/40 p-10 text-center text-xs text-[#9e9494]">
          No customers recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/12 bg-black/45">
          <table className="w-full min-w-[740px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/12 text-[10px] tracking-[0.18em] text-[#9e9494] uppercase">
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">Location</th>
                <th className="p-4 font-medium">Orders</th>
                <th className="p-4 font-medium">Total Spent</th>
                <th className="p-4 text-right font-medium">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {customers.map((c) => {
                const custOrders = ordersByCustomer(c.id);
                const spend = custOrders
                  .filter((o) => o.status !== 'cancelled')
                  .reduce((s, o) => s + Number(o.total_amount), 0);
                return (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <p className="font-medium text-white">{c.full_name}</p>
                      <p className="text-[11px] text-[#9e9494]">{c.email}</p>
                    </td>
                    <td className="p-4 text-[#cfc6c6]">{c.phone}</td>
                    <td className="p-4 text-[#cfc6c6]">
                      {c.city}, {c.governorate}
                    </td>
                    <td className="p-4 text-white">{custOrders.length}</td>
                    <td className="p-4 font-medium text-white">{formatEGP(spend)}</td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className="inline-flex items-center gap-1.5 border border-white/20 px-3 py-1.5 text-[11px] text-white hover:border-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto border border-white/15 bg-[#0a0607] p-6">
            <div className="flex items-center justify-between border-b border-white/12 pb-4">
              <div>
                <h3 className="text-base font-medium text-white">{selectedCustomer.full_name}</h3>
                <p className="text-xs text-[#9e9494]">{selectedCustomer.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-full border border-white/15 p-1.5 text-[#cfc6c6] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 border-b border-white/10 pb-4 text-xs text-[#cfc6c6]">
              <p>Phone: {selectedCustomer.phone}</p>
              <p className="mt-1">
                Address: {selectedCustomer.address}, {selectedCustomer.city},{' '}
                {selectedCustomer.governorate}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-[10px] tracking-[0.18em] text-[#9e9494] uppercase">
                Order History
              </p>
              {ordersByCustomer(selectedCustomer.id).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between border border-white/10 bg-black/35 p-3 text-xs"
                >
                  <div>
                    <p className="font-mono font-medium text-white">{o.order_reference}</p>
                    <p className="text-[11px] text-[#9e9494]">
                      {new Date(o.created_at).toLocaleDateString()} · {o.status.toUpperCase()}
                    </p>
                  </div>
                  <span className="font-medium text-white">{formatEGP(o.total_amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
