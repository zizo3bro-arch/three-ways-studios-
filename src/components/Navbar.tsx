import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../context/CartContext';

export function Navbar() {
  const { itemCount, openDrawer } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 36;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToId = useCallback(
    (id: string) => {
      if (location.pathname !== '/') {
        navigate(`/#${id}`);
        return;
      }
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [location.pathname, navigate]
  );

  const linkClass =
    'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink transition-colors duration-200 hover:text-crimson-bright sm:text-[11px] sm:tracking-[0.16em]';

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        scrolled
          ? 'border-b border-ink/10 bg-[#e6e3dc]/86 backdrop-blur-md'
          : 'bg-transparent',
      ].join(' ')}
    >
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex h-20 w-full max-w-[1640px] items-center justify-between px-4 sm:h-24 sm:px-8 lg:px-12"
      >
        {/* Left: Emblem + handwritten script brand mark */}
        <Link
          to="/"
          aria-label="Three Ways Studios — home"
          className="group flex items-center gap-2 sm:gap-3"
        >
          <img
            src="/assets/three-ways-studios-logo.png"
            alt=""
            aria-hidden="true"
            width={58}
            height={66}
            className="h-12 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.03] sm:h-15"
          />
          <span className="relative -mt-0.5 hidden select-none min-[380px]:inline-block">
            <span className="block -rotate-2 font-script text-[1.65rem] leading-none tracking-normal text-ink sm:text-[2.15rem]">
              Three Ways Studios
              <sup className="ml-0.5 align-super font-sans text-[7px] font-bold tracking-normal">
                ®
              </sup>
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-0.5 right-0 h-[1.5px] w-[42%] -rotate-3 rounded-full bg-ink/85"
            />
          </span>
        </Link>

        {/* Center: Editorial navigation links */}
        <div className="flex items-center gap-4 sm:gap-8 lg:gap-10">
          <button
            type="button"
            onClick={() => scrollToId('products')}
            className={linkClass}
          >
            <span>Products</span>
            <ChevronDown className="h-3 w-3 opacity-80" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => scrollToId('collection-strip')}
            className={`${linkClass} hidden md:inline-flex`}
          >
            Collections
          </button>
          <button
            type="button"
            onClick={() => scrollToId('information')}
            className={linkClass}
          >
            About
          </button>
          <Link to="/checkout" className={linkClass}>
            Checkout
          </Link>
        </div>

        {/* Right: Search, Account/Studio List, Bag + counter */}
        <div className="flex items-center gap-3.5 sm:gap-5">
          <button
            type="button"
            onClick={() => scrollToId('products')}
            aria-label="Explore products"
            className="hidden text-ink transition-colors duration-200 hover:text-crimson-bright sm:inline-flex"
          >
            <Search className="h-[19px] w-[19px]" strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={() => scrollToId('information')}
            aria-label="Join the Studio List"
            className="hidden text-ink transition-colors duration-200 hover:text-crimson-bright sm:inline-flex"
          >
            <User className="h-[19px] w-[19px]" strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Open shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
            className="inline-flex items-center gap-1.5 text-ink transition-colors duration-200 hover:text-crimson-bright"
          >
            <ShoppingBag className="h-[19px] w-[19px]" strokeWidth={1.7} />
            <span className="text-[11px] font-bold tabular-nums tracking-tight text-ink">
              {itemCount}
            </span>
          </button>
        </div>
      </nav>
    </header>
  );
}
