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
   NAVBAR — part of the paper, not a bar laid on top of it.
   The header starts transparent over the hero and picks up the
   ivory veil + hairline only after the page scrolls, so there is
   never a white strip chopping the campaign frame.
   Public destinations only: Shop · Collections · About · Journal.
   There is NO administrative entry point anywhere in this bar.
   ========================================================= */

export function Navbar() {
  const { itemCount, openDrawer } = useCart();
  const { overlay, toggleOverlay, closeOverlay } = useUI();
  const { settings } = useSiteSettings();
  const { products } = useCatalog();
  const location = useLocation();
  const [shopOpen, setShopOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const shopRef = useRef<HTMLLIElement>(null);

  const links = buildNavLinks(settings.nav_links);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <header
      className={[
        'fixed inset-x-0 top-0 z-[60] transition-[background-color,border-color,backdrop-filter] duration-500',
        scrolled
          ? 'border-b border-ink/12 bg-[rgba(242,238,230,0.82)] backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      ].join(' ')}
    >
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex h-16 w-full max-w-[1800px] items-center justify-between gap-4 px-4 sm:h-[76px] sm:px-6 lg:px-10"
      >
        {/* Left — the lockup */}
        <Emblem size="sm" className="shrink-0" />

        {/* Center — editorial destinations */}
        <ul
          className="hidden items-center gap-9 md:flex lg:gap-11"
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
                    className="-mr-1 p-0.5 text-ink transition-colors hover:text-crimson"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-300 ${shopOpen ? 'rotate-180 text-crimson' : ''}`}
                      strokeWidth={2}
                    />
                  </button>
                </div>

                {/* the shop index — a slip of paper, not a card */}
                <div
                  className={[
                    'absolute left-1/2 top-[calc(100%+20px)] w-[330px] -translate-x-1/2 origin-top border border-ink/14 bg-[#f4f0e8] p-2 shadow-[0_28px_60px_-34px_rgba(12,9,7,0.45)] transition-all duration-300',
                    shopOpen
                      ? 'pointer-events-auto translate-y-0 opacity-100'
                      : 'pointer-events-none -translate-y-1.5 opacity-0',
                  ].join(' ')}
                >
                  <ul>
                    <li>
                      <Link
                        to="/shop"
                        onClick={() => setShopOpen(false)}
                        className="flex items-center justify-between px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink transition-colors hover:text-crimson"
                      >
                        <span>All pieces</span>
                        <span className="text-[10px] font-medium tracking-[0.1em] text-ink-faint">
                          {String(products.length).padStart(2, '0')}
                        </span>
                      </Link>
                    </li>
                    <li aria-hidden="true" className="mx-3 h-px bg-ink/12" />
                    {products.slice(0, 4).map((product) => (
                      <li key={product.id}>
                        <Link
                          to={`/product/${product.slug}`}
                          onClick={() => setShopOpen(false)}
                          className="group flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:text-crimson"
                        >
                          <span className="min-w-0 truncate text-[12px] font-medium text-ink transition-colors group-hover:text-crimson">
                            {product.name}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-ink-faint">
                            {formatEGP(product.price)}
                          </span>
                        </Link>
                      </li>
                    ))}
                    <li aria-hidden="true" className="mx-3 h-px bg-ink/12" />
                    <li>
                      <Link
                        to="/collections"
                        onClick={() => setShopOpen(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-crimson transition-opacity hover:opacity-70"
                      >
                        The drop structure
                      </Link>
                    </li>
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

          {/* editorial destinations that are real pages, appended to the
              admin-configured Shop / Collections pair */}
          {!links.some((link) => link.to === '/about') ? (
            <li>
              <NavLink
                to="/about"
                className="tws-navlink"
                data-active={location.pathname.startsWith('/about') ? 'true' : undefined}
              >
                ABOUT
              </NavLink>
            </li>
          ) : null}
          {!links.some((link) => link.to === '/journal') ? (
            <li>
              <NavLink
                to="/journal"
                className="tws-navlink"
                data-active={location.pathname.startsWith('/journal') ? 'true' : undefined}
              >
                JOURNAL
              </NavLink>
            </li>
          ) : null}
        </ul>

        {/* Right — search · account · bag. No dashboard link. */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => toggleOverlay('search')}
            aria-label="Search pieces"
            aria-pressed={overlay === 'search'}
            className="flex h-11 w-11 items-center justify-center text-ink transition-colors hover:text-crimson"
          >
            <Search className="h-[19px] w-[19px]" strokeWidth={1.7} />
          </button>

          <button
            type="button"
            onClick={() => toggleOverlay('account')}
            aria-label="Your account, saved pieces and order tracking"
            aria-pressed={overlay === 'account'}
            className="flex h-11 w-11 items-center justify-center text-ink transition-colors hover:text-crimson"
          >
            <User className="h-[19px] w-[19px]" strokeWidth={1.7} />
          </button>

          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Shopping bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
            className="flex h-11 items-center gap-1.5 pl-1.5 pr-1 text-ink transition-colors hover:text-crimson"
          >
            <ShoppingBag className="h-[19px] w-[19px]" strokeWidth={1.7} />
            <span className="min-w-4 text-[11px] font-bold tabular-nums">{itemCount}</span>
          </button>

          <button
            type="button"
            onClick={() => toggleOverlay('menu')}
            aria-label="Open menu"
            aria-expanded={overlay === 'menu'}
            className="ml-1 flex h-11 w-11 items-center justify-center border border-ink/20 text-ink transition-colors hover:border-crimson hover:text-crimson md:hidden"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
        </div>
      </nav>
    </header>
  );
}
