import { useCallback } from 'react';
import { useCart } from '../context/CartContext';
import { primaryImage, resolveVariant } from '../data/catalog';
import type { Product } from '../types/database';

/* =========================================================
   ADD TO BAG — the single path from a product + size (+ optional
   color) to a bag line. Resolves the real variant row so quantity
   limits and checkout quotes always match the catalogue.
   ========================================================= */

interface AddOptions {
  colorName?: string;
  quantity?: number;
  openDrawer?: boolean;
}

export function useAddToBag() {
  const { addItem, openDrawer } = useCart();

  return useCallback(
    (
      product: Product,
      size: string,
      { colorName, quantity = 1, openDrawer: open = false }: AddOptions = {}
    ) => {
      const variant = resolveVariant(product, size, colorName);

      if (!variant) {
        return { ok: false, message: `${product.name} is currently unavailable.` };
      }
      if (variant.stock_quantity <= 0) {
        return { ok: false, message: `Size ${variant.size_name} is sold out.` };
      }

      const image = primaryImage(product);
      const result = addItem({
        variant_id: variant.id,
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        product_image: image?.url ?? null,
        color_name: variant.color_name,
        color_hex: variant.color_hex,
        size_name: variant.size_name,
        unit_price: product.price,
        original_price: product.original_price,
        quantity,
        max_stock: variant.stock_quantity,
      });

      if (result.ok && open) openDrawer();
      return result;
    },
    [addItem, openDrawer]
  );
}
