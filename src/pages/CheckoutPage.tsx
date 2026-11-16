import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Banknote, CheckCircle2, Lock, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { calculateShippingCost, createCodOrder, quoteCodOrder } from '../lib/api';
import { EGYPTIAN_GOVERNORATES, formatEGP } from '../lib/format';
import { ColourChip } from '../components/ui/ColourChip';
import type { QuoteResponse } from '../types/database';

/* =========================================================
   CHECKOUT — cash on delivery, exactly as the backend models it.
   The quote is re-asked on every material change (items, email,
   governorate, promo) and stock/price are synced back into the bag,
   so what you see is what the courier collects.
   ========================================================= */

function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('20') && digits.length === 12) return digits.slice(2);
  return digits;
}

function isValidEgyptianPhone(raw: string): boolean {
  const digits = normalisePhone(raw);
  return /^01[0125][0-9]{8}$/.test(digits);
}

export function CheckoutPage() {
  const { items, subtotal, clearCart, syncItemStock } = useCart();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [governorate, setGovernorate] = useState('Cairo');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Checkout (Cash on Delivery) — THREE WAYS STUDIOS';
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setQuoting(true);
      const { quote: next } = await quoteCodOrder({
        items: items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        governorate,
        email: email.trim(),
        promoCode: appliedPromo || undefined,
      });
      if (next) {
        setQuote(next);
        if (next.items?.length) {
          syncItemStock(
            next.items.map((line) => ({
              variant_id: line.variant_id,
              available_stock: line.available_stock,
              unit_price: line.unit_price,
            }))
          );
        }
      }
      setQuoting(false);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [items, email, governorate, appliedPromo, syncItemStock]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const effectiveSubtotal = quote ? quote.subtotal : subtotal;
  const effectiveShipping =
    quote?.shipping_cost !== undefined ? quote.shipping_cost : calculateShippingCost(effectiveSubtotal);
  const effectiveDiscount = quote ? quote.discount_total : 0;
  const effectiveTotal = Math.max(0, effectiveSubtotal - effectiveDiscount + effectiveShipping);

  const stockIssues = useMemo(() => (quote && !quote.valid ? quote.stock_errors : []), [quote]);

  if (items.length === 0) {
    return (
      <section className="mx-auto flex min-h-[80svh] w-full max-w-xl flex-col items-center justify-center px-4 py-24 text-center">
        <p className="tws-eyebrow text-crimson-bright">Checkout</p>
        <h1 className="mt-4 font-display text-[clamp(2rem,6vw,3rem)] uppercase leading-[0.92] text-ink">
          Your bag is empty
        </h1>
        <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-ink-soft">
          Add a piece from Drop 01 and the checkout will open with your delivery details.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/shop" className="tws-pill h-13">
            Return to the shop
            <ArrowLeft className="h-4 w-4 rotate-180" strokeWidth={2} />
          </Link>
          <Link to="/about#service" className="tws-pill tws-pill--outline h-13">
            Delivery &amp; returns
          </Link>
        </div>
      </section>
    );
  }

  const validate = () => {
    const errors: Record<string, string> = {};
    if (fullName.trim().length < 3) errors.fullName = 'Enter the full name for the courier.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'A valid email is required for the confirmation.';
    if (!isValidEgyptianPhone(phone)) errors.phone = 'Enter an Egyptian mobile number, e.g. 01012345678.';
    if (city.trim().length < 2) errors.city = 'Which district or city?';
    if (address.trim().length < 10) errors.address = 'Add street, building and apartment details.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (quote && !quote.valid) {
      setSubmitError(stockIssues[0] ?? 'Resolve the stock notes in your bag, then place the order.');
      return;
    }
    if (!validate()) {
      setSubmitError('Check the highlighted fields before confirming.');
      return;
    }

    setSubmitting(true);
    const { order, error } = await createCodOrder({
      fullName,
      email,
      phone,
      governorate,
      city,
      address,
      notes,
      items: items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
      promoCode: appliedPromo || undefined,
    });
    setSubmitting(false);

    if (error || !order) {
      setSubmitError(error ?? 'The order could not be placed. Check the stock notes and try again.');
      return;
    }

    try {
      window.sessionStorage.setItem(`tws_order_${order.order_reference}`, JSON.stringify(order));
    } catch {
      // storage unavailable — the reference still resolves through the backend
    }

    clearCart();
    navigate(`/order-confirmation/${order.order_reference}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-[104px] sm:px-6 sm:pt-[136px] lg:px-10">
      {/* header */}
      <header className="border-b border-ink/12 pb-6">
        <p className="tws-eyebrow flex items-center gap-3 text-crimson-bright">
          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
          Secure checkout — cash on delivery
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display uppercase leading-[0.9] tracking-[0.002em] text-ink text-[clamp(2rem,5.6vw,3.4rem)]">
            Complete
            <span className="block">the order</span>
          </h1>
          <p className="max-w-xs text-[12px] leading-relaxed text-ink-soft sm:text-right">
            Nothing is charged now. You pay {formatEGP(effectiveTotal)} to the courier when the
            parcel is in your hands.
          </p>
        </div>
      </header>

      <form onSubmit={handlePlaceOrder} className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
        {/* ——— left: contact + delivery ——— */}
        <div className="space-y-5 lg:col-span-7">
          <section className="tws-plate-card p-5 sm:p-7">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[1.1rem] text-crimson-bright">01</span>
              <h2 className="tws-eyebrow text-ink">Contact</h2>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="checkout-email" className="tws-label">
                  Email *
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="tws-field mt-1.5"
                  aria-invalid={fieldErrors.email ? 'true' : 'false'}
                />
                {fieldErrors.email ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-crimson-bright">{fieldErrors.email}</p>
                ) : quote?.email_discount_applied ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-crimson-bright">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified — {quote.email_discount_percent}% email privilege (−{formatEGP(quote.email_discount_amount)})
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-ink-faint">
                    A valid email unlocks the 10% house privilege on this order.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="checkout-name" className="tws-label">
                  Full name *
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Recipient full name"
                  className="tws-field mt-1.5"
                  aria-invalid={fieldErrors.fullName ? 'true' : 'false'}
                />
                {fieldErrors.fullName ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-crimson-bright">{fieldErrors.fullName}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="checkout-phone" className="tws-label">
                  Mobile *
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="tws-field mt-1.5"
                  aria-invalid={fieldErrors.phone ? 'true' : 'false'}
                />
                {fieldErrors.phone ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-crimson-bright">{fieldErrors.phone}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="tws-plate-card p-5 sm:p-7">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[1.1rem] text-crimson-bright">02</span>
              <h2 className="tws-eyebrow text-ink">Delivery address</h2>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="checkout-gov" className="tws-label">
                  Governorate *
                </label>
                <select
                  id="checkout-gov"
                  required
                  value={governorate}
                  onChange={(event) => setGovernorate(event.target.value)}
                  className="tws-field mt-1.5"
                >
                  {EGYPTIAN_GOVERNORATES.map((gov) => (
                    <option key={gov} value={gov}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="checkout-city" className="tws-label">
                  City / district *
                </label>
                <input
                  id="checkout-city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="e.g. Zamalek, Maadi, New Cairo"
                  className="tws-field mt-1.5"
                  aria-invalid={fieldErrors.city ? 'true' : 'false'}
                />
                {fieldErrors.city ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-crimson-bright">{fieldErrors.city}</p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="checkout-address" className="tws-label">
                  Street, building, apartment *
                </label>
                <textarea
                  id="checkout-address"
                  required
                  rows={3}
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Street name, building number, floor, apartment and a landmark the courier will know"
                  className="tws-field mt-1.5"
                  aria-invalid={fieldErrors.address ? 'true' : 'false'}
                />
                {fieldErrors.address ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-crimson-bright">{fieldErrors.address}</p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="checkout-notes" className="tws-label">
                  Courier notes (optional)
                </label>
                <input
                  id="checkout-notes"
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Preferred delivery window, gate code, or hem length"
                  className="tws-field mt-1.5"
                />
              </div>
            </div>
          </section>

          <section className="tws-plate-card flex items-start gap-4 border-crimson-bright/30 p-5 sm:p-7">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-crimson-bright text-ivory">
              <Banknote className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-[1.1rem] text-crimson-bright">03</span>
                <h2 className="tws-eyebrow text-ink">Payment method</h2>
              </div>
              <p className="mt-2 text-[13.5px] font-semibold text-ink">Cash on delivery only</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                You pay the courier in cash when the parcel arrives — inspect the garment before you
                pay. No card, wallet or advance transfer is required.
              </p>
            </div>
          </section>
        </div>

        {/* ——— right: summary ——— */}
        <aside className="lg:col-span-5">
          <div className="tws-plate-card p-5 sm:p-6 lg:sticky lg:top-[116px]">
            <h2 className="tws-eyebrow border-b border-ink/12 pb-3 text-ink">
              Your bag · {totalItems} {totalItems === 1 ? 'piece' : 'pieces'}
            </h2>

            <ul className="mt-3 max-h-[300px] space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <li key={item.variant_id} className="flex gap-3.5 border-b border-ink/8 pb-3.5 last:border-b-0">
                  <Link
                    to={`/product/${item.product_slug}`}
                    className="flex h-[92px] w-[62px] shrink-0 items-end justify-center overflow-hidden rounded-[3px] border border-ink/10 bg-paper"
                  >
                    {item.product_image ? (
                      <img src={item.product_image} alt={item.product_name} loading="lazy" className="h-full w-auto object-contain object-bottom" />
                    ) : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold uppercase tracking-[0.06em] text-ink">
                      {item.product_name}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      Size {item.size_name} · Qty {item.quantity}
                    </p>
                    <ColourChip label={item.color_name} className="mt-1" />
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-ink">
                    {formatEGP(item.unit_price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {/* promo */}
            <div className="mt-4 border-t border-ink/12 pt-4">
              <label htmlFor="promo-code" className="tws-label flex items-center gap-1.5">
                <Tag className="h-3 w-3" strokeWidth={2} />
                Promo code
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="promo-code"
                  type="text"
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                  className="tws-field h-11 flex-1 text-[12px] tracking-[0.12em]"
                />
                <button
                  type="button"
                  onClick={() => setAppliedPromo(promoInput.trim().toUpperCase())}
                  className="h-11 shrink-0 rounded-[0.85rem] border border-ink/20 px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-ivory"
                >
                  Apply
                </button>
              </div>
              {quote?.promo_error ? (
                <p className="mt-1.5 text-[11px] font-semibold text-crimson-bright">{quote.promo_error}</p>
              ) : null}
              {quote?.promo_code_applied ? (
                <p className="mt-1.5 text-[11px] font-semibold text-crimson-bright">
                  Code {quote.promo_code_applied} applied (−{quote.promo_discount_percent}%).
                </p>
              ) : null}
            </div>

            {/* totals */}
            <dl className="mt-4 space-y-2 border-t border-ink/12 pt-4 text-[12.5px]">
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="font-semibold text-ink">{formatEGP(effectiveSubtotal)}</dd>
              </div>
              {quote?.email_discount_applied ? (
                <div className="flex items-baseline justify-between text-crimson-bright">
                  <dt>Email privilege ({quote.email_discount_percent}%)</dt>
                  <dd>−{formatEGP(quote.email_discount_amount)}</dd>
                </div>
              ) : null}
              {quote && quote.promo_discount_amount > 0 ? (
                <div className="flex items-baseline justify-between text-crimson-bright">
                  <dt>Promo {quote.promo_code_applied}</dt>
                  <dd>−{formatEGP(quote.promo_discount_amount)}</dd>
                </div>
              ) : null}
              {effectiveDiscount > 0 ? (
                <div className="flex items-baseline justify-between text-ink-soft">
                  <dt>Total discount</dt>
                  <dd>−{formatEGP(effectiveDiscount)}</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-soft">Delivery</dt>
                <dd className="font-semibold text-ink">
                  {effectiveShipping === 0 ? 'Free' : formatEGP(effectiveShipping)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-ink/12 pt-3">
                <dt className="tws-eyebrow text-ink">Due on delivery</dt>
                <dd className="font-display text-[1.6rem] leading-none tracking-[0.01em] text-ink">
                  {formatEGP(effectiveTotal)}
                </dd>
              </div>
            </dl>

            {quoting ? (
              <p className="mt-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                Verifying inventory &amp; discounts…
              </p>
            ) : null}

            {stockIssues.length > 0 ? (
              <div className="mt-4 rounded-xl border border-crimson-bright/25 bg-crimson-mist p-3.5">
                {stockIssues.map((message) => (
                  <p key={message} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-crimson-deep">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {message}
                  </p>
                ))}
              </div>
            ) : null}

            {submitError ? (
              <p role="alert" className="mt-4 rounded-xl border border-crimson-bright/25 bg-crimson-mist p-3.5 text-[11.5px] leading-relaxed text-crimson-deep">
                {submitError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || quoting || (quote !== null && !quote.valid)}
              className="tws-pill tws-pill--crimson mt-5 h-14 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Lock className="h-3.5 w-3.5" strokeWidth={2} />
              {submitting ? 'Confirming order…' : 'Place cash-on-delivery order'}
            </button>

            <Link
              to="/shop"
              className="mt-3 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-crimson-bright"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Keep shopping
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}
