import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';

export function AdminLoginPage() {
  const { user, isAdmin, loading, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Studio Admin Login — THREE WAYS STUDIOS';
  }, []);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <main className="mx-auto flex min-h-[82vh] max-w-md flex-col justify-center px-5 pt-28 pb-20">
      <div className="border border-white/15 bg-black/55 p-7 shadow-2xl sm:p-9">
        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          <img
            src="/assets/three-ways-studios-logo.png"
            alt="THREE WAYS STUDIOS"
            className="h-11 w-auto"
          />
          <div>
            <p className="text-[10px] tracking-[0.22em] text-[#d4121b] uppercase">
              PRIVATE ACCESS
            </p>
            <h1 className="text-lg font-normal text-white">THREE WAYS STUDIOS Admin</h1>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mt-6 border border-[#b30e16]/50 bg-[#1a0709] p-4 text-xs leading-relaxed text-[#f2eded]">
            <p className="font-medium">Supabase Not Configured</p>
            <p className="mt-1.5 text-[#cfc6c6]">
              Set <code className="text-white">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-white">VITE_SUPABASE_ANON_KEY</code> in your environment
              variables, run <code className="text-white">supabase/full_setup.sql</code>, and
              register your admin user in Supabase Auth + <code className="text-white">admin_users</code>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#a99e9e] uppercase"
              >
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@threewaysstudios.com"
                className="w-full border border-white/15 bg-[#0a0607] px-3.5 py-2.5 text-xs text-white placeholder-[#685e5e] focus:border-[#b30e16] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-[10px] tracking-[0.18em] text-[#a99e9e] uppercase"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-white/15 bg-[#0a0607] px-3.5 py-2.5 text-xs text-white placeholder-[#685e5e] focus:border-[#b30e16] focus:outline-none"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 border border-[#ff6b6b]/40 bg-[#2a090c] p-3 text-xs text-[#ffb3b3]">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#b30e16] py-3 text-xs font-medium tracking-[0.2em] text-white uppercase transition-colors hover:bg-[#d4121b] disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />
              {submitting ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-white/10 pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.16em] text-[#9e9494] uppercase hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Storefront
          </Link>
        </div>
      </div>
    </main>
  );
}
