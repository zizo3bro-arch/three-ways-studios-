import type { NavLinkItem } from '../types/database';

/* =========================================================
   NAVIGATION — clean, minimal header destinations:
   Shop · Collections. Every route resolves to a real page.
   ========================================================= */

export interface NavItem {
  id: string;
  label: string;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'shop', label: 'SHOP', to: '/shop' },
  { id: 'collections', label: 'COLLECTIONS', to: '/collections' },
];

const KNOWN_PATHS = new Map<string, string>([
  ['/#products', '/shop'],
  ['/collections', '/collections'],
  ['/shop', '/shop'],
  ['/', '/'],
]);

export function resolveNavPath(path: string | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (KNOWN_PATHS.has(trimmed)) return KNOWN_PATHS.get(trimmed)!;
  if (/^\/[a-z0-9/-]+$/i.test(trimmed)) return trimmed;
  return null;
}

/** Merge admin-configured links while keeping header minimal (Shop & Collections). */
export function buildNavLinks(configured?: NavLinkItem[] | null): NavItem[] {
  if (!Array.isArray(configured) || configured.length === 0) return NAV_ITEMS;

  const allowed = new Set(['/shop', '/collections']);
  const resolved = configured
    .map((link, index) => {
      const to = resolveNavPath(link.path);
      if (!to || !allowed.has(to)) return null;
      return {
        id: `${(link.label || `link-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: (link.label || '').toUpperCase() || 'SHOP',
        to,
      } satisfies NavItem;
    })
    .filter((link): link is NavItem => link !== null);

  return resolved.length > 0 ? resolved : NAV_ITEMS;
}

export const FOOTER_LINKS: NavItem[] = [
  { id: 'shop', label: 'Shop', to: '/shop' },
  { id: 'collections', label: 'Collections', to: '/collections' },
  { id: 'fit', label: 'Size Guide', to: '/about#fit' },
  { id: 'service', label: 'Shipping & Returns', to: '/about#service' },
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
    detail: 'S — XL, true to size, cut long in the leg.',
  },
  {
    label: 'Returns',
    to: '/about#service',
    detail: '14 days from delivery, unworn, tags on.',
  },
];
