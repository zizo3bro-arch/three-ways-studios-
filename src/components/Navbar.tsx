import { useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';

export function Navbar() {
  const { itemCount, openDrawer } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const scrollToId = useCallback(
    (id: string) => {
      const jump = () => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (location.pathname !== '/') {
        navigate('/');
        window.setTimeout(jump, 260);
      } else {
        jump();
      }
    },
    [location.pathname, navigate]
  );

  const linkClass =
    'text-[9px] font-bold uppercase tracking-[0.24em] text-ink-soft transition-colors duration-200 hover:text-crimson-bright sm:text-[10px] sm:tracking-[0.28em]';

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-5">
      <nav
        aria-label="Primary navigation"
        className="pointer-events-auto flex h-14 items-center gap-4 rounded-full border border-ink/10 bg-[#f5f2eb]/78 pl-2 pr-2 shadow-[0_12px_44px_rgba(20,18,16,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl backdrop-saturate-150 sm:h-16 sm:gap-8 sm:pl-3 sm:pr-3"
      >
        {/* Brand mark */}
        <Link
          to="/"
          aria-label="THREE WAYS STUDIOS — home"
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] sm:gap-3 sm:pl-1.5 sm:pr-2"
        >
          <img
            src="/assets/three-ways-studios-logo.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 object-contain drop-shadow-[0_1px_1px_rgba(20,18,16,0.45)] sm:h-12 sm:w-12"
            width={48}
            height={48}
          />
          <span className="hidden flex-col leading-none min-[420px]:flex">
            <span className="font-display text-[12px] uppercase leading-[0.95] tracking-[0.04em] text-ink sm:text-[13px]">
              Three Ways
            </span>
            <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.52em] text-crimson sm:text-[9px]">
              Studios
            </span>
          </span>
        </Link>

        <span aria-hidden="true" className="hidden h-6 w-px bg-ink/15 sm:block" />

        {/* Section links */}
        <div className="flex items-center gap-3.5 sm:gap-6">
          <button type="button" onClick={() => scrollToId('products')} className={linkClass}>
            Products
          </button>
          <button type="button" onClick={() => scrollToId('information')} className={linkClass}>
            Information
          </button>
          <Link to="/checkout" className={linkClass}>
            Checkout
          </Link>
        </div>

        <span aria-hidden="true" className="h-6 w-px bg-ink/15" />

        {/* Bag */}
        <button
          type="button"
          onClick={openDrawer}
          aria-label={`Open shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-ink text-cream transition-transform duration-200 hover:scale-105 active:scale-95 sm:h-11 sm:w-11"
        >
          <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {itemCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson-bright px-1 text-[9px] font-bold text-cream ring-2 ring-[#f5f2eb]">
              {itemCount}
            </span>
          )}
        </button>
      </nav>
    </header>
  );
}
