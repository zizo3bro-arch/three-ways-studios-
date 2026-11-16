import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { buildNavLinks } from '../../data/navigation';
import { Emblem } from '../ui/Emblem';

/* =========================================================
   NAVBAR — SHOP · COLLECTIONS · ABOUT · JOURNAL with a live SHOP
   menu, plus search / account / bag. Every control opens something
   real; nothing here is decorative.
   ========================================================= */

interface NavbarProps {
  transparentOnTop?: boolean;
}

export function Navbar({ transparentOnTop = true }: NavbarProps) {
  const { itemCount, openDrawer } = useCart();
  const { overlay, toggleOverlay, closeOverlay } = useUI();
  const { settings } = useSiteSettings();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const shopRef = useRef<HTMLLIElement>(null);

  const links = buildNavLinks(settings.nav_links);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 28;
      setScrolled((prev) => (prev === next ? prev : next));
    };
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

  const solid = !transparentOnTop || scrolled;

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-[60] transition-[background-color,box-shadow,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
        solid
          ? 'border-b border-ink/12 bg-ivory/88 shadow-[0_10px_30px_-26px_rgba(22,19,15,0.5)] backdrop-blur-lg'
          : 'border-b border-transparent bg-transparent',
      ].join(' ')}
    >
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex h-[68px] w-full max-w-[1660px] items-center justify-between gap-4 px-4 sm:h-[92px] sm:px-6 lg:px-10"
      >
        {/* left — the house plate + handwritten lockup */}
        <Emblem size="sm" className="shrink-0" />

        {/* centre — editorial navigation */}
        <ul className="hidden items-center gap-6 md:flex lg:gap-9" onMouseLeave={() => setShopOpen(false)}>
          {links.map((link, index) =>
            index === 0 ? (
              <li key={link.to} ref={shopRef} className="relative" onMouseEnter={() => setShopOpen(true)}>
                <button
                  type="button"
                  aria-expanded={shopOpen}
                  aria-haspopup="true"
                  onClick={() => setShopOpen((open) => !open)}
                  className="tws-navlink"
                  data-active={location.pathname === link.to ? 'true' : undefined}
                >
                  <span>{link.label}</span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-300 ${shopOpen ? 'rotate-180' : ''}`}
                    strokeWidth={2.2}
                  />
                </button>

                <div
                  className={[
                    'absolute left-1/2 top-[calc(100%+18px)] w-[320px] -translate-x-1/2 origin-top rounded-2xl border border-ink/12 bg-paper p-4 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    shopOpen
                      ? 'pointer-events-auto translate-y-0 opacity-100'
                      : 'pointer-events-none -translate-y-1.5 opacity-0',
                  ].join(' ')}
                >
                  <p className="tws-eyebrow text-ink-faint">The drop</p>
                  <ul className="mt-3 space-y-1">
                    <li>
                      <Link
                        to="/shop"
                        onClick={() => setShopOpen(false)}
                        className="flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-ivory"
                      >
                        <span className="font-display text-[15px] uppercase tracking-[0.02em] text-ink">
                          All pieces
                        </span>
                        <span className="tws-eyebrow text-ink-faint">02</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/collections"
                        onClick={() => setShopOpen(false)}
                        className="flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-ivory"
                      >
                        <span className="font-display text-[15px] uppercase tracking-[0.02em] text-ink">
                          Collections
                        </span>
                        <span className="tws-eyebrow text-ink-faint">01</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/product/the-midnight-wide-flare"
                        onClick={() => setShopOpen(false)}
                        className="flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-ivory"
                      >
                        <span className="font-display text-[15px] uppercase tracking-[0.02em] text-ink">
                          The midnight wide-flare
                        </span>
                        <span className="tws-eyebrow text-crimson-bright">14 oz</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/product/the-onyx-super-flare"
                        onClick={() => setShopOpen(false)}
                        className="flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-ivory"
                      >
                        <span className="font-display text-[15px] uppercase tracking-[0.02em] text-ink">
                          The onyx super-flare
                        </span>
                        <span className="tws-eyebrow text-crimson-bright">13 oz</span>
                      </Link>
                    </li>
                  </ul>
                  <Link
                    to="/shop"
                    onClick={() => setShopOpen(false)}
                    className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-ink text-[10px] font-bold uppercase tracking-[0.2em] text-ivory transition-colors duration-300 hover:bg-crimson-bright"
                  >
                    Go to the shop
                  </Link>
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

        {/* right — search · account · bag */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          <button
            type="button"
            onClick={() => toggleOverlay('search')}
            aria-label="Search the house"
            aria-pressed={overlay === 'search'}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors duration-300 hover:bg-ink/6 hover:text-crimson-bright"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>

          <button
            type="button"
            onClick={() => toggleOverlay('account')}
            aria-label="Account and saved pieces"
            aria-pressed={overlay === 'account'}
            className="hidden h-10 w-10 items-center justify-center rounded-full text-ink transition-colors duration-300 hover:bg-ink/6 hover:text-crimson-bright sm:flex"
          >
            <User className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>

          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Shopping bag, ${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'}`}
            className="group flex h-10 items-center gap-1.5 rounded-full px-2 text-ink transition-colors duration-300 hover:text-crimson-bright"
          >
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.7} />
            <span className="min-w-4 text-[11px] font-bold tabular-nums tracking-tight">{itemCount}</span>
          </button>

          <button
            type="button"
            onClick={() => toggleOverlay('menu')}
            aria-label="Open menu"
            aria-expanded={overlay === 'menu'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/18 text-ink transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-ivory md:hidden"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </nav>
    </header>
  );
}
