import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Gift,
  Heart,
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
import { useContentBlock } from '../../context/SiteSettingsContext';
import { fetchCustomerAccountOverview, subscribeNewsletter, trackOrder } from '../../lib/api';
import { formatEGP } from '../../lib/format';
import type {
  CustomerAccountOverview,
  LoyaltyRewardType,
  TrackedOrderData,
} from '../../types/database';
import { OrderTrackingResult } from './OrderTrackingResult';
import { LoyaltyCard } from './LoyaltyCard';
import { AccountOrderCard } from './AccountOrderCard';

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; order: TrackedOrderData; email: string }
  | { status: 'missing'; message: string };

type AuthMode = 'register' | 'signin';

/** The merchant's fixed five-order ladder, used for plain-language copy. */
const LADDER: Array<{ order: number; label: string; reward: string }> = [
  { order: 1, label: 'Order 1', reward: 'Regular price' },
  { order: 2, label: 'Order 2', reward: 'Regular price' },
  { order: 3, label: 'Order 3', reward: '10% off' },
  { order: 4, label: 'Order 4', reward: '20% off' },
  { order: 5, label: 'Order 5', reward: 'One pair free' },
];

/** What the *next* order earns, given the delivered count of the open cycle. */
function unlockedFromProgress(progress: number): LoyaltyRewardType | null {
  if (progress === 2) return 'percent_10';
  if (progress === 3) return 'percent_20';
  if (progress === 4) return 'free_pants';
  return null;
}

