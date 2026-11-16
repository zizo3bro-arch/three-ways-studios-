import { Link } from 'react-router-dom';
import { ArrowUpRight, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { buildNavLinks, NAV_ITEMS } from '../../data/navigation';
import { Overlay } from '../ui/Overlay';
import { SocialLinks } from './SocialLinks';

/* =========================================================
   Mobile menu — the same four destinations as desktop, set large,
   plus the utilities (search / account / bag) that collapse on
   small screens.
   ========================================================= */

export function MobileMenu() {
  const { overlay, closeOverlay, openOverlay } = useUI();
  const { itemCount, openDrawer } = useCart();
  const { settings } = useSiteSettings();
  const links = buildNavLinks(settings.nav_links);
  const items = links.length > 0 ? links : NAV_ITEMS;
  const open = overlay === 'menu';

  return (
    <Overlay open={open} onClose={closeOverlay} label="Menu" placement="right" panelClassName="w-full max-w-[420px]">
      <div className="-mx-5 flex h-full flex-col overflow-y-auto px-5 pb-6 pt-1 sm:-mx-7 sm:px-7">
        <div className="flex items-center justify-between gap-3 border-b border-ink/12 pb-4">
          <p className="tws-eyebrow text-ink-faint">Menu</p>
        </div>

        <nav aria-label="Mobile navigation" className="mt-6 flex flex-col">
          {items.map((link, index) => (
            <Link
              key={link.to + link.label}
              to={link.to}
              onClick={closeOverlay}
              className="group flex items-baseline justify-between gap-4 border-b border-ink/10 py-4"
            >
              <span className="tws-menu-link text-[clamp(2.1rem,10vw,2.9rem)] text-ink transition-colors duration-300 group-hover:text-crimson-bright">
                {link.label}
              </span>
              <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.24em] text-ink-faint">
                0{index + 1}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-7 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              closeOverlay();
              openOverlay('search');
            }}
            className="tws-pill tws-pill--outline h-12 justify-center"
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
            className="tws-pill tws-pill--outline h-12 justify-center"
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
            className="tws-pill col-span-2 h-13 justify-center"
          >
            <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
            Bag · {itemCount} {itemCount === 1 ? 'piece' : 'pieces'}
          </button>
        </div>

        <div className="mt-8 border-t border-ink/12 pt-5">
          <p className="tws-eyebrow text-ink-faint">The house</p>
          <p className="mt-2.5 font-serif text-[15px] italic leading-relaxed text-ink-soft">
            {settings.footer_tagline || 'Fashion beyond limits — hand-cut in Cairo, two silhouettes a season.'}
          </p>
          <div className="mt-4">
            <SocialLinks />
          </div>
        </div>
      </div>
    </Overlay>
  );
}
