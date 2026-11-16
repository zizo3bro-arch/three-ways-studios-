import type { Product, ProductImage } from '../types/database';
import { DEMO_PRODUCTS } from './demoProducts';

/* =========================================================
   THE CATALOGUE
   Real Three Ways Studios pieces only — the two studio-shot
   garments that exist as brand assets (navy front / black back).
   Nothing here is invented: names, prices, fabric and stock all
   come from the product records (Supabase rows when configured,
   demo records as the offline fallback).
   ========================================================= */

export const SIZES = ['S', 'M', 'L', 'XL'] as const;
export type Size = (typeof SIZES)[number];

export interface PieceEditorial {
  /** chapter number used in the editorial layout */
  chapter: string;
  headlineTop: string;
  headlineBottom: string;
  scriptLine: string;
  capsLine: string;
  blurb: string;
  /** campaign imagery used for atmosphere around the piece (never sold as a product) */
  campaignImage: string;
  campaignCaption: string;
}

/**
 * Editorial framing per real product slug. Copy is written from the product
 * record's own fabric / fit data — it adds no new products, prices or variants.
 */
const PIECE_EDITORIAL: Record<string, PieceEditorial> = {
  'the-midnight-wide-flare': {
    chapter: 'Piece 01',
    headlineTop: 'MIDNIGHT',
    headlineBottom: 'WIDE-FLARE',
    scriptLine: 'cut to stack, made to move',
    capsLine: 'RAW SELVEDGE · 14 OZ · WIDE-FLARE',
    blurb:
      'A sculpted high rise, a clean thigh, and a leg that opens from the knee into an architectural wide-flare. Midnight raw selvedge that fades to your own map.',
    campaignImage: '/media/campaign-01.jpg',
    campaignCaption: 'Campaign 01 — The Midnight Wide-Flare, shot in Cairo',
  },
  'the-onyx-super-flare': {
    chapter: 'Piece 02',
    headlineTop: 'ONYX',
    headlineBottom: 'SUPER-FLARE',
    scriptLine: 'gravity, worn as a silhouette',
    capsLine: 'ONYX BLACK · 13 OZ · SUPER-FLARE',
    blurb:
      'The closing look. Matte onyx denim, a sculptural rise and an exaggerated super-flare that sweeps the floor — silent, heavy, monumental.',
    campaignImage: '/media/campaign-02.jpg',
    campaignCaption: 'Campaign 02 — The Onyx Super-Flare, hem detail',
  },
};

const FALLBACK_EDITORIAL: PieceEditorial = {
  chapter: 'Piece',
  headlineTop: 'THREE WAYS',
  headlineBottom: 'STUDIOS',
  scriptLine: 'fashion beyond limits',
  capsLine: 'HAND-CUT IN CAIRO',
  blurb: 'An architectural silhouette from the Cairo atelier.',
  campaignImage: '/media/campaign-01.jpg',
  campaignCaption: 'Campaign 01 — Three Ways Studios, shot in Cairo',
};

export function editorialFor(product: Product | undefined | null): PieceEditorial {
  if (!product) return FALLBACK_EDITORIAL;
  return PIECE_EDITORIAL[product.slug] ?? {
    ...FALLBACK_EDITORIAL,
    headlineTop: product.name.replace(/^The\s+/i, '').split(' ')[0] ?? product.name,
    headlineBottom: product.name.split(' ').slice(1).join('-').toUpperCase() || 'STUDIOS',
    blurb: product.description,
    capsLine: (product.fabric_info || FALLBACK_EDITORIAL.capsLine).toUpperCase(),
  };
}

/** Sorted, de-duplicated studio images — always the real photography. */
export function imagesOf(product: Product | undefined | null): ProductImage[] {
  const images = (product?.images ?? []).filter((image) => Boolean(image?.url));
  if (images.length === 0) return [];
  const seen = new Set<string>();
  return [...images]
    .sort((a, b) => a.display_order - b.display_order)
    .filter((image) => {
      if (seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
}

export function primaryImage(product: Product | undefined | null): ProductImage | undefined {
  const images = imagesOf(product);
  return images.find((image) => image.is_primary) ?? images[0];
}

export interface SizeOption {
  size: string;
  stock: number;
  soldOut: boolean;
  variantId: string | null;
  sku: string | null;
}

/** Size availability read straight off the variant rows. */
export function sizeOptionsFor(product: Product | undefined | null): SizeOption[] {
  const variants = product?.variants ?? [];
  const order = variants.length > 0 ? variants.map((variant) => variant.size_name) : [...SIZES];
  const unique = Array.from(new Set(order));

  return unique.map((size) => {
    const variant = variants.find((candidate) => candidate.size_name === size);
    const stock = variant?.stock_quantity ?? 0;
    return {
      size,
      stock,
      soldOut: variants.length > 0 ? stock <= 0 : false,
      variantId: variant?.id ?? null,
      sku: variant?.sku ?? null,
    };
  });
}

export function firstAvailableSize(product: Product | undefined | null): Size {
  const options = sizeOptionsFor(product);
  const available = options.find((option) => !option.soldOut);
  return (available?.size as Size) ?? 'M';
}

/** Colour name is shown as text; the swatch itself is a fixed white square. */
export function colourNameFor(product: Product | undefined | null): string {
  const variant = product?.variants?.[0];
  return variant?.color_name ?? primaryImage(product)?.color_name ?? 'Studio Black';
}

export function findProductBySlug(products: Product[], slug: string | undefined): Product | undefined {
  if (!slug) return undefined;
  const pool = products.length > 0 ? products : (DEMO_PRODUCTS as Product[]);
  return pool.find((product) => product.slug === slug);
}

export function relatedProducts(products: Product[], slug: string, limit = 2): Product[] {
  const pool = products.length > 0 ? products : (DEMO_PRODUCTS as Product[]);
  const others = pool.filter((product) => product.slug !== slug);
  return others.slice(0, limit);
}

/** Aspect ratio of the real studio photography (522 × 1223) — keeps every plate aligned. */
export const PLATE_ASPECT = '522 / 1223';