const REWARD_COPY: Record<LoyaltyRewardType, string> = {
  percent_10: '10% off',
  percent_20: '20% off',
  free_pants: 'one pair of pants free',
};

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
  const loyaltyNote = useContentBlock(
    'account.loyalty_note',
    'Every delivered order stamps a circle. Rewards unlock on the next order.'
  );
  const noOrdersCopy = useContentBlock('account.orders_empty', 'No orders yet.');
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
  const [overviewEmpty, setOverviewEmpty] = useState(false);
  const overviewRequest = useRef(0);

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
      setOverviewEmpty(false);
      return;
    }
    const request = ++overviewRequest.current;
    setOverviewLoading(true);
    setOverviewError(null);
    const result = await fetchCustomerAccountOverview();
    // Ignore responses from a superseded request so a stale failure can never
    // overwrite a newer success.
    if (request !== overviewRequest.current) return;
    setOverviewLoading(false);
    if (result.error) {
      setOverviewError(result.error);
      setOverview(null);
      setOverviewEmpty(false);
      return;
    }
    if (result.empty || !result.overview) {
      // The request finished but produced no usable payload. Record it so the
      // UI shows a real empty state instead of an endless "loading" message.
      setOverviewEmpty(true);
      setOverview(null);
      return;
    }
    setOverviewEmpty(false);
    setOverview(result.overview);
  }, [customer]);

  useEffect(() => {
    if (!active) return;
    if (customer) {
      void loadOverview();
    } else {
      overviewRequest.current += 1;
      setOverviewLoading(false);
      setOverview(null);
      setOverviewError(null);
      setOverviewEmpty(false);
    }
  }, [active, customer, loadOverview]);

  // Loyalty progress is stamped by staff on delivery, which can happen while the
  // customer is looking at this page. Refresh on return-to-tab, on window focus
  // and on a slow poll so an open card updates without a manual reload.
  useEffect(() => {
    if (!active || !customer) return;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadOverview();
    };
    const timer = window.setInterval(refresh, 25_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, customer, loadOverview]);

  // Hard safety net: a request that never settles must not strand the section
  // on "Checking your orders…" forever.
  useEffect(() => {
    if (!customer || !overviewLoading) return;
    const timer = window.setTimeout(() => {
      if (overview || overviewEmpty || overviewError) return;
      overviewRequest.current += 1;
      setOverviewLoading(false);
      setOverviewError('We could not load your rewards just now. Please refresh to try again.');
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [customer, overviewLoading, overview, overviewEmpty, overviewError]);

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
    if (customer) await loadOverview();
    setDiscountNotice({
      ok: true,
      text: res.alreadySubscribed
        ? 'Email verified on the studio list. If unused, your 10% discount applies automatically at checkout.'
        : '10% email discount unlocked. Use this email at checkout to apply it.',
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
  const orders = overview?.orders ?? [];
  const memberSince = overview?.profile.created_at || customer?.createdAt || null;

  // Progress is the count of DELIVERED qualifying orders in the open cycle.
  // The server wraps it to 0 when the fifth delivered order closes the card and
  // starts a new cycle, so this is never a local counter.
  const progress = loyalty?.progress_in_cycle ?? 0;
  // The reward waiting for the next order. `available: false` means it is
  // already attached to an order that has not been delivered yet.
  const nextRewardType = loyalty?.next_reward?.reward_type ?? null;
  const nextRewardAvailable = loyalty?.next_reward?.available !== false;
  const unlocked = (progress >= 2 && nextRewardAvailable ? nextRewardType : null) as
    | LoyaltyRewardType
    | null;
  const effectiveUnlocked = unlocked ?? unlockedFromProgress(progress);
  const freePantsReady = effectiveUnlocked === 'free_pants';
  const ordersToNext = loyalty?.purchases_remaining ?? 5 - progress;
  const remainingCopy = freePantsReady
    ? 'Your free pair is unlocked — add pants to your next order.'
    : ordersToNext === 1
      ? `1 more delivered order unlocks ${effectiveUnlocked ? REWARD_COPY[effectiveUnlocked] : 'your next reward'}.`
      : `${ordersToNext} more delivered orders until your next reward.`;

  return (
    <div className={mode === 'page' ? 'acct-body' : 'acct-body acct-body--panel'}>
      {/* ——— Signed out: member access ——— */}
      {!customer ? (
        <section className="acct-auth" aria-label="Member access">
          <div className="acct-auth-head">
            <p className="tws-eyebrow flex items-center gap-2 text-ink-soft">
              <UserRound className="h-4 w-4 text-crimson" strokeWidth={2} />
              {authLoading ? 'Checking your account…' : 'Member access'}
            </p>
            <h2 className="acct-title">
              Sign in to see your rewards card.
            </h2>
            <p className="acct-lede">
              Five delivered orders complete a card. Order 3 takes 10% off, order 4 takes 20% off,
              and order 5 makes exactly one pair of pants free.
            </p>
          </div>

          {!authAvailable ? (
            <p className="acct-note">Account sign-in is unavailable while the studio connection is offline.</p>
          ) : (
            <div className="acct-auth-form">
              <div className="acct-switch" role="group" aria-label="Account mode">
                <button
                  type="button"
                  aria-pressed={authMode === 'register'}
                  onClick={() => {
                    setAuthMode('register');
                    setAuthFeedback(null);
                  }}
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
                >
                  Sign in
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="acct-form">
                {authMode === 'register' ? (
                  <label className="acct-field">
                    <span>Full name</span>
                    <input
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
                  </label>
                ) : null}

                <label className="acct-field">
                  <span>Account email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={accountEmail}
                    onChange={(event) => setAccountEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="tws-field"
                  />
                </label>

                <label className="acct-field">
                  <span>Password</span>
                  <span className="relative block">
                    <input
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
                  </span>
                </label>

                {authFeedback ? (
                  <p
                    role={authFeedback.ok ? 'status' : 'alert'}
                    className={[
                      'acct-feedback',
                      authFeedback.ok ? 'is-ok' : 'is-error',
                    ].join(' ')}
                  >
                    {authFeedback.text}
                  </p>
                ) : null}

                <button type="submit" disabled={authPending} className="tws-pill h-12 w-full justify-center">
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

          <ol className="acct-ladder acct-ladder--signout" aria-label="Loyalty milestones">
            {LADDER.map((step) => (
              <li key={step.order}>
                <span className="acct-ladder-num">{step.order}</span>
                <span className="acct-ladder-reward">{step.reward}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          {/* ——— 1. Account overview ——— */}
          <header className="acct-hero" data-testid="account-overview">
            <div className="min-w-0">
              <p className="tws-eyebrow text-crimson">
                {displayName ? 'Welcome back' : 'Your account'}
              </p>
              <h2 className="acct-title" data-testid="account-greeting">
                {displayName ? `Hello, ${displayName.split(' ')[0]}.` : 'Hello there.'}
              </h2>
              <p className="acct-meta">
                <span className="break-all">{customer.email}</span>
                {memberSince ? (
                  <>
                    <em>·</em>
                    <span>
                      Member since{' '}
                      {new Date(memberSince).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="acct-hero-actions">
              <Link to="/shop" onClick={onNavigate} className="tws-pill tws-pill--outline h-10">
                Shop
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {mode === 'panel' ? (
                <Link to="/account" onClick={onNavigate} className="tws-pill h-10">
                  Full account view
                </Link>
              ) : null}
            </div>
          </header>

          {authFeedback ? (
            <p
              role={authFeedback.ok ? 'status' : 'alert'}
              className={['acct-feedback', authFeedback.ok ? 'is-ok' : 'is-error'].join(' ')}
            >
              {authFeedback.text}
            </p>
          ) : null}

          {/* ——— 2. Loyalty card — the page's centrepiece ——— */}
          <section className="acct-loyalty" aria-label="Loyalty card" data-testid="loyalty-card">
            <div className="acct-loyalty-head">
              <p className="lw-hero-eyebrow">
                <Award className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={2.1} />
                Your rewards card
              </p>
              <h3 className="lw-hero-title">
                {freePantsReady
                  ? 'Your free pair is unlocked'
                  : progress === 0
                    ? 'Your card is ready'
                    : `${ordersToNext} ${ordersToNext === 1 ? 'order' : 'orders'} to your next reward`}
              </h3>
            </div>

            <LoyaltyCard
              key={customer.id}
              memberName={displayName}
              email={customer.email}
              progress={progress}
              unlocked={freePantsReady ? 'free_pants' : null}
              unlockedPercent={
                effectiveUnlocked === 'percent_10'
                  ? 10
                  : effectiveUnlocked === 'percent_20'
                    ? 20
                    : null
              }
              pending={overviewLoading && !overview}
            />

            {/* The count and the next reward, in one line each. */}
            <p className="acct-note text-center" data-testid="loyalty-how-it-works">
              {loyaltyNote}
            </p>

            <div className="acct-loyalty-readout">
              <p className="acct-progress-line" data-testid="loyalty-progress-line">
                <strong>
                  {progress}/5
                </strong>
                <span>delivered orders on this card</span>
              </p>
              <p className="acct-next-line" data-testid="loyalty-remaining-copy">
                {overviewLoading && !overview ? (
                  'Checking your orders…'
                ) : effectiveUnlocked ? (
                  <>
                    <Gift className="inline h-3.5 w-3.5 align-[-2px] text-crimson" strokeWidth={1.8} />{' '}
                    <strong>{REWARD_COPY[effectiveUnlocked]}</strong>{' '}
                    {freePantsReady ? 'is unlocked for your next order' : 'is unlocked for your next order'}
                  </>
                ) : (
                  remainingCopy
                )}
              </p>
            </div>

            {!overview && !overviewLoading ? (
              <p
                className="acct-note text-center"
                role={overviewError ? 'alert' : 'status'}
                data-testid="loyalty-card-status"
              >
                {overviewError
                  ? `${overviewError} `
                  : overviewEmpty
                    ? 'Your card is ready — delivered orders will appear here.'
                    : 'Loyalty progress is temporarily unavailable.'}
                {overviewError ? (
                  <button type="button" onClick={() => void loadOverview()} className="text-action">
                    Retry
                  </button>
                ) : null}
              </p>
            ) : null}

            {freePantsReady ? (
              <div className="lw-unlocked" data-testid="loyalty-unlocked-banner">
                <p>
                  <strong>Unlocked · never expires</strong>
                  One pair of pants is free on your next order. Orders without pants are charged
                  normally and never use it up.
                </p>
                <Link to={itemCount > 0 ? '/checkout' : '/shop'} onClick={onNavigate}>
                  {itemCount > 0 ? 'Use it at checkout' : 'Choose your pants'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : null}

            <ol className="acct-ladder" aria-label="Loyalty milestones">
              {LADDER.map((step) => {
                const done = step.order <= progress;
                const isNext = step.order === progress + 1;
                const unlockedHere =
                  isNext &&
                  effectiveUnlocked !== null &&
                  step.order ===
                    (effectiveUnlocked === 'percent_10'
                      ? 3
                      : effectiveUnlocked === 'percent_20'
                        ? 4
                        : 5);
                return (
                  <li
                    key={step.order}
                    className={done ? 'is-done' : unlockedHere ? 'is-unlocked' : isNext ? 'is-next' : ''}
                    data-testid={`loyalty-step-${step.order}`}
                    data-state={done ? 'complete' : unlockedHere ? 'unlocked' : isNext ? 'next' : 'upcoming'}
                  >
                    <span className="acct-ladder-num">
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} /> : step.order}
                    </span>
                    <span className="acct-ladder-reward">{step.reward}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ——— 3. My orders ——— */}
          <section className="acct-orders" aria-label="My orders">
            <div className="acct-section-head">
              <h3 className="tws-eyebrow text-ink-soft">My orders</h3>
              <span className="acct-count">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'} · {completedCount}{' '}
                delivered
              </span>
            </div>

            {overviewLoading && !overview ? (
              <p className="acct-note">Loading your orders…</p>
            ) : orders.length === 0 ? (
              <div className="acct-empty">
                <p>{noOrdersCopy}</p>
                <Link to="/shop" onClick={onNavigate} className="text-action">
                  Browse the collection
                </Link>
              </div>
            ) : (
              <ul className="ord-cards">
                {orders.map((order) => (
                  <AccountOrderCard
                    key={order.order_id}
                    order={order}
                    email={customer.email}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* ——— 4. Account details ——— */}
          <section className="acct-details" aria-label="Account details" data-testid="account-details-panel">
            <div className="acct-section-head">
              <h3 className="tws-eyebrow flex items-center gap-2 text-ink-soft">
                <UserRound className="h-4 w-4 text-crimson" strokeWidth={2} />
                Account details
              </h3>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="acct-signout"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
                Sign out
              </button>
            </div>

            <dl className="acct-rows">
              <div>
                <dt>Name</dt>
                <dd>{displayName || 'Not provided yet'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd className="break-all">{customer.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{overview?.profile.phone || 'Not provided yet'}</dd>
              </div>
              <div>
                <dt>Delivery city</dt>
                <dd>
                  {[overview?.profile.city, overview?.profile.governorate]
                    .filter(Boolean)
                    .join(', ') || 'Not provided yet'}
                </dd>
              </div>
            </dl>

            {/* The one-time email discount, kept as a single row. */}
            <div className="acct-email-discount">
              <div>
                <p className="acct-email-title">
                  <Percent className="inline h-3.5 w-3.5 align-[-2px] text-crimson" strokeWidth={2} />{' '}
                  10% email discount
                </p>
                <p className="acct-email-copy">
                  {discounts?.email_discount_eligible
                    ? 'Ready — applied automatically at checkout.'
                    : discounts?.email_discount_used
                      ? 'Already used on a previous order.'
                      : 'Submit your email to unlock a one-time 10% off. It does not stack with a loyalty reward.'}
                </p>
              </div>
              {discounts?.email_discount_eligible || discounts?.email_discount_used ? (
                <span className="acct-email-state">
                  {discounts?.email_discount_eligible ? 'Eligible' : 'Redeemed'}
                </span>
              ) : (
                <form onSubmit={handleEmailDiscountSubmit} className="acct-email-form">
                  <label htmlFor={`tws-discount-email-${mode}`} className="sr-only">
                    Email for 10% discount
                  </label>
                  <input
                    id={`tws-discount-email-${mode}`}
                    type="email"
                    required
                    value={customer.email}
                    readOnly
                    className="tws-field flex-1 min-w-[170px] text-[13.5px]"
                  />
                  <button type="submit" disabled={discountPending} className="tws-pill compact-pill">
                    {discountPending ? 'Applying…' : 'Unlock'}
                  </button>
                </form>
              )}
              {discountNotice ? (
                <p role={discountNotice.ok ? 'status' : 'alert'} className="acct-note">
                  {discountNotice.text}
                </p>
              ) : null}
            </div>
          </section>

          {/* ——— 5. Secondary: tracking + saved pieces (collapsed) ——— */}
          <details className="acct-more">
            <summary>
              Track an order
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="acct-more-body">
              <p className="acct-note">
                Enter your order number and the email used at checkout to check live status.
              </p>
              <form onSubmit={runLookup} className="acct-form acct-form--inline">
                <label className="acct-field">
                  <span>Order number (Reference)</span>
                  <input
                    type="text"
                    value={reference}
                    onChange={(event) => setReference(event.target.value.toUpperCase())}
                    placeholder="TWS-2026-000000"
                    className="tws-field tracking-[0.08em]"
                  />
                </label>
                <label className="acct-field">
                  <span>Email on the order</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="tws-field"
                  />
                </label>
                <button type="submit" disabled={lookup.status === 'loading'} className="tws-pill h-11">
                  {lookup.status === 'loading' ? 'Checking…' : 'Find my order'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>

              {lookup.status === 'missing' ? (
                <p role="status" className="acct-feedback is-error">
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
            </div>
          </details>

          <details className="acct-more">
            <summary>
              Saved pieces · {String(saved.length).padStart(2, '0')}
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="acct-more-body">
              {saved.length === 0 ? (
                <p className="acct-note">
                  Tap the heart on any piece to keep it here for your next order.
                </p>
              ) : (
                <ul className="acct-saved">
                  {saved.map((product) => (
                    <li key={product.id}>
                      <span className="acct-saved-photo">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={product.images[0].alt_text ?? product.name}
                            loading="lazy"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link
                          to={`/product/${product.slug}`}
                          onClick={onNavigate}
                          className="block truncate text-[14px] font-semibold text-ink hover:text-crimson"
                        >
                          {product.name}
                        </Link>
                        <span className="mt-0.5 block text-[12.5px] text-ink-faint">
                          {formatEGP(product.price)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(product.id)}
                        aria-label={`Remove ${product.name} from saved pieces`}
                        className="acct-saved-remove"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.7} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <details className="acct-more">
            <summary>
              <Heart className="h-3.5 w-3.5 text-crimson" strokeWidth={2} />
              Your bag
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="acct-more-body">
              <p className="acct-note">
                {itemCount === 0
                  ? 'Your bag is empty.'
                  : `${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} · ${formatEGP(subtotal)}`}
              </p>
              {mode === 'panel' ? (
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.();
                    openDrawer();
                  }}
                  className="text-action"
                >
                  Open bag
                </button>
              ) : (
                <Link to="/cart" className="text-action">
                  Open bag
                </Link>
              )}
            </div>
          </details>

          <p className="acct-foot">
            <PackageSearch className="inline h-3.5 w-3.5 align-[-2px] text-crimson" strokeWidth={1.8} />{' '}
            Cash on delivery across Egypt. Guest checkout is always available.
          </p>
        </>
      )}
    </div>
  );
}
