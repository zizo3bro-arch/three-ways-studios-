import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, PackageSearch, Trash2 } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCatalog } from '../../hooks/useCatalog';
import { fetchOrderConfirmation } from '../../lib/api';
import { formatEGP } from '../../lib/format';
import { Overlay } from '../ui/Overlay';
import { ColourChip } from '../ui/ColourChip';
import type { OrderConfirmationData } from '../../types/database';

/* =========================================================
   ACCOUNT — the customer's own surfaces, and nothing else:
   1. bag summary with a route to checkout
   2. saved pieces (persisted locally, links back to the pieces)
   3. order lookup — the same confirmation query the receipt page
      uses (Supabase RPC when configured, local store in demo mode)

   This panel used to end with a "Dashboard sign in" button. It
   does not any more: the public site has no administrative
   entry point at all. Staff reach the console by typing /admin.
   ========================================================= */

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; order: OrderConfirmationData }
  | { status: 'missing'; message: string };

export function AccountPanel() {
  const { overlay, closeOverlay } = useUI();
  const { subtotal, itemCount, openDrawer } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { products } = useCatalog();

  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  const open = overlay === 'account';
  const saved = products.filter((product) => isWishlisted(product.id));

  const runLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reference.trim().length < 4 || !email.trim()) {
      setLookup({ status: 'missing', message: 'Enter your TWS reference and the email used on the order.' });
      return;
    }
    setLookup({ status: 'loading' });
    const { order, error } = await fetchOrderConfirmation(reference.trim(), email.trim());
    if (!order) {
      setLookup({ status: 'missing', message: error ?? 'No order found for that reference and email.' });
      return;
    }
    setLookup({ status: 'found', order });
  };

  return (
    <Overlay open={open} onClose={closeOverlay} label="Account" placement="right">
      <div className="-mx-5 flex h-full flex-col overflow-y-auto px-5 pb-6 sm:-mx-7 sm:px-7">
        <div className="border-b border-ink/16 pb-4">
          <p className="tws-eyebrow text-crimson">Your account</p>
          <h2
            className="mt-2 font-display uppercase leading-[0.9] tracking-[0.004em] text-ink"
            style={{ fontSize: 'clamp(1.8rem, 6vw, 2.3rem)' }}
          >
            The house
            <br />
            list
          </h2>
        </div>

        {/* bag */}
        <section className="mt-5 border-b border-ink/14 pb-5">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="tws-eyebrow text-ink-soft">Your bag</h3>
            <button
              type="button"
              onClick={() => {
                closeOverlay();
                openDrawer();
              }}
              className="text-[9px] font-bold uppercase tracking-[0.22em] text-crimson underline-offset-4 hover:underline"
            >
              Open bag
            </button>
          </div>
          <p className="mt-2.5 font-serif text-[15px] leading-snug text-ink">
            {itemCount === 0
              ? 'Empty — two silhouettes are waiting in the shop.'
              : `${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} · ${formatEGP(subtotal)}`}
          </p>
        </section>

        {/* saved pieces */}
        <section className="mt-5 border-b border-ink/14 pb-5">
          <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
            <Heart className="h-3.5 w-3.5 text-crimson" strokeWidth={2} />
            Saved pieces · {String(saved.length).padStart(2, '0')}
          </h3>

          {saved.length === 0 ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
              Tap the heart on any piece to keep it here. Saved pieces live on this device — no
              account needed, because the house sells cash on delivery.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {saved.map((product) => (
                <li key={product.id} className="flex items-center gap-3.5">
                  <span className="flex h-[68px] w-12 shrink-0 items-end justify-center overflow-hidden bg-[rgba(23,19,15,0.05)]">
                    {product.images?.[0]?.url ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].alt_text ?? product.name}
                        loading="lazy"
                        className="h-full w-auto object-contain object-bottom"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      to={`/product/${product.slug}`}
                      onClick={closeOverlay}
                      className="block truncate text-[13px] font-semibold text-ink transition-colors hover:text-crimson"
                    >
                      {product.name}
                    </Link>
                    <span className="mt-1 block text-[11px] tracking-wide text-ink-faint">
                      {formatEGP(product.price)}
                    </span>
                    <ColourChip
                      label={product.variants?.[0]?.color_name ?? 'Studio colour'}
                      className="mt-1"
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    aria-label={`Remove ${product.name} from saved pieces`}
                    className="flex h-9 w-9 items-center justify-center border border-ink/20 text-ink-faint transition-colors hover:border-crimson hover:text-crimson"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* order lookup */}
        <section className="mt-5">
          <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
            <PackageSearch className="h-3.5 w-3.5 text-crimson" strokeWidth={2} />
            Track an order
          </h3>
          <form onSubmit={runLookup} className="mt-3.5 space-y-4">
            <div>
              <label
                htmlFor="tws-lookup-ref"
                className="mb-1 block text-[9px] font-bold uppercase tracking-[0.22em] text-ink-faint"
              >
                Reference
              </label>
              <input
                id="tws-lookup-ref"
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value.toUpperCase())}
                placeholder="TWS-000000"
                className="tws-field tracking-[0.08em]"
              />
            </div>
            <div>
              <label
                htmlFor="tws-lookup-email"
                className="mb-1 block text-[9px] font-bold uppercase tracking-[0.22em] text-ink-faint"
              >
                Email on the order
              </label>
              <input
                id="tws-lookup-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="tws-field"
              />
            </div>

            <button type="submit" className="tws-pill h-12 w-full justify-center">
              {lookup.status === 'loading' ? 'Looking…' : 'Find my order'}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>

          {lookup.status === 'missing' ? (
            <p
              role="status"
              className="mt-3 border-l-2 border-crimson bg-[rgba(165,18,27,0.06)] px-3.5 py-2.5 text-[12px] leading-relaxed text-crimson-deep"
            >
              {lookup.message}
            </p>
          ) : null}

          {lookup.status === 'found' ? (
            <div className="mt-3 border border-ink/16 px-4 py-3.5">
              <p className="tws-eyebrow text-ink-faint">Order {lookup.order.order_reference}</p>
              <p className="mt-1.5 font-display text-lg uppercase leading-none text-ink">
                {lookup.order.status}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
                {lookup.order.items.length} {lookup.order.items.length === 1 ? 'piece' : 'pieces'} ·{' '}
                {formatEGP(lookup.order.total_amount)} due on delivery to{' '}
                {lookup.order.city || lookup.order.governorate || 'Cairo'}.
              </p>
              <Link
                to={`/order-confirmation/${lookup.order.order_reference}?email=${encodeURIComponent(lookup.order.customer_email ?? '')}`}
                onClick={closeOverlay}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-crimson hover:text-crimson-deep"
              >
                Open confirmation
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
        </section>

        <p className="mt-7 border-t border-ink/14 pt-5 text-[10px] leading-relaxed text-ink-faint">
          The house sells cash on delivery — no customer password required. Orders, saved pieces
          and delivery details all live on this device.
        </p>
      </div>
    </Overlay>
  );
}
