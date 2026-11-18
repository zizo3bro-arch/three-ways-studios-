import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createCodOrder, quoteCodOrder } from '../lib/api';
import { EGYPTIAN_GOVERNORATES, formatEGP } from '../lib/format';
import { refreshCatalog } from '../hooks/useCatalog';
import type { QuoteResponse } from '../types/database';

type CheckedQuote = { key: string; quote: QuoteResponse | null; error: string | null };
function mobileNumber(raw: string) {
  return raw.replace(/[\s()-]/g, '').replace(/^(?:\+20|0020|20)(1\d{9})$/, '0$1');
}

export function CheckoutPage() {
  const { items, subtotal, clearCart, syncItemStock } = useCart();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [promo, setPromo] = useState('');
  const [applied, setApplied] = useState('');
  const [payment, setPayment] = useState<'COD'>('COD');
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<CheckedQuote>();
  const [submitting, setSubmitting] = useState(false);
  const writing = useRef(false);
  const [notice, setNotice] = useState('');
  // Only quote inputs enter the key. Syncing a price or stock limit must not
  // start a quote loop; stale responses must never enable the submit button.
  const key = JSON.stringify({
    items: items.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
    email: email.trim(),
    promoCode: applied,
  });
  const empty = items.length === 0;
  useEffect(() => {
    if (empty) return;
    let current = true;
    const timer = window.setTimeout(async () => {
      const result = await quoteCodOrder(JSON.parse(key));
      if (!current) return;
      setChecked({ key, ...result });
      if (result.quote) syncItemStock(result.quote.items);
    }, 220);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [key, attempt, empty, syncItemStock]);
  const quote = checked?.key === key ? checked.quote : null;
  const quoteError = checked?.key === key && checked.error;
  const allowed = Boolean(quote?.valid && !quote.promo_error && payment === 'COD');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writing.current || !allowed) return;
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) || '').trim();
    const [fullName, phone, city, address] = [
      field('full_name'),
      mobileNumber(field('phone')),
      field('city'),
      field('address'),
    ];
    if (
      fullName.length < 3 ||
      city.length < 2 ||
      address.length < 10 ||
      !/^01[0125]\d{8}$/.test(phone)
    ) {
      setNotice('Enter a full name, Egyptian mobile number, city and complete street address.');
      return;
    }
    if (data.get('payment_method') !== 'COD') {
      setNotice('Select cash on delivery to confirm.');
      return;
    }
    writing.current = true;
    setSubmitting(true);
    setNotice('');
    const { order, error } = await createCodOrder({
      fullName,
      email,
      phone,
      city,
      address,
      governorate: field('governorate'),
      notes: field('notes'),
      paymentMethod: payment,
      items: items.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
      promoCode: applied,
    });
    writing.current = false;
    setSubmitting(false);
    if (!order || error) {
      setNotice(error || 'Order not confirmed. Your bag has been kept.');
      return;
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
                autoComplete="name"
                required
                minLength={3}
                placeholder="Recipient’s full name"
              />
            </label>
            <label>
              Phone number
              <input type="tel" name="phone" autoComplete="tel" required placeholder="01x xxxx xxxx" />
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
              <select name="governorate" defaultValue="Cairo" autoComplete="address-level1">
                {EGYPTIAN_GOVERNORATES.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              City / district
              <input
                name="city"
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
              onClick={() => setApplied(promo.trim().toUpperCase())}
            >
              Apply
            </button>
          </div>
          {applied && (
            <p className="form-note">
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
                {quote
                  ? quote.shipping_cost
                    ? formatEGP(quote.shipping_cost)
                    : 'Included'
                  : 'Awaiting quote'}
              </dd>
            </div>
            {quote?.email_discount_applied && (
              <div>
                <dt>Email discount ({quote.email_discount_percent}%)</dt>
                <dd>−{formatEGP(quote.email_discount_amount)}</dd>
              </div>
            )}
            {!!quote?.promo_discount_amount && (
              <div>
                <dt>Promo discount</dt>
                <dd>−{formatEGP(quote.promo_discount_amount)}</dd>
              </div>
            )}
            <div className="cart-total">
              <dt>Total</dt>
              <dd>{quote ? formatEGP(quote.final_total) : '—'}</dd>
            </div>
          </dl>
          {quoteError ? (
            <p role="alert" className="form-note">
              Could not verify this bag: {quoteError}{' '}
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  setChecked(undefined);
                  setAttempt((n) => n + 1);
                }}
              >
                Retry
              </button>
            </p>
          ) : !quote ? (
            <p role="status" className="form-note">
              Verifying inventory and total…
            </p>
          ) : (
            !quote.valid && (
              <p role="alert" className="form-note">
                {quote.stock_errors.join(' ')}{' '}
                <Link className="text-action" to="/cart">
                  Edit cart
                </Link>
              </p>
            )
          )}
          {notice && (
            <p role="alert" className="form-note">
              {notice}
            </p>
          )}
          <button className="tws-pill wide-action" disabled={submitting || !allowed}>
            {submitting ? 'Confirming…' : 'Confirm COD order'} <ArrowRight />
          </button>
        </div>
      </form>
    </section>
  );
}
