import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Banknote, CheckCircle2, Printer } from 'lucide-react';
import { fetchOrderConfirmation } from '../lib/api';
import { formatEGP } from '../lib/format';
import type { OrderConfirmationData } from '../types/database';

export function OrderConfirmationPage() {
  const { orderRef } = useParams<{ orderRef: string }>();
  const [order, setOrder] = useState<OrderConfirmationData | null>(() => {
    if (!orderRef) return null;
    try {
      const raw = sessionStorage.getItem(`tws_order_${orderRef}`);
      return raw ? (JSON.parse(raw) as OrderConfirmationData) : null;
    } catch {
      return null;
    }
  });
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = orderRef
      ? `Order ${orderRef} — THREE WAYS STUDIOS`
      : 'Order Confirmation — THREE WAYS STUDIOS';
  }, [orderRef]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderRef || !lookupEmail.trim()) return;
    setLoading(true);
    setLookupError(null);
    const { order: found, error } = await fetchOrderConfirmation(orderRef, lookupEmail);
    setLoading(false);
    if (error || !found) {
      setLookupError(error ?? 'No order matched that reference number and email address.');
      return;
    }
    setOrder(found);
  };

  if (!order) {
    return (
      <main className="mx-auto max-w-lg px-5 pt-36 pb-28">
        <div className="rounded-3xl border border-[#201D1A]/12 bg-[#FCFBF7] p-7 shadow-[0_2px_18px_rgba(20,18,16,0.05)]">
          <p className="text-[10px] tracking-[0.24em] text-[#B30E16] uppercase">
            Order Verification
          </p>
          <h1 className="mt-2 text-xl font-normal text-[#201D1A]">
            View Order {orderRef}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#6E6862]">
            Enter the email address used during checkout to securely view your order details.
          </p>
          <form onSubmit={handleLookup} className="mt-5 space-y-4">
            <input
              type="email"
              required
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#201D1A]/15 bg-white px-3.5 py-2.5 text-xs text-[#201D1A] placeholder-[#A39C93] focus:border-[#b30e16] focus:outline-none"
            />
            {lookupError && <p className="text-xs text-[#B3261E]">{lookupError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-[#B30E16] py-3 text-[10px] font-bold uppercase tracking-[0.26em] text-[#F5F2EB] transition-colors hover:bg-[#8F0B12]"
            >
              {loading ? 'Verifying...' : 'View Order'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pt-32 pb-24 sm:px-8">
      <div className="rounded-3xl border border-[#201D1A]/12 bg-[#FCFBF7] p-6 shadow-[0_2px_18px_rgba(20,18,16,0.05)] sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#201D1A]/12 pb-6">
          <div>
            <div className="flex items-center gap-2 text-[#B30E16]">
              <CheckCircle2 className="h-5 w-5 text-[#B30E16]" />
              <span className="text-xs font-medium tracking-[0.2em] uppercase">
                Order Confirmed
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-normal text-[#201D1A] sm:text-3xl">
              Thank You, {order.customer_name}
            </h1>
            <p className="mt-1.5 text-xs text-[#6E6862]">
              Order Reference:{' '}
              <span className="font-mono font-semibold text-[#201D1A]">{order.order_reference}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-[#201D1A]/20 px-4 py-2 text-[11px] tracking-[0.16em] text-[#33302C] uppercase hover:border-[#201D1A] print:hidden"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Receipt
          </button>
        </div>

        {/* COD Payment Box */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#B30E16]/30 bg-[#FAECE7] p-4">
          <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-[#B30E16]" />
          <div className="text-xs leading-relaxed">
            <p className="font-medium text-[#201D1A]">Payment Method: Cash on Delivery (COD)</p>
            <p className="mt-1 text-[#33302C]">
              Amount due upon delivery:{' '}
              <span className="font-semibold text-[#201D1A]">{formatEGP(order.total_amount)}</span>.
              Our dispatch team will contact {order.customer_phone} before courier arrival.
            </p>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="mt-6 grid grid-cols-1 gap-6 border-b border-[#201D1A]/10 pb-6 text-xs sm:grid-cols-2">
          <div>
            <p className="text-[10px] tracking-[0.2em] text-[#6E6862] uppercase">Delivery To</p>
            <p className="mt-2 font-medium text-[#201D1A]">{order.customer_name}</p>
            <p className="mt-1 text-[#33302C]">{order.delivery_address}</p>
            <p className="text-[#33302C]">
              {order.city}, {order.governorate}
            </p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.2em] text-[#6E6862] uppercase">Contact</p>
            <p className="mt-2 text-[#33302C]">{order.customer_email}</p>
            <p className="mt-1 text-[#33302C]">{order.customer_phone}</p>
            {order.order_notes && (
              <p className="mt-2 text-[#6E6862]">Notes: {order.order_notes}</p>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="mt-6 space-y-3 border-b border-[#201D1A]/10 pb-6">
          <p className="text-[10px] tracking-[0.2em] text-[#6E6862] uppercase">Items Ordered</p>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4 text-xs">
              <div>
                <p className="font-medium text-[#201D1A]">{item.product_name}</p>
                <p className="text-[#6E6862]">
                  {item.color_name} · Size {item.size_name} · Qty {item.quantity}
                </p>
              </div>
              <span className="font-medium text-[#201D1A]">{formatEGP(item.line_total)}</span>
            </div>
          ))}
        </div>

        {/* Financial Breakdown */}
        <div className="mt-5 space-y-2 text-xs">
          <div className="flex justify-between text-[#33302C]">
            <span>Subtotal</span>
            <span>{formatEGP(order.subtotal)}</span>
          </div>
          {order.email_discount_amount > 0 && (
            <div className="flex justify-between text-[#B30E16]">
              <span>Email Checkout Discount</span>
              <span>-{formatEGP(order.email_discount_amount)}</span>
            </div>
          )}
          {order.promo_discount_amount > 0 && (
            <div className="flex justify-between text-[#B30E16]">
              <span>Promo Discount ({order.applied_promo_code})</span>
              <span>-{formatEGP(order.promo_discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-[#201D1A]/12 pt-3 text-base font-medium text-[#201D1A]">
            <span>Total (COD)</span>
            <span>{formatEGP(order.total_amount)}</span>
          </div>
        </div>

        <div className="mt-8 flex justify-end print:hidden">
          <Link
            to="/#products"
            className="rounded-full border border-[#201D1A]/25 px-7 py-2.5 text-xs tracking-[0.2em] text-[#201D1A] uppercase hover:border-[#201D1A]"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
