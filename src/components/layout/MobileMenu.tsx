import { Link } from 'react-router-dom';
import { ArrowRight, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { buildNavLinks } from '../../data/navigation';
import { Overlay } from '../ui/Overlay';

/* =========================================================
   Mobile menu — the same public destinations as the desktop
   bar, set large on the paper. No administrative entry point.
   ========================================================= */

export function MobileMenu() {
  const { overlay, closeOverlay, openOverlay } = useUI();
  const { itemCount, openDrawer } = useCart();
  const { settings } = useSiteSettings();
  const items = buildNavLinks(settings.nav_links);
  const open = overlay === 'menu';

  return (
    <Overlay
      open={open}
      onClose={closeOverlay}
      label="Menu"
      placement="right"
      panelClassName="w-full max-w-[420px]"
    >
      <div className="flex h-full flex-col overflow-y-auto pt-2">
        <p className="tws-eyebrow border-b border-ink/16 pb-3 text-crimson">Index</p>

        <nav aria-label="Mobile navigation" className="mt-1 flex flex-col">
          {items.map((link, index) => (
            <Link
              key={link.to + link.label}
              to={link.to}
              onClick={closeOverlay}
              className="group flex items-baseline justify-between gap-4 border-b border-ink/12 py-3.5 transition-colors"
            >
              <span className="flex items-baseline gap-3">
                <span className="text-[9px] font-bold tracking-[0.2em] text-ink-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-display text-[1.75rem] uppercase leading-none tracking-[0.005em] text-ink transition-colors group-hover:text-crimson">
                  {link.label}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-1 group-hover:text-crimson" />
            </Link>
          ))}
        </nav>

        <div className="mt-7 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              closeOverlay();
              openOverlay('search');
            }}
            className="tws-pill tws-pill--outline h-12 w-full justify-center"
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
            className="tws-pill tws-pill--outline h-12 w-full justify-center"
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

        <p className="mt-auto pt-8 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
          Cairo · Fashion beyond limits
        </p>
      </div>
    </Overlay>
  );
}
