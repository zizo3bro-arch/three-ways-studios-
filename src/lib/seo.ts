/* =========================================================
   seo — one document head, kept in sync with the router.

   A client-rendered SPA has a single index.html, so without this the
   browser tab, the social preview and the canonical URL would all keep
   describing the home page no matter where the visitor actually is.
   That matters here because the storefront is shared as links more than
   it is arrived at from the front page.

   Rules:
   • admin routes are never indexed and never advertised
   • product pages own their title (they set it from live data)
   • description is rewritten per section, not stuffed with keywords
   ========================================================= */

const SITE = 'https://three-ways-studios.vercel.app';
const BRAND = 'THREE WAYS STUDIOS';

interface Meta {
  title: string;
  description: string;
  /** path used for the canonical url, or null to omit it */
  canonical: string | null;
  noindex?: boolean;
}

const DEFAULT: Meta = {
  title: `${BRAND} — Fashion Beyond Limits | Wide-Flare & Super-Flare Denim`,
  description:
    'Wide-flare and super-flare denim cut in Cairo. Small runs, selvedge cloth, cash on delivery across Egypt. Fashion beyond limits.',
  canonical: '/',
};

const RULES: Array<[RegExp, (path: string) => Meta]> = [
  [
    /^\/$/,
    () => DEFAULT,
  ],
  [
    /^\/shop/,
    () => ({
      title: `The Shop — ${BRAND}`,
      description:
        'Every piece in the current run: wide-flare and super-flare denim in selvedge and washed cotton, cut in Cairo and finished by hand.',
      canonical: '/shop',
    }),
  ],
  [
    /^\/product\/[^/]+/,
    () => ({
      title: `Product — ${BRAND}`,
      description:
        'A single piece from the current run: cloth, cut, sizing and stock. Cut in Cairo, delivered by courier.',
      canonical: null,
    }),
  ],
  [
    /^\/collections\/[^/]+/,
    () => ({
      title: `Collection — ${BRAND}`,
      description:
        'A single chapter of the house: the cloth, the cut and the pieces that carry it. Photographed in the studio, released in small numbers.',
      canonical: null,
    }),
  ],
  [
    /^\/collections/,
    () => ({
      title: `Collections — ${BRAND}`,
      description:
        'The archive of Three Ways Studios releases, from the first wide-flare study to the current season, each with its own cloth and silhouette.',
      canonical: '/collections',
    }),
  ],
  [
    /^\/about/,
    () => ({
      title: `The House — ${BRAND}`,
      description:
        'A Cairo atelier working in denim. How the house started, how the pieces are cut, and the fit and service promises behind every order.',
      canonical: '/about',
    }),
  ],
  [
    /^\/journal\/[^/]+/,
    () => ({
      title: `Journal — ${BRAND}`,
      description:
        'Notes from the studio: cloth, cut and the city the pieces are made in.',
      canonical: null,
    }),
  ],
  [
    /^\/journal/,
    () => ({
      title: `The Journal — ${BRAND}`,
      description:
        'Notes from the atelier on cloth, cut and Cairo — the long-form companion to each Three Ways Studios release.',
      canonical: '/journal',
    }),
  ],
  [
    /^\/checkout/,
    () => ({
      title: `Checkout (Cash on Delivery) — ${BRAND}`,
      description: 'Complete your order. Pay the courier when the parcel arrives.',
      canonical: null,
      noindex: true,
    }),
  ],
  [
    /^\/order-confirmation/,
    () => ({
      title: `Order confirmed — ${BRAND}`,
      description: 'Your order reference and delivery details.',
      canonical: null,
      noindex: true,
    }),
  ],
  [
    /^\/admin/,
    () => ({
      title: `Studio Console — ${BRAND}`,
      description: '',
      canonical: null,
      noindex: true,
    }),
  ],
];

export function metaForPath(pathname: string): Meta {
  for (const [pattern, build] of RULES) {
    if (pattern.test(pathname)) return build(pathname);
  }
  return {
    title: `Not found — ${BRAND}`,
    description: 'That page is not part of the current run.',
    canonical: null,
    noindex: true,
  };
}

/** Write a tag, creating it once if the static shell does not already have it. */
function setTag(
  selector: string,
  attrs: Record<string, string>,
  create: () => HTMLElement,
) {
  let node = document.head.querySelector<HTMLElement>(selector);
  if (!node) {
    node = create();
    document.head.appendChild(node);
  }
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
}

function setMetaName(name: string, content: string) {
  setTag(`meta[name="${name}"]`, { name, content }, () => {
    const el = document.createElement('meta');
    el.setAttribute('name', name);
    return el;
  });
}

function setMetaProperty(property: string, content: string) {
  setTag(`meta[property="${property}"]`, { property, content }, () => {
    const el = document.createElement('meta');
    el.setAttribute('property', property);
    return el;
  });
}

/**
 * Apply the head for a route. `override` lets a page (a product, say) supply
 * a title and description derived from real content once it has loaded.
 */
export function applyMeta(pathname: string, override?: Partial<Meta>) {
  const meta = { ...metaForPath(pathname), ...override };

  document.title = meta.title;

  if (meta.description) {
    setMetaName('description', meta.description);
    setMetaProperty('og:description', meta.description);
    setMetaName('twitter:description', meta.description);
  }

  setMetaProperty('og:title', meta.title);
  setMetaName('twitter:title', meta.title);

  const url = meta.canonical ? `${SITE}${meta.canonical}` : `${SITE}${pathname}`;
  setMetaProperty('og:url', url);

  // robots: admin, checkout and unknown routes stay out of the index
  const robots = meta.noindex ? 'noindex, nofollow' : 'index, follow';
  setMetaName('robots', robots);

  const link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (meta.canonical) {
    const node = link ?? document.createElement('link');
    node.rel = 'canonical';
    node.href = url;
    if (!link) document.head.appendChild(node);
  } else if (link) {
    link.remove();
  }
}
