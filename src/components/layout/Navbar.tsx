import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCatalog } from '../../hooks/useCatalog';
import { buildNavLinks } from '../../data/navigation';
import { formatEGP } from '../../lib/format';
import { Emblem } from '../ui/Emblem';

/* =========================================================
   NAVBAR — Simple, crisp white & deep-red navigation bar:
   Three Ways Studios logo · Shop · Collections · Search · Account · Bag.
   ========================================================= */

export function Navbar() {
  const { itemCount, openDrawer } = useCart();
  const { overlay, toggleOverlay, closeOverlay } = useUI();
  const { settings } = useSiteSettings();
  const { products } = useCatalog();
  const location = useLocation();
  const [shopOpen, setShopOpen] = useState(false);
  const shopRef = useRef<HTMLLIElement>(null);

  const links = buildNavLinks(settings.nav_links);

  useEffect(() => {
    setShopOpen(false);
    closeOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!shopOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!shopRef.current?.contains(event.target as Node)) setShopOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [shopOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-black/10 bg-white/95 backdrop-blur-md">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6 lg:px-10"
      >
        {/* Left — Three Ways Studios logo */}
        <Emblem size="sm" className="shrink-0" />

        {/* Center — Shop & Collections */}
        <ul
          className="hidden items-center gap-8 md:flex"
          onMouseLeave={() => setShopOpen(false)}
        >
          {links.map((link) =>
            link.to === '/shop' ? (
              <li
                key={link.to}
                ref={shopRef}
                className="relative"
                onMouseEnter={() => setShopOpen(true)}
              >
                <div className="flex items-center gap-1">
                  <NavLink
                    to="/shop"
                    className="tws-navlink"
                    data-active={location.pathname === '/shop' ? 'true' : undefined}
                  >
                    {link.label}
                  </NavLink>
                  <button
                    type="button"
                    aria-label="Toggle shop menu"
                    aria-expanded={shopOpen}
                    onClick={() => setShopOpen((open) => !open)}
                    className="p-0.5 text-ink transition-colors hover:text-crimson"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${shopOpen ? 'rotate-180 text-crimson' : ''}`}
                      strokeWidth={2}
                    />
                  </button>
                </div>

                {/* Clean Shop Dropdown */}
                <div
                  className={[
                    'absolute left-1/2 top-[calc(100%+18px)] w-[300px] -translate-x-1/2 origin-top rounded-lg border border-black/10 bg-white p-3 shadow-xl transition-all duration-200',
                    shopOpen
                      ? 'pointer-events-auto translate-y-0 opacity-100'
                      : 'pointer-events-none -translate-y-1 opacity-0',
                  ].join(' ')}
                >
                  <ul className="space-y-1">
                    <li>
                      <Link
                        to="/shop"
                        onClick={() => setShopOpen(false)}
                        className="flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-crimson-mist hover:text-crimson"
                      >
                        <span>All Pieces</span>
                        <span className="text-[11px] font-normal text-ink-faint">{products.length}</span>
                      </Link>
                    </li>
                    {products.slice(0, 4).map((product) => (
                      <li key={product.id}>
                        <Link
                          to={`/product/${product.slug}`}
                          onClick={() => setShopOpen(false)}
                          className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-crimson-mist hover:text-crimson"
                        >
                          <span className="truncate">{product.name}</span>
                          <span className="shrink-0 text-[11px] text-ink-faint tabular-nums">
                            {formatEGP(product.price)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ) : (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className="tws-navlink"
                  data-active={location.pathname.startsWith(link.to) ? 'true' : undefined}
                >
                  {link.label}
                </NavLink>
              </li>
            )
          )}
        </ul>

        {/* Right — Search · Account · Shopping Bag */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => toggleOverlay('search')}
            aria-label="Search products"
            aria-pressed={overlay === 'search'}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-crimson-mist hover:text-crimson"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={() => toggleOverlay('account')}
            aria-label="Account and saved items"
            aria-pressed={overlay === 'account'}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-crimson-mist hover:text-crimson"
          >
            <User className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
            className="flex h-10 items-center gap-1.5 rounded-full px-2.5 text-ink transition-colors hover:bg-crimson-mist hover:text-crimson"
          >
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span
              className={[
                'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
                itemCount > 0 ? 'bg-crimson text-white' : 'text-ink',
              ].join(' ')}
            >
              {itemCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => toggleOverlay('menu')}
            aria-label="Open menu"
            aria-expanded={overlay === 'menu'}
            className="ml-1 flex h-10 w-10 items-center justify-center rounded-full border border-black/15 text-ink transition-colors hover:border-crimson hover:text-crimson md:hidden"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </nav>
    </header>
  );
}
