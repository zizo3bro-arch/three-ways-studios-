import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { SocialLinks } from './SocialLinks';
import { Emblem } from '../ui/Emblem';

/* =========================================================
   FOOTER — the colophon.
   Sits on the same paper as everything else, separated by a
   hairline and a large handwritten sign-off. Public links only:
   there is no administrative route listed here.
   ========================================================= */

const SHOP_LINKS = [
  { label: 'All pieces', to: '/shop' },
  { label: 'Collections', to: '/collections' },
  { label: 'The journal', to: '/journal' },
];

const HOUSE_LINKS = [
  { label: 'The house', to: '/about' },
  { label: 'Sizes & fit', to: '/about#fit' },
  { label: 'Delivery & returns', to: '/about#service' },
];

export function SiteFooter() {
  const { settings } = useSiteSettings();
  const { itemCount, openDrawer } = useCart();
  const { openOverlay } = useUI();
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-ink/20">
      <div className="mx-auto w-full max-w-[1800px] px-4 pt-12 sm:px-6 sm:pt-14 lg:px-10">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          {/* the lockup + service line */}
          <div className="md:col-span-5">
            <Emblem size="sm" />
            <p className="mt-5 max-w-sm text-[12.5px] leading-relaxed text-ink-soft">
              A Cairo house cutting wide-flare denim in small runs. Cash on delivery across Egypt,
              free over EGP 3,500.
            </p>
            <div className="mt-6">
              <SocialLinks />
            </div>
          </div>

          {/* index */}
          <nav aria-label="Shop" className="md:col-span-3">
            <p className="tws-eyebrow text-ink-faint">Shop</p>
            <ul className="mt-4 space-y-2.5">
              {SHOP_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-ink transition-colors hover:text-crimson"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={openDrawer}
                  className="text-[12px] font-medium text-ink transition-colors hover:text-crimson"
                >
                  Your bag ({itemCount})
                </button>
              </li>
            </ul>
          </nav>

          <nav aria-label="The house" className="md:col-span-2">
            <p className="tws-eyebrow text-ink-faint">The house</p>
            <ul className="mt-4 space-y-2.5">
              {HOUSE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-[12px] font-medium text-ink transition-colors hover:text-crimson"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => openOverlay('account')}
                  className="text-[12px] font-medium text-ink transition-colors hover:text-crimson"
                >
                  Track an order
                </button>
              </li>
            </ul>
          </nav>

          {/* the sign-off */}
          <div className="md:col-span-2 md:text-right">
            <p className="tws-eyebrow text-ink-faint">Cairo</p>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-soft">
              Downtown atelier
              <br />
              Egypt
            </p>
            <Link to="/about#service" className="tws-link mt-5 text-ink hover:text-crimson">
              Service
            </Link>
          </div>
        </div>

        {/* the oversized sign-off */}
        <div className="mt-12 overflow-hidden border-t border-ink/14 pt-6">
          <p
            aria-hidden="true"
            className="tws-signature tws-signature-fill select-none whitespace-nowrap text-ink/85"
          >
            Three Ways Studios
            <span className="align-super text-[0.13em] tracking-normal">®</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-ink/14 py-5 text-[10px] uppercase tracking-[0.18em] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>{settings.copyright_text || `© ${year} Three Ways Studios. All rights reserved.`}</p>
          <p className="tracking-[0.2em]">Fashion beyond limits</p>
        </div>
      </div>
    </footer>
  );
}
