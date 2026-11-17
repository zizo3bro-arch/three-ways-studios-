import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Banknote, CheckCircle2, Printer } from 'lucide-react';
import { fetchOrderConfirmation } from '../lib/api';
import { formatEGP } from '../lib/format';
import { ColourChip } from '../components/ui/ColourChip';
import type { OrderConfirmationData } from '../types/database';

/* =========================================================
   ORDER CONFIRMATION — the receipt plate. The order can always be
   re-opened from the reference alone: enter the email used at
   checkout (or arrive from the account panel's tracking link).
   ========================================================= */

export function OrderConfirmationPage() {
  const { orderRef } = useParams<{ orderRef: string }>();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<OrderConfirmationData | null>(() => {
    if (!orderRef) return null;
    try {
      const raw = window.sessionStorage.getItem(`tws_order_${orderRef}`);
      return raw ? (JSON.parse(raw) as OrderConfirmationData) : null;
    } catch {
      return null;
    }
  });
  const [lookupEmail, setLookupEmail] = useState(params.get('email') ?? '');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = orderRef
      ? `Order ${orderRef} — THREE WAYS STUDIOS`
      : 'Order confirmation — THREE WAYS STUDIOS';
  }, [orderRef]);

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orderRef || !lookupEmail.trim()) return;
    setLoading(true);
    setLookupError(null);
    const { order: found, error } = await fetchOrderConfirmation(orderRef, lookupEmail);
    setLoading(false);
    if (error || !found) {
      setLookupError(error ?? 'No order matched that reference and email address.');
      return;
    }
    setOrder(found);
  };

  if (!order) {
    return (
      <section className="relative flex min-h-[82svh] items-center justify-center bg-white px-4 py-24">
        <div className="tws-plate-card relative z-10 w-full max-w-md p-6 sm:p-8">
          <p className="tws-eyebrow text-crimson-bright">Order verification</p>
          <h1 className="mt-3 font-display text-[1.9rem] uppercase leading-[0.95] text-ink">
            Order {orderRef}
          </h1>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
            Enter the email address used at checkout to open the receipt.
          </p>
          <form onSubmit={handleLookup} className="mt-5 space-y-3">
            <div>
              <label htmlFor="confirm-email" className="tws-label">
                Email *
              </label>
              <input
                id="confirm-email"
                type="email"
                required
                autoComplete="email"
                value={lookupEmail}
                onChange={(event) => setLookupEmail(event.target.value)}
                placeholder="you@example.com"
                className="tws-field mt-1.5"
              />
            </div>
            {lookupError ? (
              <p role="alert" className="text-[11.5px] font-semibold text-crimson-bright">
                {lookupError}
              </p>
            ) : null}
            <button type="submit" disabled={loading} className="tws-pill h-13 w-full justify-center disabled:opacity-60">
              {loading ? 'Verifying…' : 'Open the receipt'}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
          <Link
            to="/shop"
            className="mt-4 block text-center text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-crimson-bright"
          >
            Back to the shop
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[940px] px-4 pb-20 pt-[104px] sm:px-6 sm:pt-[136px]">
      <div className="tws-plate-card overflow-hidden">
        {/* the stamp */}
        <div className="relative border-b border-ink/12 bg-[#FAFAF8] px-5 py-8 sm:px-9 sm:py-10">
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="tws-eyebrow flex items-center gap-2 text-crimson-bright">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                Order confirmed
              </p>
              <h1 className="mt-3 font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(1.9rem,5.4vw,3rem)]">
                Thank you,
                <span className="block">{order.customer_name.split(' ')[0] || 'friend'}</span>
              </h1>
              <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-ink-faint">
                Reference{' '}
                <span className="font-mono text-[12.5px] font-semibold tracking-normal text-ink">
                  {order.order_reference}
                </span>
                {' · '}
                {new Date(order.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="tws-pill tws-pill--outline h-11 print:hidden"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={1.9} />
              Print receipt
            </button>
          </div>
        </div>

        {/* COD box */}
        <div className="mx-5 mt-6 flex items-start gap-4 rounded-[1.1rem] border border-crimson-bright/25 bg-crimson-mist px-4 py-4 sm:mx-9">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-crimson-bright text-ivory">
            <Banknote className="h-4 w-4" strokeWidth={1.9} />
          </span>
          <p className="text-[12.5px] leading-relaxed text-crimson-deep">
            <span className="font-bold uppercase tracking-[0.12em] text-ink">
              Payment — cash on delivery
            </span>
            <br />
            {formatEGP(order.total_amount)} due to the courier on arrival. Dispatch will call{' '}
            {order.customer_phone} before the parcel leaves the atelier.
          </p>
        </div>

        {/* details */}
        <div className="grid gap-6 px-5 py-7 sm:grid-cols-2 sm:px-9">
          <div>
            <p className="tws-eyebrow text-ink-faint">Delivering to</p>
            <p className="mt-2.5 text-[13px] font-semibold leading-snug text-ink">{order.customer_name}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{order.delivery_address}</p>
            <p className="text-[12.5px] text-ink-soft">
              {order.city}, {order.governorate}
            </p>
          </div>
          <div>
            <p className="tws-eyebrow text-ink-faint">Contact</p>
            <p className="mt-2.5 text-[12.5px] text-ink-soft">{order.customer_email}</p>
            <p className="mt-1 text-[12.5px] text-ink-soft">{order.customer_phone}</p>
            {order.order_notes ? (
              <p className="mt-2 text-[12px] italic leading-relaxed text-ink-faint">Note: {order.order_notes}</p>
            ) : null}
            <p className="mt-3 inline-flex rounded-full border border-ink/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-ink-soft">
              Status · {order.status}
            </p>
          </div>
        </div>

        {/* items */}
        <div className="border-t border-ink/12 px-5 py-6 sm:px-9">
          <p className="tws-eyebrow text-ink-faint">Pieces</p>
          <ul className="mt-3.5 space-y-3.5">
            {order.items.map((item, index) => (
              <li key={`${item.variant_id ?? 'line'}-${index}`} className="flex items-center gap-4">
                <span className="flex h-[74px] w-12 shrink-0 items-end justify-center overflow-hidden rounded-[3px] border border-ink/10 bg-paper">
                  {item.product_image ? (
                    <img src={item.product_image} alt={item.product_name} loading="lazy" className="h-full w-auto object-contain object-bottom" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold uppercase tracking-[0.06em] text-ink">
                    {item.product_name}
                  </span>
                  <span className="mt-1 block">
                    <ColourChip label={`${item.color_name} · Size ${item.size_name} · Qty ${item.quantity}`} />
                  </span>
                </span>
                <span className="text-[12.5px] font-bold tabular-nums text-ink">{formatEGP(item.line_total)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* totals */}
        <div className="border-t border-ink/12 bg-ivory/70 px-5 py-6 sm:px-9">
          <dl className="ml-auto max-w-sm space-y-2 text-[12.5px]">
            <div className="flex items-baseline justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="font-semibold text-ink">{formatEGP(order.subtotal)}</dd>
            </div>
            {order.email_discount_amount > 0 ? (
              <div className="flex items-baseline justify-between text-crimson-bright">
                <dt>Email privilege</dt>
                <dd>−{formatEGP(order.email_discount_amount)}</dd>
              </div>
            ) : null}
            {order.promo_discount_amount > 0 ? (
              <div className="flex items-baseline justify-between text-crimson-bright">
                <dt>Promo {order.applied_promo_code}</dt>
                <dd>−{formatEGP(order.promo_discount_amount)}</dd>
              </div>
            ) : null}
            {order.shipping_cost !== undefined ? (
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-soft">Delivery</dt>
                <dd className="font-semibold text-ink">
                  {order.shipping_cost === 0 ? 'Free' : formatEGP(order.shipping_cost)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-ink/12 pt-3">
              <dt className="tws-eyebrow text-ink">Total due on delivery</dt>
              <dd className="font-display text-[1.5rem] leading-none tracking-[0.01em] text-ink">
                {formatEGP(order.total_amount)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/12 px-5 py-5 sm:px-9">
          <p className="max-w-sm text-[11.5px] leading-relaxed text-ink-faint">
            Keep the reference. Dispatch calls before the courier arrives, and returns are open for
            14 days from delivery.
          </p>
          <Link to="/shop" className="tws-pill h-12 print:hidden">
            Continue shopping
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
