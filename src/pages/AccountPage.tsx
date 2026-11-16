import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Package, ShieldCheck, Tag, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthMode = 'login' | 'signup' | 'reset';

export function AccountPage() {
  const { user, signIn, signOut } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const localOrders = (() => {
    try {
      return JSON.parse(localStorage.getItem('tws_local_orders_v1') || '[]') as Array<{
        order_number: string;
        status: string;
        total: number;
        created_at: string;
      }>;
    } catch {
      return [];
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setErrorMsg(error);
      } else if (mode === 'signup') {
        if (!isSupabaseConfigured || !supabase) {
          setStatusMsg('Account registration is ready once Supabase is connected. Guest checkout is available now.');
        } else {
          const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: fullName.trim() } },
          });
          if (error) {
            setErrorMsg(error.message);
          } else {
            setStatusMsg('Account created. Check your email if verification is required.');
          }
        }
      } else {
        if (!isSupabaseConfigured || !supabase) {
          setStatusMsg('Password recovery is ready once Supabase is connected.');
        } else {
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
          if (error) {
            setErrorMsg(error.message);
          } else {
            setStatusMsg('Password recovery email sent. Please check your inbox.');
          }
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.24em] text-[#d4121b] uppercase">
              Member Profile
            </p>
            <h1 className="font-display-tall mt-1 text-3xl tracking-wide text-white uppercase sm:text-4xl">
              {user.user_metadata?.full_name || user.email}
            </h1>
            <p className="mt-1 text-xs text-[#9e9494]">{user.email}</p>
          </div>

          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 px-5 py-2.5 text-xs font-semibold tracking-[0.2em] text-white uppercase transition hover:border-[#b30e16] hover:bg-[#b30e16]"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-[#b30e16]/40 bg-[#12080a] p-6">
            <div className="flex items-center gap-2 text-[#d4121b]">
              <Tag className="h-4 w-4" />
              <span className="text-xs font-semibold tracking-[0.2em] uppercase">
                Welcome Privilege
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-widest text-white">WELCOME10</p>
            <p className="mt-2 text-xs text-[#b8adad]">
              10% off your first order at checkout. Single-use per customer.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0809] p-6 md:col-span-2">
            <div className="flex items-center gap-2 text-white">
              <Package className="h-4 w-4 text-[#d4121b]" />
              <h2 className="text-xs font-semibold tracking-[0.2em] uppercase">Order History</h2>
            </div>

            {localOrders.length === 0 ? (
              <div className="mt-6 text-sm text-[#9e9494]">
                No orders placed yet.{' '}
                <Link to="/collections" className="text-[#d4121b] underline">
                  Explore the 2026 Collection
                </Link>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-white/10">
                {localOrders.map((order) => (
                  <div key={order.order_number} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{order.order_number}</p>
                      <p className="text-xs text-[#9e9494]">
                        {new Date(order.created_at).toLocaleDateString()} · {order.status.toUpperCase()}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-white">{formatPrice(order.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-white/10 bg-[#0c0809] p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#b30e16]/40 bg-[#b30e16]/10 text-[#d4121b]">
            <User className="h-5 w-5" />
          </div>
          <h1 className="font-display-tall text-3xl tracking-wide text-white uppercase">
            {mode === 'login'
              ? 'Customer Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Reset Password'}
          </h1>
          <p className="mt-1 text-xs text-[#9e9494]">
            Track orders and unlock your 10% welcome privilege.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200">
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-200">
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-[#c7bcbc] uppercase">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-white/15 bg-[#120c0d] px-4 py-3 text-sm text-white placeholder-[#6e6464] focus:border-[#b30e16] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-[#c7bcbc] uppercase">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/15 bg-[#120c0d] px-4 py-3 text-sm text-white placeholder-[#6e6464] focus:border-[#b30e16] focus:outline-none"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-[#c7bcbc] uppercase">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-white/15 bg-[#120c0d] px-4 py-3 text-sm text-white placeholder-[#6e6464] focus:border-[#b30e16] focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#b30e16] py-3.5 text-xs font-bold tracking-[0.22em] text-white uppercase transition hover:bg-[#d4121b] disabled:opacity-50"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send Recovery Link'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5 text-center text-xs text-[#9e9494]">
          {mode === 'login' && (
            <>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="hover:text-white"
              >
                New to THREE WAYS STUDIOS? <span className="text-[#d4121b]">Create an account</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="hover:text-white"
              >
                Forgot password?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-[#d4121b] hover:underline"
            >
              Back to Sign In
            </button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[#7d7272]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#b30e16]" />
          <span>Guest checkout is always available without an account.</span>
        </div>
      </div>
    </main>
  );
}
