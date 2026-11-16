import type { Product } from '../types/database';

export interface DemoProduct extends Product {
  is_demo?: boolean;
}

const now = '2026-11-10T12:00:00.000Z';

/**
 * THREE WAYS STUDIOS — 2026 Drop 01.
 * The catalogue is intentionally focused: two signature wide-flare silhouettes,
 * shot in the studio and isolated on transparency.
 */
export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 'demo-midnight-wide-flare',
    name: 'The Midnight Wide-Flare',
    slug: 'the-midnight-wide-flare',
    description:
      'Cut from 14oz midnight raw selvedge with a sculpted high rise, tapered thigh and a sweeping wide-flare leg. An architectural silhouette engineered to stack softly over boots — day to midnight.',
    fabric_info: '100% Heavyweight 14oz Japanese Raw Selvedge Denim',
    fit_info: 'High-rise fitted hip, relaxed thigh, dramatic wide-flare from knee to hem.',
    care_instructions: 'Cold wash inside out. Hang dry in shade. Do not tumble dry.',
    price: 2450,
    original_price: 2750,
    category: 'Unisex',
    collection_name: 'Drop 01 — 2026',
    is_new_arrival: true,
    is_best_seller: true,
    is_trending: true,
    is_featured: true,
    is_published: true,
    is_demo: true,
    sort_order: 1,
    created_at: now,
    updated_at: now,
    images: [
      {
        id: 'img-mny-1',
        product_id: 'demo-midnight-wide-flare',
        url: '/images/pants-navy.png',
        alt_text: 'The Midnight Wide-Flare in deep midnight navy, front studio view',
        color_name: 'Midnight Navy',
        display_order: 1,
        is_primary: true,
        created_at: now,
      },
    ],
    variants: [
      { id: 'v-mny-s', product_id: 'demo-midnight-wide-flare', sku: 'TWS-MNY-S', color_name: 'Midnight Navy', color_hex: '#152c4e', size_name: 'S', stock_quantity: 12, low_stock_threshold: 3, is_active: true, created_at: now, updated_at: now },
      { id: 'v-mny-m', product_id: 'demo-midnight-wide-flare', sku: 'TWS-MNY-M', color_name: 'Midnight Navy', color_hex: '#152c4e', size_name: 'M', stock_quantity: 15, low_stock_threshold: 3, is_active: true, created_at: now, updated_at: now },
      { id: 'v-mny-l', product_id: 'demo-midnight-wide-flare', sku: 'TWS-MNY-L', color_name: 'Midnight Navy', color_hex: '#152c4e', size_name: 'L', stock_quantity: 9, low_stock_threshold: 3, is_active: true, created_at: now, updated_at: now },
      { id: 'v-mny-xl', product_id: 'demo-midnight-wide-flare', sku: 'TWS-MNY-XL', color_name: 'Midnight Navy', color_hex: '#152c4e', size_name: 'XL', stock_quantity: 6, low_stock_threshold: 3, is_active: true, created_at: now, updated_at: now },
    ],
  },
  {
    id: 'demo-onyx-super-flare',
    name: 'The Onyx Super-Flare',
    slug: 'the-onyx-super-flare',
    description:
      'Cut from 13oz onyx black denim with a sculptural high rise and an exaggerated super-flare sweep. Silent, heavy, architectural — the silhouette that closes the show.',
    fabric_info: '100% Heavyweight 13oz Onyx Black Cotton Denim, bar-tack stitched',
    fit_info: 'High-rise fitted hip, sculptural thigh, exaggerated super-flare to floor.',
    care_instructions: 'Cold hand wash separately. Line dry. Do not bleach.',
    price: 2650,
    original_price: null,
    category: 'Unisex',
    collection_name: 'Drop 01 — 2026',
    is_new_arrival: true,
    is_best_seller: false,
    is_trending: true,
    is_featured: true,
    is_published: true,
    is_demo: true,
    sort_order: 2,
    created_at: now,
    updated_at: now,
    images: [
      {
        id: 'img-onx-1',
        product_id: 'demo-onyx-super-flare',
        url: '/images/pants-black.png',
        alt_text: 'The Onyx Super-Flare in deep matte black, back studio view',
        color_name: 'Onyx Black',
        display_order: 1,
        is_primary: true,
        created_at: now,
      },
    ],
    variants: [
      { id: 'v-onx-s', product_id: 'demo-onyx-super-flare', sku: 'TWS-ONX-S', color_name: 'Onyx Black', color_hex: '#09090b', size_name: 'S', stock_quantity: 9, low_stock_threshold: 3, is_active: true, created_at: now, updated_at: now },
      { id: 'v-onx-m', product_id: 'demo-onyx-super-flare', sku: 'TWS-ONX-M', color_name: 'Onyx Black', color_hex: '#09090b', size_name: 'M', stock_quantity: 12, low_stock_threshold: 3, is_active: true, created_at: now, updated_at: now },
      { id: 'v-onx-l', product_id: 'demo-onyx-super-flare', sku: 'TWS-ONX-L', color_name: 'Onyx Black', color_hex: '#09090b', size_name: 'L', stock_quantity: 8, low_stock_threshold: 3, is_active: true, created_at: now, updated_at: now },
      { id: 'v-onx-xl', product_id: 'demo-onyx-super-flare', sku: 'TWS-ONX-XL', color_name: 'Onyx Black', color_hex: '#09090b', size_name: 'XL', stock_quantity: 5, low_stock_threshold: 3, is_active: true, created_at: now, updated_at: now },
    ],
  },
];
