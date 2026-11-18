import type { GalleryFrame } from './catalog';

/** Art from the supplied 2026 campaign, not a second inventory. Only shown
 * as a clearly marked read-only lookbook in builds without a store connection.
 * No variant IDs, stock, discounts or orders can originate from these plates. */
export interface CampaignPlate {
  slug: string;
  name: string;
  printedPrice: number;
  frames: GalleryFrame[];
}
const artwork: [string, string, number, string[]][] = [
  [
    'tws-signature-tee',
    'TWS Signature Tee',
    2450,
    ['signature-tee', 'signature-back', 'signature-detail', 'fabric-detail'],
  ],
  ['tws-cross-tee', 'TWS Cross Tee', 2450, ['cross-tee']],
  ['tws-wide-leg-pants', 'TWS Wide Leg Pants', 2650, ['wide-leg-pants']],
  ['tws-hoodie', 'TWS Hoodie', 2650, ['hoodie']],
];
export const campaignPlates: CampaignPlate[] = artwork.map(([slug, name, printedPrice, images]) => {
  return {
    slug,
    name,
    printedPrice,
    frames: images.map((file, i) => ({
      url: `/media/campaign/${file}.webp`,
      alt: `${name} — ${['front', 'back', 'signature detail', 'fabric detail'][i]}`,
    })),
  };
});
