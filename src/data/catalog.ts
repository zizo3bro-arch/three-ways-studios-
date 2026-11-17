import type { Product, ProductImage, ProductVariant } from '../types/database';
import { DEMO_PRODUCTS } from './demoProducts';

/* =========================================================
   THE CATALOGUE
   Real Three Ways Studios pieces only — the two studio-shot
   garments that exist as brand assets (Midnight Wide-Flare /
   Onyx Super-Flare). Names, prices, fabric and stock come from
   the product records (Supabase rows when configured, demo
   records as offline fallback).
   ========================================================= */

export const SIZES = ['S', 'M', 'L', 'XL'] as const;
export type Size = (typeof SIZES)[number];

export interface PieceEditorial {
  chapter: string;
  headlineTop: string;
  headlineBottom: string;
  scriptLine: string;
  capsLine: string;
  blurb: string;
  campaignImage: string;
  campaignCaption: string;
}

const PIECE_EDITORIAL: Record<string, PieceEditorial> = {
  'the-midnight-wide-flare': {
    chapter: 'Piece 01',
    headlineTop: 'MIDNIGHT',
    headlineBottom: 'WIDE-FLARE',
    scriptLine: 'cut to stack, made to move',
    capsLine: 'RAW SELVEDGE · 14 OZ · WIDE-FLARE',
    blurb:
      'A sculpted high rise, a clean thigh, and a leg that opens from the knee into an architectural wide-flare.',
    campaignImage: '/media/campaign-01.jpg',
    campaignCaption: 'Midnight Wide-Flare — On-Body View',
  },
  'the-onyx-super-flare': {
    chapter: 'Piece 02',
    headlineTop: 'ONYX',
    headlineBottom: 'SUPER-FLARE',
    scriptLine: 'gravity, worn as a silhouette',
    capsLine: 'ONYX BLACK · 13 OZ · SUPER-FLARE',
    blurb:
      'Matte onyx denim with a sculptural high rise and an exaggerated super-flare sweep to the floor.',
    campaignImage: '/media/campaign-02.jpg',
    campaignCaption: 'Onyx Super-Flare — Hem Detail',
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
  campaignCaption: 'Three Ways Studios — Lookbook View',
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

export interface GalleryFrame {
  id: string;
  url: string;
  alt: string;
  label: string;
  isEditorial?: boolean;
}

/**
 * Full interactive gallery frames for the Product Details Page:
 * Uses all real product_images (including front/back views from DB),
 * and appends the product's lookbook shot when only 1 studio frame exists
 * so the gallery always offers multi-angle inspection.
 */
export function galleryImagesFor(product: Product | undefined | null): GalleryFrame[] {
  if (!product) return [];
  const base = imagesOf(product);
  const frames: GalleryFrame[] = base.map((img, idx) => {
    const lower = (img.alt_text || '').toLowerCase();
    const label = lower.includes('back')
      ? 'Back View'
      : lower.includes('front')
        ? 'Front View'
        : idx === 0
          ? 'Studio View'
          : `View ${idx + 1}`;
    return {
      id: img.id,
      url: img.url,
      alt: img.alt_text || `${product.name} — ${label}`,
      label,
      isEditorial: false,
    };
  });

  if (frames.length === 1) {
    const ed = editorialFor(product);
    if (ed.campaignImage && !frames.some((f) => f.url === ed.campaignImage)) {
      frames.push({
        id: `${product.id}-lookbook`,
        url: ed.campaignImage,
        alt: ed.campaignCaption,
        label: product.slug === 'the-onyx-super-flare' ? 'Detail View' : 'On-Body View',
        isEditorial: true,
      });
    }
  }

  return frames;
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

/** Distinct colour names available in the product's variants. */
export function colorOptionsFor(product: Product | undefined | null): string[] {
  const variants = product?.variants ?? [];
  const names = variants.map((v) => v.color_name).filter(Boolean);
  const unique = Array.from(new Set(names));
  if (unique.length > 0) return unique;
  return [colourNameFor(product)];
}

export function resolveVariant(
  product: Product | undefined | null,
  size: string,
  colorName?: string
): ProductVariant | undefined {
  const variants = product?.variants ?? [];
  if (colorName) {
    const exact = variants.find((v) => v.size_name === size && v.color_name === colorName);
    if (exact) return exact;
  }
  return variants.find((v) => v.size_name === size) ?? variants[0];
}

/** Size availability read straight off the variant rows (optionally scoped by color). */
export function sizeOptionsFor(product: Product | undefined | null, colorName?: string): SizeOption[] {
  const allVariants = product?.variants ?? [];
  const variants = colorName
    ? allVariants.filter((v) => v.color_name === colorName)
    : allVariants;
  const pool = variants.length > 0 ? variants : allVariants;
  const order = pool.length > 0 ? pool.map((variant) => variant.size_name) : [...SIZES];
  const unique = Array.from(new Set(order));

  return unique.map((size) => {
    const variant = pool.find((candidate) => candidate.size_name === size);
    const stock = variant?.stock_quantity ?? 0;
    return {
      size,
      stock,
      soldOut: pool.length > 0 ? stock <= 0 : false,
      variantId: variant?.id ?? null,
      sku: variant?.sku ?? null,
    };
  });
}

export function firstAvailableSize(product: Product | undefined | null, colorName?: string): Size {
  const options = sizeOptionsFor(product, colorName);
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

export const HOUSE_SIZE_GUIDE = [
  { size: 'S', waist: '74–78 cm', hip: '94–98 cm', thigh: '56 cm', inseam: '80 cm', length: '104 cm', weight: '55–66 kg', height: '165–174 cm' },
  { size: 'M', waist: '78–84 cm', hip: '98–104 cm', thigh: '59 cm', inseam: '81 cm', length: '106 cm', weight: '66–77 kg', height: '172–179 cm' },
  { size: 'L', waist: '84–92 cm', hip: '104–110 cm', thigh: '62 cm', inseam: '82 cm', length: '108 cm', weight: '77–89 kg', height: '178–186 cm' },
  { size: 'XL', waist: '92–100 cm', hip: '110–118 cm', thigh: '65 cm', inseam: '83 cm', length: '110 cm', weight: '89–105 kg', height: '184–192 cm' },
];

export const PLATE_ASPECT = '522 / 1223';
