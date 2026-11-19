import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, Search, ShoppingBag, UserRound } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCatalog } from '../../hooks/useCatalog';
import { buildNavLinks } from '../../data/navigation';
import { Emblem } from '../ui/Emblem';

export function Navbar() {
  const { itemCount, openDrawer } = useCart();
  const { openOverlay, closeOverlay } = useUI();
  const { settings } = useSiteSettings();
  const { products } = useCatalog();
  const { pathname, hash } = useLocation();
  const [menu, setMenu] = useState(false);
  const shop = useRef<HTMLLIElement>(null);
  useEffect(() => {
    setMenu(false);
    closeOverlay();
  }, [pathname, hash, closeOverlay]);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (e: PointerEvent) => {
      if (!shop.current?.contains(e.target as Node)) setMenu(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        shop.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);
  return (
    <header className="masthead paper-surface">
      <nav className="page-width masthead-inner" aria-label="Primary navigation">
        <Emblem />
        <ul className="masthead-links">
          {buildNavLinks(settings.nav_links).map(({ label, to }) =>
            to === '/shop' ? (
              <li
                key={to}
                ref={shop}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setMenu(false);
                }}
              >
                <NavLink to={to}>{label}</NavLink>
                <button
                  className="shop-caret"
                  aria-label="Toggle shop menu"
                  aria-expanded={menu}
                  onClick={() => setMenu(!menu)}
                >
                  <ChevronDown size={14} />
                </button>
                {menu && (
                  <div className="shop-index paper-surface">
                    <Link onClick={() => setMenu(false)} to="/shop">
                      All pieces
                    </Link>
                    {products.map((p) => (
                      <Link key={p.id} to={`/product/${p.slug}`}>
                        {p.name}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ) : (
              <li key={to}>
                <NavLink to={to}>{label}</NavLink>
              </li>
            )
          )}
        </ul>
        <div className="masthead-tools">
          <button
            className="icon-action"
            aria-label="Search pieces"
            onClick={() => openOverlay('search')}
          >
            <Search />
          </button>
          <button
            className="icon-action"
            aria-label="Your customer account"
            onClick={() => openOverlay('account')}
          >
            <UserRound />
          </button>
          <button
            className="icon-action bag-action"
            aria-label={`Shopping bag, ${itemCount} items`}
            onClick={openDrawer}
          >
            <ShoppingBag />
            <span>{itemCount}</span>
          </button>
          <button className="icon-action" aria-label="Open menu" onClick={() => openOverlay('menu')}>
            <Menu />
          </button>
        </div>
      </nav>
    </header>
  );
}
