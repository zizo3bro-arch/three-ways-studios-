import type { NavLinkItem } from '../types/database';

/* =========================================================
   NAVIGATION — every entry maps to a route that exists.
   Admin can re-label / re-point them through site_settings.nav_links;
   anything that does not resolve to a real route falls back to the
   default below, so a bad setting can never produce a dead link.
   ========================================================= */

export interface NavItem {
  id: string;
  label: string;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'shop', label: 'SHOP', to: '/shop' },
  { id: 'collections', label: 'COLLECTIONS', to: '/collections' },
  { id: 'about', label: 'ABOUT', to: '/about' },
  { id: 'journal', label: 'JOURNAL', to: '/journal' },
];

const KNOWN_PATHS = new Map<string, string>([
  ['/#products', '/shop'],
  ['/collections', '/collections'],
  ['/about', '/about'],
  ['/journal', '/journal'],
  ['/shop', '/shop'],
  ['/', '/'],
]);

export function resolveNavPath(path: string | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (KNOWN_PATHS.has(trimmed)) return KNOWN_PATHS.get(trimmed)!;
  // allow real in-app routes configured by the studio
  if (/^\/[a-z0-9/-]+$/i.test(trimmed)) return trimmed;
  return null;
}

/** Merge admin-configured links over the defaults, dropping dead ones. */
export function buildNavLinks(configured?: NavLinkItem[] | null): NavItem[] {
  if (!Array.isArray(configured) || configured.length === 0) return NAV_ITEMS;

  const resolved = configured
    .map((link, index) => {
      const to = resolveNavPath(link.path);
      if (!to) return null;
      return {
        id: `${(link.label || `link-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: (link.label || '').toUpperCase() || 'SHOP',
        to,
      } satisfies NavItem;
    })
    .filter((link): link is NavItem => link !== null);

  return resolved.length >= 2 ? resolved.slice(0, 5) : NAV_ITEMS;
}

export const FOOTER_LINKS: NavItem[] = [
  { id: 'shop', label: 'All pieces', to: '/shop' },
  { id: 'collections', label: 'Collections', to: '/collections' },
  { id: 'about', label: 'The house', to: '/about' },
  { id: 'journal', label: 'Journal', to: '/journal' },
  { id: 'checkout', label: 'Checkout', to: '/checkout' },
];

export const SERVICE_LINKS: Array<{ label: string; to: string; detail: string }> = [
  {
    label: 'Cash on delivery',
    to: '/about#service',
    detail: 'Pay the courier in cash on arrival, Egypt-wide. Free over EGP 3,500.',
  },
  {
    label: 'Sizes & fit',
    to: '/about#fit',
    detail: 'S — XL, true to size, cut long in the leg. Find your size in the atelier tool.',
  },
  {
    label: 'Returns',
    to: '/about#service',
    detail: '14 days from delivery, unworn, tags on. We cover the pickup in Greater Cairo.',
  },
];
