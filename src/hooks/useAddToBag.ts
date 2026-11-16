import { useCallback } from 'react';
import { useCart } from '../context/CartContext';
import { primaryImage } from '../data/catalog';
import type { Product } from '../types/database';

/* =========================================================
   ADD TO BAG — the single path from a product + size to a bag line.
   Resolves the real variant row (price, stock, sku, colour name) so
   quantity limits and checkout quotes always match the catalogue.
   ========================================================= */

interface AddOptions {
  quantity?: number;
  openDrawer?: boolean;
}

export function useAddToBag() {
  const { addItem, openDrawer } = useCart();

  return useCallback(
    (product: Product, size: string, { quantity = 1, openDrawer: open = false }: AddOptions = {}) => {
      const variants = product.variants ?? [];
      const variant = variants.find((candidate) => candidate.size_name === size) ?? variants[0];

      if (!variant) {
        return { ok: false, message: `${product.name} is between drops — nothing to add yet.` };
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
