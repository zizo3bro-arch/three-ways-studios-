import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  LogOut,
  PackageSearch,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useCart } from '../../context/CartContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCatalog } from '../../hooks/useCatalog';
import { fetchOrderConfirmation } from '../../lib/api';
import { formatEGP } from '../../lib/format';
import { Overlay } from '../ui/Overlay';
import type { OrderConfirmationData } from '../../types/database';

/* =========================================================
   ACCOUNT — the customer's own surfaces, and nothing else:
   1. customer profile — optional storefront registration & sign-in
      backed by Supabase Auth (never linked to /admin)
   2. bag summary with a route to checkout
   3. saved pieces (persisted locally, links back to the pieces)
   4. order lookup — Supabase RPC (reference + email)
   ========================================================= */

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; order: OrderConfirmationData }
  | { status: 'missing'; message: string };

type AuthMode = 'register' | 'signin';

export function AccountPanel() {
  const { overlay, closeOverlay } = useUI();
  const { subtotal, itemCount, openDrawer } = useCart();
  const { customer, loading: authLoading, available: authAvailable, signUp, signIn, signOut } =
    useCustomerAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { products } = useCatalog();

  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [fullName, setFullName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  const open = overlay === 'account';
  const saved = products.filter((product) => isWishlisted(product.id));

  useEffect(() => {
    if (customer?.email && !email) {
      setEmail(customer.email);
    }
  }, [customer?.email, email]);

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (authPending) return;
    setAuthFeedback(null);

    if (authMode === 'register' && fullName.trim().length < 2) {
      setAuthFeedback({ ok: false, text: 'Enter your full name to create an account.' });
      return;
    }

    setAuthPending(true);
    if (authMode === 'register') {
      const result = await signUp({ fullName, email: accountEmail, password });
      setAuthPending(false);
      if (result.error) {
        setAuthFeedback({ ok: false, text: result.error });
        return;
      }
      setPassword('');
      if (result.needsEmailConfirmation) {
        setAuthFeedback({
          ok: true,
          text: `Account created for ${result.email ?? accountEmail.trim()}. Check your inbox to confirm your email, then sign in.`,
        });
        setAuthMode('signin');
      } else {
        setFullName('');
        setAccountEmail('');
        setAuthFeedback({ ok: true, text: 'Welcome to Three Ways Studios — your account is ready.' });
      }
      return;
    }

    const result = await signIn({ email: accountEmail, password });
    setAuthPending(false);
    if (result.error) {
      setAuthFeedback({ ok: false, text: result.error });
      return;
    }
    setPassword('');
    setAccountEmail('');
    setAuthFeedback(null);
  };

  const handleSignOut = async () => {
    setAuthFeedback(null);
    const result = await signOut();
    if (result.error) {
      setAuthFeedback({ ok: false, text: result.error });
    }
  };

  const runLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reference.trim().length < 4 || !email.trim()) {
      setLookup({
        status: 'missing',
        message: 'Enter your TWS reference and the email used on the order.',
      });
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
      <div className="-mx-5 flex h-full flex-col overflow-y-auto px-5 pb-7 sm:-mx-7 sm:px-7">
        <div className="border-b border-ink/16 pb-4">
          <p className="tws-eyebrow text-crimson">Your account</p>
          <h2
            className="mt-2 font-display uppercase leading-[0.92] tracking-[0.01em] text-ink"
            style={{ fontSize: 'clamp(1.9rem, 5.5vw, 2.45rem)' }}
          >
            {customer ? customer.fullName || 'Member profile' : 'Customer account'}
          </h2>
        </div>

        {/* customer registration / sign-in / active profile */}
        <section className="mt-5 border-b border-ink/14 pb-6" aria-label="Account profile">
          <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
            <UserRound className="h-4 w-4 text-crimson" strokeWidth={2} />
            {customer ? 'Signed in' : 'Member access'}
          </h3>

          {!authAvailable ? (
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
              Account sign-in is unavailable while the studio connection is offline.
            </p>
          ) : authLoading ? (
            <p className="mt-3 text-[13.5px] text-ink-soft">Checking your account…</p>
          ) : customer ? (
            <div className="mt-3.5 space-y-3 border border-ink/15 p-4">
              <div>
                <p className="text-[15px] font-semibold text-ink">
                  {customer.fullName || 'Three Ways Studios Customer'}
                </p>
                <p className="mt-0.5 break-all text-[13px] text-ink-soft">{customer.email}</p>
                {customer.createdAt ? (
                  <p className="mt-1.5 text-[11.5px] uppercase tracking-[0.12em] text-ink-faint">
                    Member since{' '}
                    {new Date(customer.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                ) : null}
              </div>

              {authFeedback ? (
                <p
                  role={authFeedback.ok ? 'status' : 'alert'}
                  className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft"
                >
                  {authFeedback.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                  ) : null}
                  <span>{authFeedback.text}</span>
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="tws-pill tws-pill--outline w-full justify-center"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.8} />
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-3.5">
              <div
                className="grid grid-cols-2 border border-ink/18 p-1"
                role="group"
                aria-label="Account mode"
              >
                <button
                  type="button"
                  aria-pressed={authMode === 'register'}
                  onClick={() => {
                    setAuthMode('register');
                    setAuthFeedback(null);
                  }}
                  className={[
                    'py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors',
                    authMode === 'register'
                      ? 'bg-crimson text-paper'
                      : 'text-ink-soft hover:text-crimson',
                  ].join(' ')}
                >
                  Create account
                </button>
                <button
                  type="button"
                  aria-pressed={authMode === 'signin'}
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthFeedback(null);
                  }}
                  className={[
                    'py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors',
                    authMode === 'signin'
                      ? 'bg-crimson text-paper'
                      : 'text-ink-soft hover:text-crimson',
                  ].join(' ')}
                >
                  Sign in
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3.5">
                {authMode === 'register' ? (
                  <div>
                    <label
                      htmlFor="tws-account-name"
                      className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
                    >
                      Full name
                    </label>
                    <input
                      id="tws-account-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Your full name"
                      className="tws-field"
                    />
                  </div>
                ) : null}

                <div>
                  <label
                    htmlFor="tws-account-email"
                    className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
                  >
                    Account email
                  </label>
                  <input
                    id="tws-account-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={accountEmail}
                    onChange={(event) => setAccountEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="tws-field"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tws-account-password"
                    className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="tws-account-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={authMode === 'register' ? 8 : 1}
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={authMode === 'register' ? 'At least 8 characters' : 'Your password'}
                      className="tws-field pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-ink-faint hover:text-crimson"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={1.8} />
                      )}
                    </button>
                  </div>
                </div>

                {authFeedback ? (
                  <p
                    role={authFeedback.ok ? 'status' : 'alert'}
                    className={[
                      'border-l-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed',
                      authFeedback.ok
                        ? 'border-ink/40 bg-ink/[0.04] text-ink'
                        : 'border-crimson bg-[rgba(165,18,27,0.06)] text-crimson-deep',
                    ].join(' ')}
                  >
                    {authFeedback.text}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={authPending}
                  className="tws-pill h-12 w-full justify-center"
                >
                  {authPending
                    ? authMode === 'register'
                      ? 'Creating account…'
                      : 'Signing in…'
                    : authMode === 'register'
                      ? 'Create account'
                      : 'Sign in'}
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </form>
            </div>
          )}
        </section>

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
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-crimson underline-offset-4 hover:underline"
            >
              Open bag
            </button>
          </div>
          <p className="mt-2.5 font-serif text-[16px] leading-snug text-ink">
            {itemCount === 0
              ? 'Your bag is empty.'
              : `${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} · ${formatEGP(subtotal)}`}
          </p>
        </section>

        {/* saved pieces */}
        <section className="mt-5 border-b border-ink/14 pb-5">
          <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
            <Heart className="h-4 w-4 text-crimson" strokeWidth={2} />
            Saved pieces · {String(saved.length).padStart(2, '0')}
          </h3>

          {saved.length === 0 ? (
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
              Tap the heart on any piece to keep it here for your next order.
            </p>
          ) : (
            <ul className="mt-3.5 space-y-3.5">
              {saved.map((product) => (
                <li key={product.id} className="flex items-center gap-3.5">
                  <span className="flex h-[74px] w-14 shrink-0 items-end justify-center overflow-hidden">
                    {product.images?.[0]?.url ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].alt_text ?? product.name}
                        loading="lazy"
                        className="h-full w-auto object-contain object-bottom mix-blend-multiply"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      to={`/product/${product.slug}`}
                      onClick={closeOverlay}
                      className="block truncate text-[14px] font-semibold text-ink transition-colors hover:text-crimson"
                    >
                      {product.name}
                    </Link>
                    <span className="mt-0.5 block text-[12.5px] tracking-wide text-ink-faint">
                      {formatEGP(product.price)}
                    </span>
                    <small className="block text-[12px] text-ink-soft">
                      {product.variants?.[0]?.color_name ?? 'Studio colour'}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    aria-label={`Remove ${product.name} from saved pieces`}
                    className="flex h-10 w-10 items-center justify-center border border-ink/20 text-ink-faint transition-colors hover:border-crimson hover:text-crimson"
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
            <PackageSearch className="h-4 w-4 text-crimson" strokeWidth={2} />
            Track an order
          </h3>
          <form onSubmit={runLookup} className="mt-3.5 space-y-4">
            <div>
              <label
                htmlFor="tws-lookup-ref"
                className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
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
                className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
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

            <button
              type="submit"
              disabled={lookup.status === 'loading'}
              className="tws-pill h-12 w-full justify-center"
            >
              {lookup.status === 'loading' ? 'Looking…' : 'Find my order'}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>

          {lookup.status === 'missing' ? (
            <p
              role="status"
              className="mt-3 border-l-2 border-crimson bg-[rgba(165,18,27,0.06)] px-3.5 py-2.5 text-[13px] leading-relaxed text-crimson-deep"
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
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                {lookup.order.items.length} {lookup.order.items.length === 1 ? 'piece' : 'pieces'} ·{' '}
                {formatEGP(lookup.order.total_amount)} due on delivery to{' '}
                {lookup.order.city || lookup.order.governorate || 'Cairo'}.
              </p>
              <Link
                to={`/order-confirmation/${lookup.order.order_reference}`}
                state={{ email: lookup.order.customer_email }}
                onClick={closeOverlay}
                className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-crimson hover:text-crimson-deep"
              >
                Open confirmation
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
        </section>

        <p className="mt-7 border-t border-ink/14 pt-5 text-[11.5px] leading-relaxed text-ink-faint">
          Cash on delivery across Egypt. Create an account for faster checkout, or order as a guest any
          time.
        </p>
      </div>
    </Overlay>
  );
}
