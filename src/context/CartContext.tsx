import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import type { CartItem } from '../types/database';

/* =========================================================
   CART — the one place stock and price are resolved for the bag.
   Product data (including colour) is stored for the order record but
   is NEVER allowed to influence the interface palette; the bag renders
   a fixed white swatch for every item.
   ========================================================= */

interface AddResult {
  ok: boolean;
  message?: string;
}

interface CartContextValue {
  items: CartItem[];
  isDrawerOpen: boolean;
  lastAddedMessage: string | null;
  itemCount: number;
  subtotal: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (item: CartItem) => AddResult;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  replaceVariant: (oldVariantId: string, newItem: CartItem) => void;
  clearCart: () => void;
  syncItemStock: (updates: Array<{ variant_id: string; available_stock: number; unit_price: number }>) => void;
}

const CART_STORAGE_KEY = 'tws_cart_v2';

const CartContext = createContext<CartContextValue | undefined>(undefined);

function normalizeStoredItem(item: CartItem): CartItem | null {
  if (!item || typeof item !== 'object' || !item.variant_id) return null;

  const isDatabaseVariantId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.variant_id);

  // A genuine database variant id must NEVER be rewritten to a demo id. If the
  // stored line carries a real UUID we keep it exactly as persisted — the
  // product/variant data on the line was set from the catalogue at add time and
  // is already correct. Re-resolving against the demo catalogue by
  // (slug + size) would clobber the real id and break checkout/orders.
  if (isDatabaseVariantId) {
    return item;
  }

  // Demo cart line — resolve against the demo catalogue as before, matching by
  // exact variant id or by slug + size name.
  for (const product of DEMO_PRODUCTS) {
    const variant = product.variants?.find(
      (candidate) =>
        candidate.id === item.variant_id ||
        (product.slug === item.product_slug && candidate.size_name === item.size_name)
    );
    if (variant) {
      return {
        ...item,
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        product_image: product.images?.[0]?.url ?? item.product_image,
        color_name: variant.color_name,
        color_hex: variant.color_hex,
        size_name: variant.size_name,
        unit_price: product.price,
        original_price: product.original_price,
        max_stock: variant.stock_quantity,
        quantity: Math.max(1, Math.min(item.quantity ?? 1, variant.stock_quantity || 1)),
      };
    }
  }
  return item;
}

function loadStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeStoredItem(entry as CartItem))
      .filter((entry): entry is CartItem => entry !== null);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadStoredCart);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [lastAddedMessage, setLastAddedMessage] = useState<string | null>(null);

  // mirror of items so add/stock maths resolve synchronously (no stale updater flag)
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage unavailable (private mode) — the bag still works in memory
    }
  }, [items]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    []
  );

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [items]
  );

  const flash = useCallback((message: string) => {
    setLastAddedMessage(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setLastAddedMessage(null), 3600);
  }, []);

  const addItem = useCallback(
    (incoming: CartItem): AddResult => {
      const maxStock = Math.max(0, incoming.max_stock);
      if (maxStock <= 0) {
        return { ok: false, message: `Size ${incoming.size_name} is sold out in ${incoming.product_name}.` };
      }

      const existing = itemsRef.current.find((item) => item.variant_id === incoming.variant_id);
      const nextQuantity = Math.min((existing?.quantity ?? 0) + incoming.quantity, maxStock);
      const clamped = Math.max(1, nextQuantity);
      const hitCeiling = (existing?.quantity ?? 0) + incoming.quantity > maxStock;

      setItems((prev) => {
        const index = prev.findIndex((item) => item.variant_id === incoming.variant_id);
        if (index === -1) {
          return [...prev, { ...incoming, quantity: clamped, max_stock: maxStock }];
        }
        const next = [...prev];
        next[index] = { ...next[index], ...incoming, quantity: clamped, max_stock: maxStock };
        return next;
      });

      const message = hitCeiling
        ? `Only ${maxStock} in stock — your bag holds ${maxStock}.`
        : `${incoming.product_name} · Size ${incoming.size_name} added to your bag.`;
      flash(message);

      return { ok: true, message };
    },
    [flash]
  );

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((item) => item.variant_id !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.variant_id !== variantId));
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.variant_id === variantId
          ? { ...item, quantity: Math.min(quantity, Math.max(1, item.max_stock)) }
          : item
      )
    );
  }, []);

  const replaceVariant = useCallback((oldVariantId: string, newItem: CartItem) => {
    setItems((prev) => {
      const withoutOld = prev.filter((item) => item.variant_id !== oldVariantId);
      const existingIndex = withoutOld.findIndex((item) => item.variant_id === newItem.variant_id);
      if (existingIndex === -1) {
        return [...withoutOld, { ...newItem, quantity: Math.min(newItem.quantity, Math.max(1, newItem.max_stock)) }];
      }
      const merged = [...withoutOld];
      const target = merged[existingIndex];
      merged[existingIndex] = {
        ...target,
        quantity: Math.min(target.quantity + newItem.quantity, Math.max(1, newItem.max_stock)),
        max_stock: newItem.max_stock,
      };
      return merged;
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const syncItemStock = useCallback(
    (updates: Array<{ variant_id: string; available_stock: number; unit_price: number }>) => {
      setItems((prev) =>
        prev.map((item) => {
          const match = updates.find((update) => update.variant_id === item.variant_id);
          if (!match) return item;
          return {
            ...item,
            max_stock: match.available_stock,
            unit_price: match.unit_price,
            quantity:
              match.available_stock > 0
                ? Math.min(item.quantity, match.available_stock)
                : item.quantity,
          };
        })
      );
    },
    []
  );

  const value: CartContextValue = {
    items,
    isDrawerOpen,
    lastAddedMessage,
    itemCount,
    subtotal,
    openDrawer: () => setIsDrawerOpen(true),
    closeDrawer: () => setIsDrawerOpen(false),
    addItem,
    removeItem,
    updateQuantity,
    replaceVariant,
    clearCart,
    syncItemStock,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
