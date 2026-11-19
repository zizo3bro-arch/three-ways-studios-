import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Gift,
  Heart,
  History,
  LogOut,
  PackageSearch,
  Percent,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { useCatalog } from '../../hooks/useCatalog';
import {
  fetchCustomerAccountOverview,
  subscribeNewsletter,
  trackOrder,
} from '../../lib/api';
import { formatEGP } from '../../lib/format';
import { resolveTrackingStage } from '../../lib/orderTracking';
import type { CustomerAccountOverview, TrackedOrderData } from '../../types/database';
import { OrderTrackingResult } from './OrderTrackingResult';

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; order: TrackedOrderData; email: string }
  | { status: 'missing'; message: string };

type AuthMode = 'register' | 'signin';

interface CustomerAccountBodyProps {
  mode: 'panel' | 'page';
  active?: boolean;
  onNavigate?: () => void;
}

export function CustomerAccountBody({
  mode,
  active = true,
  onNavigate,
}: CustomerAccountBodyProps) {
  const { subtotal, itemCount, openDrawer } = useCart();
  const {
    customer,
    loading: authLoading,
    available: authAvailable,
    signUp,
    signIn,
    signOut,
  } = useCustomerAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { products } = useCatalog();

  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [fullName, setFullName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [overview, setOverview] = useState<CustomerAccountOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [discountEmail, setDiscountEmail] = useState('');
  const [discountPending, setDiscountPending] = useState(false);
  const [discountNotice, setDiscountNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  const saved = products.filter((product) => isWishlisted(product.id));

  const loadOverview = useCallback(async () => {
    if (!customer) {
      setOverview(null);
      setOverviewError(null);
      return;
    }
    setOverviewLoading(true);
    setOverviewError(null);
    const result = await fetchCustomerAccountOverview();
    setOverviewLoading(false);
    if (result.error) {
      setOverviewError(result.error);
      return;
    }
    setOverview(result.overview);
  }, [customer]);

  useEffect(() => {
    if (!active) return;
    if (customer) {
      void loadOverview();
    } else {
      setOverview(null);
      setOverviewError(null);
    }
  }, [active, customer, loadOverview]);

  useEffect(() => {
    if (customer?.email) {
      setEmail((prev) => prev || customer.email);
      setDiscountEmail((prev) => prev || customer.email);
    }
  }, [customer?.email]);

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

  const handleEmailDiscountSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (discountPending) return;
    setDiscountNotice(null);
    const targetEmail = (customer?.email || discountEmail).trim().toLowerCase();
    if (!targetEmail) {
      setDiscountNotice({ ok: false, text: 'Enter a valid email address.' });
      return;
    }
    setDiscountPending(true);
    const res = await subscribeNewsletter(targetEmail);
    setDiscountPending(false);
    if (!res.ok) {
      setDiscountNotice({ ok: false, text: res.message });
      return;
    }
    if (customer) {
      await loadOverview();
    }
    setDiscountNotice({
      ok: true,
      text: res.alreadySubscribed
        ? 'Email verified on the studio list. If unused, your 10% discount will apply automatically at checkout.'
        : '10% Email Discount unlocked. Use this email at checkout to apply 10% off your order.',
    });
  };

  const runLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanRef = reference.trim();
    const cleanEmail = email.trim();
    if (cleanRef.length < 4 || !cleanEmail) {
      setLookup({
        status: 'missing',
        message: 'Enter your order number and the email used on the order.',
      });
      return;
    }
    setLookup({ status: 'loading' });
    const { order, error } = await trackOrder(cleanRef, cleanEmail);
    if (!order) {
      setLookup({
        status: 'missing',
        message: error ?? 'No order found for that order number and email.',
      });
      return;
    }
    setLookup({ status: 'found', order, email: cleanEmail });
  };

  const displayName = overview?.profile.full_name || customer?.fullName || '';
  const loyalty = overview?.loyalty;
  const discounts = overview?.discounts;
  const completedCount = overview?.purchase_summary.completed_purchases ?? 0;
  const progressCount = loyalty?.progress_in_cycle ?? 0;
  const remainingCount = loyalty?.purchases_remaining ?? 5;
  const freeUnlocked = Boolean(loyalty?.free_product_unlocked);

  return (
    <div className={mode === 'page' ? 'space-y-10' : 'space-y-0'}>
      {/* ——— 1. Personal Account / Sign-in ——— */}
      <section
        className={mode === 'page' ? 'border-b border-ink/16 pb-8' : 'mt-5 border-b border-ink/14 pb-6'}
        aria-label="Account profile"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
            <UserRound className="h-4 w-4 text-crimson" strokeWidth={2} />
            {customer ? 'Personal account' : 'Member access'}
          </h3>
          {mode === 'panel' ? (
            <Link
              to="/account"
              onClick={onNavigate}
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-crimson underline-offset-4 hover:underline"
            >
              Full account view
            </Link>
          ) : null}
        </div>

        {!authAvailable ? (
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
            Account sign-in is unavailable while the studio connection is offline.
          </p>
        ) : authLoading ? (
          <p className="mt-3 text-[13.5px] text-ink-soft">Checking your account…</p>
        ) : customer ? (
          <div className="mt-3.5 space-y-3.5 border border-ink/16 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink">
                  {displayName || 'Three Ways Studios Member'}
                </p>
                <p className="mt-0.5 break-all text-[13px] text-ink-soft">{customer.email}</p>
                {(overview?.profile.city || overview?.profile.governorate) ? (
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {[overview?.profile.city, overview?.profile.governorate]
                      .filter(Boolean)
                      .join(', ')}
                    {overview?.profile.phone ? ` · ${overview.profile.phone}` : ''}
                  </p>
                ) : null}
                {(overview?.profile.created_at || customer.createdAt) ? (
                  <p className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                    Member since{' '}
                    {new Date(
                      overview?.profile.created_at || customer.createdAt!
                    ).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                ) : null}
              </div>

              <div className="border border-ink/16 px-3 py-2 text-right">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  Completed
                </span>
                <span
                  className="mt-0.5 block font-display text-lg font-bold tabular-nums leading-none text-ink"
                  data-testid="account-completed-count"
                >
                  {completedCount} {completedCount === 1 ? 'purchase' : 'purchases'}
                </span>
              </div>
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
                    htmlFor={`tws-account-name-${mode}`}
                    className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
                  >
                    Full name
                  </label>
                  <input
                    id={`tws-account-name-${mode}`}
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
                  htmlFor={`tws-account-email-${mode}`}
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
                >
                  Account email
                </label>
                <input
                  id={`tws-account-email-${mode}`}
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
                  htmlFor={`tws-account-password-${mode}`}
                  className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id={`tws-account-password-${mode}`}
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

      {/* ——— 2. Loyalty Card — Free Product After 5 Purchases ——— */}
      <section
        className={mode === 'page' ? 'border-b border-ink/16 pb-8' : 'mt-5 border-b border-ink/14 pb-6'}
        aria-label="Loyalty card"
        data-testid="loyalty-card"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
            <Award className="h-4 w-4 text-crimson" strokeWidth={2} />
            Loyalty card
          </h3>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-crimson tabular-nums">
            {customer ? `${progressCount}/5 purchases` : '5 purchases = 1 free piece'}
          </span>
        </div>

        <div className="mt-3.5 border border-ink/18 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-[1rem] uppercase tracking-[0.06em] text-ink">
              Free product after 5 purchases
            </p>
            {customer ? (
              <span
                className="font-mono text-[13px] font-semibold tabular-nums text-ink"
                data-testid="loyalty-progress-fraction"
              >
                {progressCount}/5
              </span>
            ) : null}
          </div>

          <div
            className="mt-3 grid grid-cols-5 gap-2"
            aria-label={`Loyalty stamps: ${progressCount} of 5 completed`}
          >
            {[1, 2, 3, 4, 5].map((slot) => {
              const filled = customer ? progressCount >= slot : false;
              return (
                <div
                  key={slot}
                  className={[
                    'flex h-10 items-center justify-center border text-[11px] font-bold tabular-nums transition-colors',
                    filled
                      ? 'border-crimson bg-crimson text-paper'
                      : 'border-ink/20 text-ink-faint',
                  ].join(' ')}
                >
                  {slot === 5 ? <Gift className="h-4 w-4" strokeWidth={1.9} /> : `0${slot}`}
                </div>
              );
            })}
          </div>

          {!customer ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
              Sign in or create a personal account to track your completed purchases. Every 5
              completed orders unlock 1 free product.
            </p>
          ) : overviewLoading && !overview ? (
            <p className="mt-3 text-[12.5px] text-ink-soft">Loading loyalty progress…</p>
          ) : freeUnlocked ? (
            <div
              className="mt-3.5 border-l-2 border-crimson bg-[rgba(165,18,27,0.06)] px-3.5 py-3"
              data-testid="loyalty-unlocked-banner"
            >
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-crimson">
                Free product unlocked ({loyalty?.available_rewards}{' '}
                {loyalty?.available_rewards === 1 ? 'reward' : 'rewards'} available)
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink">
                You completed 5/5 purchases and unlocked 1 FREE product. Select &ldquo;Redeem free
                product reward&rdquo; at checkout while signed in.
              </p>
              <Link
                to={itemCount > 0 ? '/checkout' : '/shop'}
                onClick={onNavigate}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-crimson hover:text-crimson-deep"
              >
                {itemCount > 0 ? 'Redeem at checkout' : 'Choose your piece'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <p
              className="mt-3 text-[12.5px] leading-relaxed text-ink-soft"
              data-testid="loyalty-remaining-copy"
            >
              <span className="font-semibold text-ink">
                {remainingCount} {remainingCount === 1 ? 'purchase' : 'purchases'} remaining
              </span>{' '}
              until your free product reward.
              {loyalty && loyalty.redeemed_rewards > 0
                ? ` (${loyalty.redeemed_rewards} free ${loyalty.redeemed_rewards === 1 ? 'reward' : 'rewards'} previously redeemed.)`
                : ' Only delivered orders count; cancelled orders are excluded.'}
            </p>
          )}
        </div>
      </section>

      {/* ——— 3. Discount Eligibility (Option 1 + Option 2, Non-Stacking) ——— */}
      <section
        className={mode === 'page' ? 'border-b border-ink/16 pb-8' : 'mt-5 border-b border-ink/14 pb-6'}
        aria-label="Discount eligibility"
        data-testid="discount-eligibility"
      >
        <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
          <Percent className="h-4 w-4 text-crimson" strokeWidth={2} />
          Member &amp; email discounts
        </h3>

        <div className="mt-3.5 space-y-3">
          {/* Option 1: Purchase Loyalty Discount */}
          <div className="border border-ink/16 p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink">
                10% Purchase Loyalty Discount
              </p>
              <span
                className={[
                  'text-[10.5px] font-bold uppercase tracking-[0.14em]',
                  discounts?.loyalty_discount_eligible ? 'text-crimson' : 'text-ink-faint',
                ].join(' ')}
              >
                {customer
                  ? discounts?.loyalty_discount_eligible
                    ? 'Eligible · 10% OFF'
                    : `${Math.min(completedCount, 3)}/3 purchases`
                  : 'After 3 purchases'}
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
              {customer
                ? discounts?.loyalty_discount_eligible
                  ? 'Unlocked — 10% off applies automatically at checkout when signed in.'
                  : `Complete ${discounts?.purchases_until_loyalty_discount ?? Math.max(0, 3 - completedCount)} more ${
                      (discounts?.purchases_until_loyalty_discount ?? Math.max(0, 3 - completedCount)) === 1
                        ? 'purchase'
                        : 'purchases'
                    } to unlock 10% off.`
                : 'Sign in and complete 3 purchases to unlock a 10% loyalty discount.'}
            </p>
          </div>

          {/* Option 2: Email Discount */}
          <div className="border border-ink/16 p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink">
                10% Email Discount
              </p>
              <span
                className={[
                  'text-[10.5px] font-bold uppercase tracking-[0.14em]',
                  discounts?.email_discount_eligible
                    ? 'text-crimson'
                    : discounts?.email_discount_used
                      ? 'text-ink-faint'
                      : 'text-ink-soft',
                ].join(' ')}
              >
                {customer && discounts
                  ? discounts.email_discount_eligible
                    ? 'Eligible · 10% OFF'
                    : discounts.email_discount_used
                      ? 'Redeemed'
                      : 'Submit email'
                  : 'One-time 10% OFF'}
              </span>
            </div>

            {customer && discounts?.email_discount_eligible ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                Your email is registered — 10% off will be applied automatically at checkout.
              </p>
            ) : customer && discounts?.email_discount_used ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                Your one-time 10% email discount has already been used on a previous order.
              </p>
            ) : (
              <>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                  Submit your email address to unlock a one-time 10% discount at checkout.
                </p>
                <form onSubmit={handleEmailDiscountSubmit} className="mt-3 flex flex-wrap gap-2.5">
                  <label htmlFor={`tws-discount-email-${mode}`} className="sr-only">
                    Email for 10% discount
                  </label>
                  <input
                    id={`tws-discount-email-${mode}`}
                    type="email"
                    required
                    value={customer ? customer.email : discountEmail}
                    readOnly={Boolean(customer)}
                    onChange={(e) => {
                      setDiscountEmail(e.target.value);
                      setDiscountNotice(null);
                    }}
                    placeholder="Enter your email"
                    className="tws-field flex-1 min-w-[170px] text-[13.5px]"
                  />
                  <button
                    type="submit"
                    disabled={discountPending}
                    className="tws-pill compact-pill"
                  >
                    {discountPending ? 'Applying…' : 'Unlock 10% off'}
                  </button>
                </form>
                {discountNotice ? (
                  <p
                    role={discountNotice.ok ? 'status' : 'alert'}
                    className="mt-2 text-[12px] leading-relaxed text-ink-soft"
                  >
                    {discountNotice.text}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            Maximum 10% eligibility discount per order — Purchase Loyalty and Email discounts do
            not stack.
          </p>
        </div>
      </section>

      {/* ——— 4. Purchase History (Signed-in Customers) ——— */}
      {customer ? (
        <section
          className={
            mode === 'page' ? 'border-b border-ink/16 pb-8' : 'mt-5 border-b border-ink/14 pb-6'
          }
          aria-label="Purchase history"
          data-testid="purchase-history"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
              <History className="h-4 w-4 text-crimson" strokeWidth={2} />
              Purchase history
            </h3>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint tabular-nums">
              {completedCount} completed
            </span>
          </div>

          {overviewError ? (
            <p role="alert" className="mt-3 text-[12.5px] text-crimson-deep">
              {overviewError}{' '}
              <button type="button" onClick={() => void loadOverview()} className="text-action">
                Retry
              </button>
            </p>
          ) : overviewLoading && !overview ? (
            <p className="mt-3 text-[13px] text-ink-soft">Loading your orders…</p>
          ) : !overview || overview.orders.length === 0 ? (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              No orders on this account yet. Completed purchases will appear here automatically.
            </p>
          ) : (
            <ul className="mt-3.5 space-y-3">
              {overview.orders.map((ord) => {
                const stage = resolveTrackingStage(ord.status, ord.tracking);
                return (
                  <li
                    key={ord.order_id}
                    className="border border-ink/16 p-3.5"
                    data-testid="purchase-history-item"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-[12.5px] font-semibold text-ink">
                        {ord.order_reference}
                      </span>
                      <span
                        className={[
                          'border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]',
                          stage.is_cancelled
                            ? 'border-ink/20 text-ink-faint line-through'
                            : stage.is_completed
                              ? 'border-crimson/40 text-crimson'
                              : 'border-ink/25 text-ink',
                        ].join(' ')}
                      >
                        {stage.label}
                      </span>
                    </div>

                    <p className="mt-1 text-[11.5px] text-ink-faint">
                      {new Date(ord.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      · {stage.description}
                    </p>

                    <ul className="mt-2.5 space-y-1 border-t border-ink/10 pt-2 text-[12.5px] text-ink-soft">
                      {ord.items.map((item, idx) => (
                        <li
                          key={`${ord.order_id}-${idx}`}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span className="truncate">
                            {item.product_name} ({item.color_name} / {item.size_name}) ×{' '}
                            {item.quantity}
                          </span>
                          <span className="shrink-0 tabular-nums text-ink">
                            {formatEGP(item.line_total)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink/12 pt-2.5">
                      <span className="text-[12.5px] font-semibold tabular-nums text-ink">
                        Total: {formatEGP(ord.total_amount)}
                      </span>
                      <Link
                        to={`/order-confirmation/${encodeURIComponent(ord.order_reference)}`}
                        state={{ email: customer.email }}
                        onClick={onNavigate}
                        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.16em] text-crimson hover:text-crimson-deep"
                      >
                        Receipt
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {/* ——— 5. Bag & Saved Pieces ——— */}
      <section
        className={mode === 'page' ? 'border-b border-ink/16 pb-8' : 'mt-5 border-b border-ink/14 pb-5'}
      >
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="tws-eyebrow text-ink-soft">Your bag</h3>
          {mode === 'panel' ? (
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                openDrawer();
              }}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-crimson underline-offset-4 hover:underline"
            >
              Open bag
            </button>
          ) : (
            <Link
              to="/cart"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-crimson underline-offset-4 hover:underline"
            >
              Open bag
            </Link>
          )}
        </div>
        <p className="mt-2.5 font-serif text-[16px] leading-snug text-ink">
          {itemCount === 0
            ? 'Your bag is empty.'
            : `${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} · ${formatEGP(subtotal)}`}
        </p>
      </section>

      <section
        className={mode === 'page' ? 'border-b border-ink/16 pb-8' : 'mt-5 border-b border-ink/14 pb-5'}
      >
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
                    onClick={onNavigate}
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

      {/* ——— 6. Order Tracking (Order Number + Email) ——— */}
      <section className={mode === 'page' ? '' : 'mt-5'} aria-label="Order tracking">
        <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
          <PackageSearch className="h-4 w-4 text-crimson" strokeWidth={2} />
          Track an order
        </h3>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          Enter your order number and the email address used at checkout to check live status.
        </p>
        <form onSubmit={runLookup} className="mt-3.5 space-y-4">
          <div>
            <label
              htmlFor={`tws-lookup-ref-${mode}`}
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
            >
              Order number (Reference)
            </label>
            <input
              id={`tws-lookup-ref-${mode}`}
              type="text"
              value={reference}
              onChange={(event) => setReference(event.target.value.toUpperCase())}
              placeholder="TWS-2026-000000"
              className="tws-field tracking-[0.08em]"
            />
          </div>
          <div>
            <label
              htmlFor={`tws-lookup-email-${mode}`}
              className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
            >
              Email on the order
            </label>
            <input
              id={`tws-lookup-email-${mode}`}
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
            {lookup.status === 'loading' ? 'Checking status…' : 'Find my order'}
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
          <OrderTrackingResult
            order={lookup.order}
            lookupEmail={lookup.email}
            onNavigate={onNavigate}
          />
        ) : null}
      </section>

      <p className="mt-7 border-t border-ink/14 pt-5 text-[11.5px] leading-relaxed text-ink-faint">
        Cash on delivery across Egypt. Create an account to track purchases and rewards, or check
        out as a guest any time.
      </p>
    </div>
  );
}
