import { Link } from 'react-router-dom';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { SocialLinks } from './SocialLinks';

/* =========================================================
   FOOTER — minimal, clean, white & red luxury footer.
   ========================================================= */

export function SiteFooter() {
  const { settings } = useSiteSettings();
  const { itemCount, openDrawer } = useCart();
  const { openOverlay } = useUI();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/10 bg-[#FAFAF8]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <Link
              to="/"
              className="text-xs font-bold uppercase tracking-[0.2em] text-ink transition-colors hover:text-crimson"
            >
              Three Ways Studios
            </Link>
            <p className="mt-1.5 text-xs text-ink-soft">
              Cash on delivery across Egypt · Free shipping over EGP 3,500.
            </p>
          </div>

          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              to="/shop"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-crimson"
            >
              Shop
            </Link>
            <Link
              to="/collections"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-crimson"
            >
              Collections
            </Link>
            <Link
              to="/about#fit"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-crimson"
            >
              Size Guide
            </Link>
            <Link
              to="/about#service"
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-crimson"
            >
              Shipping &amp; Returns
            </Link>
            <button
              type="button"
              onClick={() => openOverlay('account')}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-crimson"
            >
              Track Order
            </button>
            <button
              type="button"
              onClick={openDrawer}
              className="text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:text-crimson"
            >
              Bag ({itemCount})
            </button>
          </nav>

          <SocialLinks />
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-black/8 pt-5 text-[11px] text-ink-faint sm:flex-row sm:items-center">
          <p>{settings.copyright_text || `© ${year} Three Ways Studios. All rights reserved.`}</p>
          <Link to="/admin/login" className="transition-colors hover:text-crimson">
            Studio Access
          </Link>
        </div>
      </div>
    </footer>
  );
}
