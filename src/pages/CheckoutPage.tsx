import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { createCodOrder, isVariantId, quoteCodOrder } from '../lib/api';
import { EGYPTIAN_GOVERNORATES, formatEGP } from '../lib/format';
import { refreshCatalog } from '../hooks/useCatalog';
import type { QuoteResponse } from '../types/database';

type QuoteInput = Parameters<typeof quoteCodOrder>[0];
type CheckedQuote = { input: QuoteInput; quote: QuoteResponse | null; error: string | null };
type CheckoutAttempt = { bag: string; id: string };
const CHECKOUT_ATTEMPT_KEY = 'tws_cod_checkout_v1';
function mobileNumber(raw: string) {
  return raw.replace(/[\s()-]/g, '').replace(/^(?:\+20|0020|20)(1\d{9})$/, '0$1');
}

export function CheckoutPage() {
  const { items, subtotal, clearCart, syncItemStock } = useCart();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();
  const [fullNameInput, setFullNameInput] = useState(() => customer?.fullName ?? '');
  const [email, setEmail] = useState(() => customer?.email ?? '');
  const [phoneInput, setPhoneInput] = useState('');
  const [governorate, setGovernorate] = useState('Cairo');
  const [cityInput, setCityInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const prefilledFor = useRef<string | null>(customer?.id ?? null);
  useEffect(() => {
    if (!customer || prefilledFor.current === customer.id) return;
    prefilledFor.current = customer.id;
    if (!fullNameInput && customer.fullName) setFullNameInput(customer.fullName);
    if (!email && customer.email) setEmail(customer.email);
  }, [customer, fullNameInput, email]);
  const [promo, setPromo] = useState('');
  const [applied, setApplied] = useState('');
  const [payment, setPayment] = useState<'COD'>('COD');
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<CheckedQuote>();
  const [submitting, setSubmitting] = useState(false);
  const writing = useRef(false);
  const checkoutAttempt = useRef<CheckoutAttempt | null>(null);
  const [notice, setNotice] = useState('');
  // Only quote inputs enter the key. Syncing a price or stock limit must not
  // start a quote loop; stale responses must never enable the submit button.
  const key = JSON.stringify({
    items: items.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
    email: email.trim(),
    promoCode: applied,
  });
  // Use the identity of this request, not just its values: changing a code
  // and then changing it back still needs to finish the new verification.
  const input = useMemo<QuoteInput>(() => JSON.parse(key), [key, attempt]);
  const empty = items.length === 0;
  useEffect(() => {
    if (empty) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      const result = await quoteCodOrder(input);
      if (!current) return;
      setChecked({ input, ...result });
      if (result.quote) syncItemStock(result.quote.items);
    }, 220);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [input, empty, syncItemStock]);
  const currentCheck = checked?.input === input ? checked : undefined;
  const quote = currentCheck?.quote;
  const quoteError = currentCheck?.error;
  const verifiedQuote = quote?.valid && !quote.promo_error ? quote : null;
  const fullName = fullNameInput.trim();
  const phone = mobileNumber(phoneInput);
  const city = cityInput.trim();
  const address = addressInput.trim();
  const detailsComplete =
    fullName.length >= 3 &&
    /^01[0125]\d{8}$/.test(phone) &&
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(input.email) &&
    EGYPTIAN_GOVERNORATES.includes(governorate) &&
    city.length >= 2 &&
    address.length >= 10;
  const allowed = !empty && !!verifiedQuote && detailsComplete && payment === 'COD';

  function retryQuote() {
    setNotice('');
    setAttempt((n) => n + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writing.current || !allowed || !event.currentTarget.checkValidity()) return;
    const data = new FormData(event.currentTarget);
    if (data.get('payment_method') !== 'COD') return;

    // Keep the same request ID for retries of this bag, including a refresh
    // after an interrupted response. No contact details are stored here.
    const bag = JSON.stringify(input.items);
    if (checkoutAttempt.current?.bag !== bag) {
      let saved: CheckoutAttempt | null = null;
      try {
        saved = JSON.parse(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY) || 'null');
      } catch {
        // Storage may be disabled. The in-memory attempt still works.
      }
      if (saved?.bag === bag && typeof saved.id === 'string' && isVariantId(saved.id)) {
        checkoutAttempt.current = saved;
      } else {
        if (!globalThis.crypto?.randomUUID) {
          setNotice('Open checkout over a secure connection and try again.');
          return;
        }
        checkoutAttempt.current = { bag, id: crypto.randomUUID() };
        try {
          sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(checkoutAttempt.current));
        } catch {
          // Keep the request ID in memory.
        }
      }
    }

    writing.current = true;
    setSubmitting(true);
    setNotice('');
    const { order, error, refreshQuote } = await createCodOrder({
      fullName,
      email: input.email,
      phone,
      city,
      address,
      governorate,
      notes: String(data.get('notes') || ''),
      paymentMethod: payment,
      items: input.items,
      promoCode: input.promoCode,
      checkoutRequestId: checkoutAttempt.current.id,
    });
    if (!order || error) {
      writing.current = false;
      setSubmitting(false);
      setNotice(error || 'Order not confirmed. Your bag has been kept.');
      if (refreshQuote) setAttempt((n) => n + 1);
      return;
    }
    try {
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
    } catch {
      // The order is already saved.
    }
    clearCart();
    void refreshCatalog();
    // Pass only the lookup email; even a refresh or forged sessionStorage receipt
    // cannot render a confirmation without an actual database lookup.
    navigate(`/order-confirmation/${encodeURIComponent(order.order_reference)}`, {
      replace: true,
      state: { email: order.customer_email },
    });
  }
  if (empty)
    return (
      <section className="empty-state">
        <h1>Your bag is empty</h1>
        <Link to="/shop" className="tws-pill">
          Back to shop <ArrowRight />
        </Link>
      </section>
    );
  return (
    <section className="page-width checkout-page">
      <header className="cart-heading">
        <h1>Checkout</h1>
        <Link className="text-action" to="/cart">
          Edit cart <ArrowRight />
        </Link>
      </header>
      <form onSubmit={submit} className="checkout-spread">
        <fieldset disabled={submitting} className="checkout-fields">
          <legend className="section-label">Delivery details</legend>
          <div className="field-grid">
            <label>
              Full name
              <input
                name="full_name"
                value={fullNameInput}
                onChange={(e) => setFullNameInput(e.target.value)}
                autoComplete="name"
                required
                minLength={3}
                placeholder="Recipient’s full name"
              />
            </label>
            <label>
              Phone number
              <input
                type="tel"
                name="phone"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                autoComplete="tel"
                required
                placeholder="01x xxxx xxxx"
              />
            </label>
            <label className="field-wide">
              Email address
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Governorate
              <select
                name="governorate"
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                autoComplete="address-level1"
                required
              >
                {EGYPTIAN_GOVERNORATES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              City / district
              <input
                name="city"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                autoComplete="address-level2"
                minLength={2}
                required
                placeholder="City or district"
              />
            </label>
            <label className="field-wide">
              Complete address
              <textarea
                name="address"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                autoComplete="street-address"
                rows={2}
                required
                minLength={10}
                placeholder="Street, building, floor and apartment"
              />
            </label>
            <label className="field-wide">
              Courier notes (optional)
              <input name="notes" placeholder="Delivery instructions" />
            </label>
          </div>
          <fieldset className="payment-options">
            <legend className="section-label">Payment method</legend>
            <label className="cod-row">
              <input
                type="radio"
                name="payment_method"
                value="COD"
                checked={payment === 'COD'}
                onChange={() => setPayment('COD')}
                required
              />
              <span>
                Cash on delivery<small>Pay the courier in cash when your order arrives.</small>
              </span>
            </label>
          </fieldset>
        </fieldset>
        <div className="checkout-summary">
          <h2 className="section-label">Order summary</h2>
          <ul>
            {items.map((i) => (
              <li key={i.variant_id}>
                <Link to={`/product/${i.product_slug}`} aria-label={`View ${i.product_name}`}>
                  {i.product_image && <img src={i.product_image} alt="" />}
                </Link>
                <div>
                  <h3>{i.product_name}</h3>
                  <small>
                    Size: {i.size_name} · {i.color_name} · Qty: {i.quantity}
                  </small>
                </div>
                <p>{formatEGP(i.unit_price * i.quantity)}</p>
              </li>
            ))}
          </ul>
          <label htmlFor="promo-code" className="option-label">
            Promo code
          </label>
          <div className="promo-row">
            <input
              id="promo-code"
              value={promo}
              disabled={submitting}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Enter code"
            />
            <button
              type="button"
              disabled={submitting}
              className="text-action"
              onClick={() => {
                const code = promo.trim().toUpperCase();
                if (code === applied) retryQuote();
                else setApplied(code);
              }}
            >
              Apply
            </button>
          </div>
          {applied && (
            <p className="form-note" role={quote?.promo_error ? 'alert' : undefined}>
              {quote?.promo_error || applied}{' '}
              <button
                type="button"
                disabled={submitting}
                className="text-action"
                onClick={() => {
                  setPromo('');
                  setApplied('');
                }}
              >
                Remove code
              </button>
            </p>
          )}
          <dl className="cart-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatEGP(quote?.subtotal ?? subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>
                {verifiedQuote?.shipping_cost === undefined
                  ? 'Awaiting quote'
                  : verifiedQuote.shipping_cost === 0
                    ? 'Included'
                    : formatEGP(verifiedQuote.shipping_cost)}
              </dd>
            </div>
            {verifiedQuote?.email_discount_applied && (
              <div>
                <dt>Email discount ({verifiedQuote.email_discount_percent}%)</dt>
                <dd>−{formatEGP(verifiedQuote.email_discount_amount)}</dd>
              </div>
            )}
            {!!verifiedQuote?.promo_discount_amount && (
              <div>
                <dt>Promo discount</dt>
                <dd>−{formatEGP(verifiedQuote.promo_discount_amount)}</dd>
              </div>
            )}
            <div className="cart-total">
              <dt>Total</dt>
              <dd>{verifiedQuote ? formatEGP(verifiedQuote.final_total) : '—'}</dd>
            </div>
          </dl>
          {quoteError || (quote && !quote.valid) ? (
            <p role="alert" className="form-note">
              {quoteError ? `Could not verify this bag: ${quoteError}` : quote?.stock_errors.join(' ')}{' '}
              <button type="button" className="text-action" disabled={submitting} onClick={retryQuote}>
                Retry
              </button>
              {quote && !quote.valid && (
                <>
                  {' '}
                  <Link className="text-action" to="/cart">
                    Edit cart
                  </Link>
                </>
              )}
            </p>
          ) : !quote ? (
            <p role="status" className="form-note">
              Verifying inventory and total…
            </p>
          ) : verifiedQuote && !detailsComplete ? (
            <p className="form-note">Complete your delivery details to confirm.</p>
          ) : null}
          {notice && (
            <p role="alert" className="form-note">
              {notice}
            </p>
          )}
          <button type="submit" className="tws-pill wide-action" disabled={submitting || !allowed}>
            {submitting ? 'Confirming…' : 'Confirm order'} <ArrowRight />
          </button>
        </div>
      </form>
    </section>
  );
}
