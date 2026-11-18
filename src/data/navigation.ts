import type { NavLinkItem } from '../types/database';

const destinations = ['Shop', 'Collections', 'About', 'Journal'] as const;
/** An allowlist, not a general-purpose settings URL renderer. */
export function buildNavLinks(configured?: NavLinkItem[] | null) {
  return destinations.map((name) => {
    const to = `/${name.toLowerCase()}`;
    const custom = Array.isArray(configured) ? configured.find((link) => link?.path === to) : undefined;
    return { to, label: custom?.label || name };
  });
}
