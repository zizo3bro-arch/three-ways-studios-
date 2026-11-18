import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/* =========================================================
   ADMIN LOGIN — the only door into the console.
   Nothing about the administrator is baked into this file: no
   email, no password, no list. The credentials live in Supabase
   Auth, and authorisation is the admin_users row that
   public.is_admin() reads. This form only ever sends what the
   person typed to auth.signInWithPassword().
   ========================================================= */

export function AdminLoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = (location.state as { reason?: string } | null)?.reason;

  useEffect(() => {
    document.title = 'Studio Sign In — THREE WAYS STUDIOS';
  }, []);

  useEffect(() => {
    if (reason === 'not-admin') {
      setError('That account is not registered as studio staff.');
    }
  }, [reason]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    navigate('/admin', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-14">
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center border border-ink/15">
            <img src="/assets/three-ways-studios-logo.png" alt="" className="h-7 w-7 object-contain" />
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-crimson">
              Private access
            </p>
            <p className="mt-1 text-[13px] font-medium tracking-[0.04em] text-ink">Three Ways Studios</p>
          </div>
        </div>

        <h1 className="mt-9 font-display text-[2.4rem] uppercase leading-[0.9] tracking-[0.01em] text-ink sm:text-[2.9rem]">
          Studio
          <br />
          console
        </h1>
        <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-ink-faint">
          Staff only. Inventory, orders, customers and site content are managed behind this door.
        </p>

        <form onSubmit={handleSubmit} className="mt-9 space-y-5">
          <div>
            <label
              htmlFor="admin-email"
              className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.24em] text-ink-faint"
            >
              Admin email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Staff email address"
              className="h-12 w-full border-0 border-b border-ink/20 bg-transparent px-0 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-crimson"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.24em] text-ink-faint"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••"
                className="h-12 w-full border-0 border-b border-ink/20 bg-transparent px-0 pr-10 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-crimson"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-ink-faint transition-colors hover:text-crimson"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 border-l-2 border-crimson bg-[rgba(189,26,34,0.1)] px-3.5 py-3 text-[11.5px] leading-relaxed text-crimson-deep"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2.5 bg-crimson text-[10.5px] font-bold uppercase tracking-[0.24em] text-paper transition-colors hover:bg-crimson-deep disabled:opacity-50"
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={2} />
            {submitting ? 'Authenticating…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-ink/10 pt-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.2em] text-ink-faint transition-colors hover:text-crimson"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Storefront
          </Link>
          <p className="text-right text-[9px] uppercase tracking-[0.16em] text-ink-faint">
            Authorised staff only
          </p>
        </div>
      </div>
    </div>
  );
}
