import { Link } from 'react-router-dom';
import { ArrowRight, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { buildNavLinks, NAV_ITEMS } from '../../data/navigation';
import { Overlay } from '../ui/Overlay';

/* =========================================================
   Mobile menu — clean, minimal navigation for mobile viewports.
   ========================================================= */

export function MobileMenu() {
  const { overlay, closeOverlay, openOverlay } = useUI();
  const { itemCount, openDrawer } = useCart();
  const { settings } = useSiteSettings();
  const links = buildNavLinks(settings.nav_links);
  const items = links.length > 0 ? links : NAV_ITEMS;
  const open = overlay === 'menu';

  return (
    <Overlay
      open={open}
      onClose={closeOverlay}
      label="Menu"
      placement="right"
      panelClassName="w-full max-w-[380px]"
    >
      <div className="flex h-full flex-col overflow-y-auto pt-2">
        <p className="tws-eyebrow border-b border-black/10 pb-3 text-crimson">Navigation</p>

        <nav aria-label="Mobile navigation" className="mt-2 flex flex-col">
          {items.map((link) => (
            <Link
              key={link.to + link.label}
              to={link.to}
              onClick={closeOverlay}
              className="group flex items-center justify-between border-b border-black/8 py-4 text-base font-semibold uppercase tracking-[0.16em] text-ink transition-colors hover:text-crimson"
            >
              <span>{link.label}</span>
              <ArrowRight className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-crimson" />
            </Link>
          ))}
        </nav>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              closeOverlay();
              openOverlay('search');
            }}
            className="tws-pill tws-pill--outline h-11 w-full justify-center"
          >
            <Search className="h-4 w-4" strokeWidth={1.8} />
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              closeOverlay();
              openOverlay('account');
            }}
            className="tws-pill tws-pill--outline h-11 w-full justify-center"
          >
            <User className="h-4 w-4" strokeWidth={1.8} />
            Account
          </button>
          <button
            type="button"
            onClick={() => {
              closeOverlay();
              openDrawer();
            }}
            className="tws-pill h-12 w-full justify-center"
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
            Bag · {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
