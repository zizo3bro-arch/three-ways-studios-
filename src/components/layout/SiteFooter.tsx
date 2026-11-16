import { Link } from 'react-router-dom';
import { FOOTER_LINKS, SERVICE_LINKS, resolveNavPath } from '../../data/navigation';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { SocialLinks } from './SocialLinks';
import { SprayType } from '../ui/SprayType';

/* =========================================================
   FOOTER — every link resolves. Services link to the real
   sections of /about, the shop links to real routes, and the
   bag button opens the real drawer.
   ========================================================= */

export function SiteFooter() {
  const { settings } = useSiteSettings();
  const { itemCount, openDrawer } = useCart();
  const { openOverlay } = useUI();
  const year = new Date().getFullYear();
  const footerLinks = (settings.footer_links?.length
    ? settings.footer_links
        .map((link) => {
          const to = resolveNavPath(link.path);
          return to ? { id: `${link.label}-${to}`, label: link.label, to } : null;
        })
        .filter((link): link is { id: string; label: string; to: string } => link !== null)
    : FOOTER_LINKS
  ).slice(0, 6);

  return (
    <footer className="relative isolate overflow-hidden border-t border-ink/12 bg-ivory">
      {/* the house name once more, sprayed and bleeding out of the bottom edge */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-[3.5vw] left-0 z-0 opacity-[0.5]">
        <SprayType text="THREE WAYS STUDIOS" className="[font-size:clamp(1.9rem,10.4vw,9rem)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1660px] px-4 pb-8 pt-14 sm:px-6 sm:pt-16 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="tws-signature tws-signature--ink text-[2.15rem] leading-none sm:text-[2.6rem]">
              Three Ways Studios
            </p>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-ink-soft">
              {settings.footer_tagline ||
                'A Cairo house cutting wide-flare denim in small runs. Fashion beyond limits — one silhouette at a time.'}
            </p>
            <div className="mt-5">
              <SocialLinks />
            </div>
          </div>

          <nav aria-label="Footer navigation" className="lg:col-span-3">
            <p className="tws-eyebrow text-ink-faint">Navigate</p>
            <ul className="mt-3.5 space-y-2">
              {footerLinks.map((link) => (
                <li key={link.to + link.label}>
                  <Link
                    to={link.to}
                    className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors duration-200 hover:text-crimson-bright"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={openDrawer}
                  className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors duration-200 hover:text-crimson-bright"
                >
                  Your bag · {itemCount}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openOverlay('search')}
                  className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors duration-200 hover:text-crimson-bright"
                >
                  Search
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openOverlay('account')}
                  className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors duration-200 hover:text-crimson-bright"
                >
                  Account &amp; orders
                </button>
              </li>
            </ul>
          </nav>

          <div className="lg:col-span-4">
            <p className="tws-eyebrow text-ink-faint">Service</p>
            <dl className="mt-3.5 space-y-3">
              {SERVICE_LINKS.map((service) => (
                <div key={service.label} className="border-b border-ink/10 pb-3">
                  <dt>
                    <Link
                      to={service.to}
                      className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:text-crimson-bright"
                    >
                      {service.label}
                    </Link>
                  </dt>
                  <dd className="mt-1 text-[12px] leading-relaxed text-ink-soft">{service.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-ink/12 pt-5 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint sm:flex-row sm:items-center">
          <p>{settings.copyright_text || `© ${year} Three Ways Studios. All rights reserved.`}</p>
          <p className="flex items-center gap-3">
            <span>Cairo — Worldwide</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-crimson-bright" />
            <span>Cash on delivery in Egypt</span>
          </p>
          <Link to="/admin/login" className="transition-colors hover:text-crimson-bright">
            Studio access
          </Link>
        </div>
      </div>
    </footer>
  );
}
