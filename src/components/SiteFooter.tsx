import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

export function SiteFooter() {
  const location = useLocation();
  const navigate = useNavigate();

  const scrollToId = useCallback(
    (id: string) => {
      const jump = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      if (location.pathname !== '/') {
        navigate('/');
        window.setTimeout(jump, 260);
      } else {
        jump();
      }
    },
    [location.pathname, navigate]
  );

  return (
    <footer className="border-t border-ink/12 bg-cream text-ink">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:gap-8">
          {/* Mini brand */}
          <Link to="/" aria-label="THREE WAYS STUDIOS — home" className="flex items-center gap-3">
            <img
              src="/assets/three-ways-studios-logo.png"
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              className="h-10 w-10 object-contain drop-shadow-[0_1px_1px_rgba(20,18,16,0.4)]"
            />
            <span className="leading-none">
              <span className="block font-display text-xs uppercase tracking-[0.05em] text-ink">
                Three Ways Studios
              </span>
              <span className="mt-1 block font-script text-sm text-crimson">
                fashion beyond limits
              </span>
            </span>
          </Link>

          {/* Nav */}
          <nav aria-label="Footer navigation" className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => scrollToId('products')}
              className="text-[9px] font-bold uppercase tracking-[0.26em] text-ink-soft transition-colors hover:text-crimson-bright"
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => scrollToId('information')}
              className="text-[9px] font-bold uppercase tracking-[0.26em] text-ink-soft transition-colors hover:text-crimson-bright"
            >
              Information
            </button>
            <Link
              to="/checkout"
              className="text-[9px] font-bold uppercase tracking-[0.26em] text-ink-soft transition-colors hover:text-crimson-bright"
            >
              Checkout
            </Link>
          </nav>

          <p className="text-[8px] font-semibold uppercase tracking-[0.3em] text-ink-faint">
            Est. MMXXVI — Cairo
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-ink/10 pt-6 text-[9px] uppercase tracking-[0.22em] text-ink-faint sm:flex-row">
          <p>© {new Date().getFullYear()} Three Ways Studios. All rights reserved.</p>
          <p>COD Nationwide · Raw Selvedge · Drop 01 / 2026</p>
        </div>
      </div>
    </footer>
  );
}
