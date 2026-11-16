/* =========================================================
   THE JOURNAL — house writing (essays, not products).
   Nothing here is offered for sale; no invented garments,
   prices or catalogue entries.
   ========================================================= */

export interface JournalEntry {
  slug: string;
  kicker: string;
  title: string;
  dek: string;
  date: string;
  readingTime: string;
  image: string;
  imageAlt: string;
  body: string[];
  pullQuote: string;
}

export const JOURNAL_ENTRIES: JournalEntry[] = [
  {
    slug: 'against-the-skinny',
    kicker: 'Essay 01 — The Cut',
    title: 'AGAINST\nTHE SKINNY',
    dek: 'Why the house spends its entire energy on one leg shape, and why that shape keeps widening.',
    date: '2026-02-14',
    readingTime: '4 min',
    image: '/media/campaign-01.jpg',
    imageAlt: 'Model wearing the Midnight Wide-Flare, framed from the waist down in the studio',
    body: [
      'A house is defined by what it refuses. Three Ways Studios refuses the tight leg. Not because it is unfashionable, but because it is unfinished — a trouser that follows the anatomy instead of arguing with it.',
      'The flare we cut begins at the knee and never apologises. It is drafted on the body, then opened on the floor: twelve millimetres of extra swing at each side of the hem, which is exactly the amount the fabric needs to fall straight when a person walks rather than stands.',
      'Everything else in the garment exists to serve that line. A high rise to lengthen the torso. A clean thigh with no whiskering of fabric. Bar-tacks at the pocket corners so the flare does not pull the seams out of true after a season of wear.',
      'We release two silhouettes a season, and we will keep releasing two until there is a third that earns its place. A small catalogue is not a limitation. It is the only honest way to make a pair of pants.',
    ],
    pullQuote: 'A trouser should argue with the anatomy, never obey it.',
  },
  {
    slug: 'selvedge-by-the-metre',
    kicker: 'Essay 02 — The Cloth',
    title: 'SELVEDGE,\nBY THE METRE',
    dek: 'Notes from the buying trip: indigo rope-dye, shuttle looms, and the orange line that tells you the cloth was made slowly.',
    date: '2026-01-22',
    readingTime: '5 min',
    image: '/media/atelier.jpg',
    imageAlt: 'Atelier worktable with raw selvedge denim, tailor\u2019s chalk, scissors and paper patterns',
    body: [
      'Selvedge is not a luxury signifier, it is a manufacturing accident. Narrow shuttle looms cannot cut a clean edge, so the weaver turns the weft back on itself and a self-finished border appears. The loom is slower. The cloth is denser. The edge is the proof.',
      'We buy the cloth by the metre and we buy it in small runs, which means the factory will not customise the indigo for us. We get the standard rope-dye: a deep navy wrap around a white core, destined to wear through at the thigh and the hem within a year of real wear.',
      'That wear is the point. A pair of wide-flares will be creased at the knee, abraded at the hem where it meets the floor, and faded along the fly in a honeycomb. Six months in, the garment belongs to its owner and not to us.',
      'The 14 oz midnight lot runs stiff enough to hold the flare open at first wear, and soft enough to collapse over a boot by the tenth. Anything lighter fails the silhouette. Anything heavier fails the summer.',
    ],
    pullQuote: 'The edge is the proof that the cloth was made slowly.',
  },
  {
    slug: 'cairo-4am',
    kicker: 'Essay 03 — The House',
    title: 'CAIRO,\n4 AM',
    dek: 'The atelier works nights through a drop. What we learned from the fitting log of the first twenty pairs.',
    date: '2025-12-08',
    readingTime: '3 min',
    image: '/media/campaign-02.jpg',
    imageAlt: 'The Onyx Super-Flare hem sweeping the studio floor over a black boot',
    body: [
      'The first twenty pairs left the atelier at four in the morning, because daytime is for fittings and the machines are only free when the street is quiet. That schedule became the house rhythm: cut at night, fit in the afternoon, one correction per drop.',
      'The fitting log from Drop 01 is three pages long. The hem rose by 2.5 cm once we stopped letting the flare touch the ground on a size S. The back yoke was narrowed by 6 mm after two testers reported the super-flare reading as a skirt from behind.',
      'We do not run a lookbook shoot until the log is closed. If the pattern is still moving, the photography would only be a promise we have not kept yet.',
      'Everything we sell is worn by someone in the building for a fortnight before it is offered to you.',
    ],
    pullQuote: 'If the pattern is still moving, the photograph is only a promise.',
  },
];

export function journalEntryBySlug(slug: string | undefined): JournalEntry | undefined {
  if (!slug) return undefined;
  return JOURNAL_ENTRIES.find((entry) => entry.slug === slug);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}
