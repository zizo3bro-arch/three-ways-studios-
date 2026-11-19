import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Banknote, CheckCircle2, Printer } from 'lucide-react';
import { fetchOrderConfirmation } from '../lib/api';
import { formatEGP } from '../lib/format';
import { ORDER_TRACKING_STEPS, resolveTrackingStage } from '../lib/orderTracking';
import type { OrderConfirmationData } from '../types/database';

/* =========================================================
   ORDER CONFIRMATION — the receipt plate. The order can always be
   re-opened from the reference alone: enter the email used at
   checkout (or arrive from the account panel's tracking link).
   ========================================================= */

export function OrderConfirmationPage() {
  const { orderRef } = useParams<{ orderRef: string }>();
  const [params] = useSearchParams();
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email || params.get('email') || '';
  const [order, setOrder] = useState<OrderConfirmationData | null>(null);
  const [lookupEmail, setLookupEmail] = useState(initialEmail);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let current = true;
    setOrder(null);
    setLookupError(null);
    setLookupEmail(initialEmail);
    setLoading(Boolean(initialEmail));
    if (orderRef && initialEmail)
      void fetchOrderConfirmation(orderRef, initialEmail).then((result) => {
        if (current) {
          setOrder(result.order);
          setLookupError(result.error);
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [orderRef, initialEmail]);

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

  if (!order || order.order_reference.toUpperCase() !== orderRef?.toUpperCase()) {
    return (
      <section className="relative flex min-h-[82svh] items-center justify-center px-4 py-24">
        <div className="relative z-10 w-full max-w-md border-t border-ink/25 pt-6">
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
            <button
              type="submit"
              disabled={loading}
              className="tws-pill h-13 w-full justify-center disabled:opacity-60"
            >
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
    <div className="page-width max-w-[1140px] pb-20 pt-[calc(var(--header)+clamp(20px,3.6vw,52px))]">
      <div className="border-t border-ink/25">
        {/* the stamp */}
        <div className="relative border-b border-ink/16 px-0 py-8 sm:py-9">
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
        <div className="mt-6 flex items-start gap-4 border-l-2 border-crimson bg-[rgba(165,18,27,0.06)] px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-crimson text-[#f7f4ed]">
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
            <p className="mt-2.5 text-[13px] font-semibold leading-snug text-ink">
              {order.customer_name}
            </p>
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
              <p className="mt-2 text-[12px] italic leading-relaxed text-ink-faint">
                Note: {order.order_notes}
              </p>
            ) : null}
            <p className="mt-3 inline-flex border border-ink/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-ink-soft">
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
                <span className="flex h-[74px] w-12 shrink-0 items-end justify-center overflow-hidden">
                  {item.product_image ? (
                    <img
                      src={item.product_image}
                      alt={item.product_name}
                      loading="lazy"
                      className="h-full w-auto object-contain object-bottom"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold uppercase tracking-[0.06em] text-ink">
                    {item.product_name}
                  </span>
                  <span className="mt-1 block">
                    <small>
                      {item.color_name} · Size {item.size_name} · Qty {item.quantity}
                    </small>
                  </span>
                </span>
                <span className="text-[12.5px] font-bold tabular-nums text-ink">
                  {formatEGP(item.line_total)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* totals */}
        <div className="border-t border-ink/16 px-0 py-6">
          <dl className="ml-auto max-w-sm space-y-2 text-[12.5px]">
            <div className="flex items-baseline justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="font-semibold text-ink">{formatEGP(order.subtotal)}</dd>
            </div>
            {(order.loyalty_discount_amount ?? 0) > 0 ? (
              <div className="flex items-baseline justify-between text-crimson-bright">
                <dt>Loyalty discount (10%)</dt>
                <dd>−{formatEGP(order.loyalty_discount_amount!)}</dd>
              </div>
            ) : null}
            {order.email_discount_amount > 0 ? (
              <div className="flex items-baseline justify-between text-crimson-bright">
                <dt>Email privilege (10%)</dt>
                <dd>−{formatEGP(order.email_discount_amount)}</dd>
              </div>
            ) : null}
            {(order.loyalty_free_reward_amount ?? 0) > 0 ? (
              <div className="flex items-baseline justify-between text-crimson-bright">
                <dt>Free product reward (5/5)</dt>
                <dd>−{formatEGP(order.loyalty_free_reward_amount!)}</dd>
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

        {/* live tracking progression */}
        {(() => {
          const stage = resolveTrackingStage(order.status, order.tracking);
          return (
            <div
              className="border-t border-ink/14 px-5 py-6 sm:px-9"
              data-testid="receipt-tracking"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="tws-eyebrow text-ink-faint">Order tracking · {stage.label}</p>
                <span className="text-[12px] text-ink-soft">{stage.description}</span>
              </div>
              {!stage.is_cancelled ? (
                <ol className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                  {ORDER_TRACKING_STEPS.map((step) => {
                    const reached = stage.is_completed || stage.step >= step.step;
                    const current = !stage.is_completed && stage.step === step.step;
                    return (
                      <li
                        key={step.step}
                        className={[
                          'border px-3.5 py-3 text-[12px]',
                          current
                            ? 'border-crimson bg-[rgba(165,18,27,0.05)]'
                            : reached
                              ? 'border-ink/28'
                              : 'border-ink/12 opacity-60',
                        ].join(' ')}
                      >
                        <p
                          className={[
                            'font-bold uppercase tracking-[0.08em]',
                            current ? 'text-crimson' : 'text-ink',
                          ].join(' ')}
                        >
                          {step.step}. {step.label}
                        </p>
                        <p className="mt-1 text-[11.5px] text-ink-soft">{step.description}</p>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </div>
          );
        })()}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/12 px-5 py-5 sm:px-9">
          <p className="max-w-sm text-[11.5px] leading-relaxed text-ink-faint">
            Keep the reference. Dispatch calls before the courier arrives, and returns are open for 14
            days from delivery.
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
