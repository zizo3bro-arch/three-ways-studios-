import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Banknote, CheckCircle2, Lock, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createCodOrder, quoteCodOrder } from '../lib/api';
import { EGYPTIAN_GOVERNORATES, formatEGP } from '../lib/format';
import { isSupabaseConfigured } from '../lib/supabase';
import type { QuoteResponse } from '../types/database';

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

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Checkout (COD) — THREE WAYS STUDIOS';
  }, []);

  // Backend-validated quote whenever cart items, email, or promo code changes
  useEffect(() => {
    if (!isSupabaseConfigured || items.length === 0) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      setQuoting(true);
      const { quote: q } = await quoteCodOrder({
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
        email: email.trim(),
        promoCode: appliedPromo || undefined,
      });
      if (q) {
        setQuote(q);
        if (q.items?.length) {
          syncItemStock(
            q.items.map((qi) => ({
              variant_id: qi.variant_id,
              available_stock: qi.available_stock,
              unit_price: qi.unit_price,
            }))
          );
        }
      }
      setQuoting(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [items, email, appliedPromo]);

  const handleApplyPromo = () => {
    setAppliedPromo(promoInput.trim().toUpperCase());
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!isSupabaseConfigured) {
      setSubmitError('Supabase backend is not configured yet.');
      return;
    }
    if (items.length === 0) {
      setSubmitError('Your shopping bag is empty.');
      return;
    }
    if (quote && !quote.valid) {
      setSubmitError(quote.stock_errors?.[0] ?? 'Please resolve stock issues in your bag.');
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
      items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      promoCode: appliedPromo || undefined,
    });
    setSubmitting(false);

    if (error || !order) {
      setSubmitError(error ?? 'Could not place your order. Please verify your details and stock.');
      return;
    }

    try {
      sessionStorage.setItem(`tws_order_${order.order_reference}`, JSON.stringify(order));
    } catch {
      // ignore
    }

    clearCart();
    navigate(`/order-confirmation/${order.order_reference}`);
  };

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-5 pt-36 pb-28 text-center">
        <h1 className="font-display text-3xl uppercase tracking-[0.02em] text-[#201D1A]">Your Bag Is Empty</h1>
        <p className="mt-3 text-xs text-[#6E6862]">
          Add women&apos;s pants to your bag before proceeding to checkout.
        </p>
        <button
          type="button"
          onClick={() => {
            navigate('/');
            window.setTimeout(() => {
              document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
            }, 260);
          }}
          className="mt-7 inline-block rounded-full bg-[#201D1A] px-8 py-4 text-[10px] font-bold uppercase tracking-[0.28em] text-[#F5F2EB] transition-colors hover:bg-[#B30E16]"
        >
          Return to the Drop
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1280px] px-5 pt-30 pb-24 sm:px-8 lg:px-12">
      <div className="mb-10 border-b border-[#201D1A]/12 pb-6">
        <p className="text-[10px] tracking-[0.24em] text-[#B30E16] uppercase">
          THREE WAYS STUDIOS · SECURE CHECKOUT
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.02em] text-[#201D1A] sm:text-4xl">
          Cash on Delivery Checkout
        </h1>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Left: Customer & Delivery Form */}
        <div className="space-y-8 lg:col-span-7">
          {/* Contact & Email Discount Step */}
          <section className="rounded-3xl border border-[#201D1A]/12 bg-[#FCFBF7] p-6 shadow-[0_2px_18px_rgba(20,18,16,0.05)]">
            <h2 className="text-xs font-medium tracking-[0.2em] text-[#201D1A] uppercase">
              1. Customer Contact
            </h2>
            <p className="mt-1.5 text-xs text-[#6E6862]">
              A valid email address is required for order confirmation and unlocks your backend-verified
              checkout discount.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="checkout-email"
                  className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#57514B] uppercase"
                >
                  Email Address *
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-[#201D1A]/15 bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#201D1A] placeholder-[#A39C93] focus:border-[#b30e16] focus:outline-none"
                />
                {quote?.email_discount_applied && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[#B30E16]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#B30E16]" />
                    Backend verified: {quote.email_discount_percent}% email discount applied (-
                    {formatEGP(quote.email_discount_amount)}).
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="checkout-name"
                  className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#57514B] uppercase"
                >
                  Full Name *
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Recipient full name"
                  className="w-full border border-[#201D1A]/15 bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#201D1A] placeholder-[#A39C93] focus:border-[#b30e16] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="checkout-phone"
                  className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#57514B] uppercase"
                >
                  Phone Number *
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full border border-[#201D1A]/15 bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#201D1A] placeholder-[#A39C93] focus:border-[#b30e16] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Delivery Address */}
          <section className="rounded-3xl border border-[#201D1A]/12 bg-[#FCFBF7] p-6 shadow-[0_2px_18px_rgba(20,18,16,0.05)]">
            <h2 className="text-xs font-medium tracking-[0.2em] text-[#201D1A] uppercase">
              2. Delivery Address
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="checkout-gov"
                  className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#57514B] uppercase"
                >
                  Governorate *
                </label>
                <select
                  id="checkout-gov"
                  required
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className="w-full border border-[#201D1A]/15 bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#201D1A] focus:border-[#b30e16] focus:outline-none"
                >
                  {EGYPTIAN_GOVERNORATES.map((gov) => (
                    <option key={gov} value={gov}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="checkout-city"
                  className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#57514B] uppercase"
                >
                  City / Area *
                </label>
                <input
                  id="checkout-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Zamalek, Maadi, New Cairo"
                  className="w-full border border-[#201D1A]/15 bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#201D1A] placeholder-[#A39C93] focus:border-[#b30e16] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="checkout-address"
                  className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#57514B] uppercase"
                >
                  Full Delivery Address *
                </label>
                <textarea
                  id="checkout-address"
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street name, building number, floor, apartment, and nearby landmark"
                  className="w-full border border-[#201D1A]/15 bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#201D1A] placeholder-[#A39C93] focus:border-[#b30e16] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="checkout-notes"
                  className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#57514B] uppercase"
                >
                  Order Notes (Optional)
                </label>
                <input
                  id="checkout-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred delivery window or courier notes"
                  className="w-full border border-[#201D1A]/15 bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#201D1A] placeholder-[#A39C93] focus:border-[#b30e16] focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Payment Method: COD ONLY */}
          <section className="rounded-3xl border border-[#B30E16]/30 bg-[#FAECE7] p-6">
            <h2 className="text-xs font-medium tracking-[0.2em] text-[#201D1A] uppercase">
              3. Payment Method
            </h2>
            <div className="mt-4 flex items-start gap-3">
              <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-[#B30E16]" />
              <div>
                <p className="text-xs font-medium text-[#201D1A]">Cash on Delivery (COD) Only</p>
                <p className="mt-1 text-xs leading-relaxed text-[#57514B]">
                  You pay in cash directly to the courier upon receiving and inspecting your order.
                  No online card or wallet payment is required.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Backend-Verified Order Summary */}
        <div className="lg:col-span-5">
          <div className="sticky top-28 rounded-3xl border border-[#201D1A]/12 bg-[#FCFBF7] p-6 shadow-[0_2px_18px_rgba(20,18,16,0.05)]">
            <h2 className="border-b border-[#201D1A]/10 pb-3 text-xs font-medium tracking-[0.2em] text-[#201D1A] uppercase">
              Order Summary ({items.reduce((s, i) => s + i.quantity, 0)} items)
            </h2>

            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.variant_id} className="flex items-center gap-3 border-b border-[#201D1A]/8 pb-3">
                  <div className="bg-[#E9E6DC] h-16 w-12 shrink-0 overflow-hidden border border-[#201D1A]/10">
                    {item.product_image && (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="h-full w-full object-contain object-bottom"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[#201D1A]">{item.product_name}</p>
                    <p className="mt-0.5 text-[11px] text-[#6E6862]">
                      {item.color_name} · Size {item.size_name} · Qty {item.quantity}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#201D1A]">
                    {formatEGP(item.unit_price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Optional Promo Code */}
            <div className="mt-5 border-t border-[#201D1A]/10 pt-4">
              <label
                htmlFor="promo-code"
                className="mb-1.5 flex items-center gap-1.5 text-[10px] tracking-[0.18em] text-[#6E6862] uppercase"
              >
                <Tag className="h-3 w-3" />
                Promo Code (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  id="promo-code"
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 border border-[#201D1A]/15 bg-white px-3 py-2 text-xs text-[#201D1A] uppercase placeholder-[#A39C93] focus:border-[#b30e16] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="border border-[#201D1A]/20 px-4 py-2 text-[11px] tracking-[0.16em] text-[#201D1A] uppercase hover:border-[#201D1A]"
                >
                  Apply
                </button>
              </div>
              {quote?.promo_error && (
                <p className="mt-1.5 text-[11px] text-[#B3261E]">{quote.promo_error}</p>
              )}
              {quote?.promo_code_applied && (
                <p className="mt-1.5 text-[11px] text-[#B30E16]">
                  Code {quote.promo_code_applied} applied (-{quote.promo_discount_percent}%).
                </p>
              )}
            </div>

            {/* Authoritative Backend Totals */}
            <div className="mt-5 space-y-2.5 border-t border-[#201D1A]/10 pt-4 text-xs">
              <div className="flex justify-between text-[#33302C]">
                <span>Subtotal</span>
                <span>{formatEGP(quote ? quote.subtotal : subtotal)}</span>
              </div>

              {quote?.email_discount_applied && (
                <div className="flex justify-between text-[#B30E16]">
                  <span>Email Discount ({quote.email_discount_percent}%)</span>
                  <span>-{formatEGP(quote.email_discount_amount)}</span>
                </div>
              )}

              {quote && quote.promo_discount_amount > 0 && (
                <div className="flex justify-between text-[#B30E16]">
                  <span>Promo ({quote.promo_code_applied})</span>
                  <span>-{formatEGP(quote.promo_discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between border-t border-[#201D1A]/12 pt-3 text-base font-medium text-[#201D1A]">
                <span>Total Due on Delivery</span>
                <span>{formatEGP(quote ? quote.final_total : subtotal)}</span>
              </div>
              {quoting && (
                <p className="text-[10px] tracking-[0.16em] text-[#8D867D] uppercase">
                  Verifying inventory &amp; discounts...
                </p>
              )}
            </div>

            {/* Stock Validation Warnings */}
            {quote && !quote.valid && quote.stock_errors.length > 0 && (
              <div className="mt-4 border border-[#B3261E]/30 bg-[#FBE4DE] p-3 text-xs text-[#8F1D15]">
                {quote.stock_errors.map((err, i) => (
                  <p key={i} className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{err}</span>
                  </p>
                ))}
              </div>
            )}

            {submitError && (
              <div className="mt-4 border border-[#B3261E]/30 bg-[#FBE4DE] p-3 text-xs text-[#8F1D15]">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || quoting || (quote !== null && !quote.valid)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#b30e16] px-6 py-3.5 text-xs font-medium tracking-[0.2em] text-[#201D1A] uppercase transition-colors hover:bg-[#8F0B12] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Lock className="h-3.5 w-3.5" />
              {submitting ? 'Confirming Order...' : 'Place COD Order'}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
