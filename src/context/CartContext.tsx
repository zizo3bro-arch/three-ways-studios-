import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_PRODUCTS } from '../data/demoProducts';
import type { CartItem } from '../types/database';

interface CartContextValue {
  items: CartItem[];
  isDrawerOpen: boolean;
  lastAddedMessage: string | null;
  itemCount: number;
  subtotal: number;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (item: CartItem) => { ok: boolean; message?: string };
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  replaceVariant: (oldVariantId: string, newItem: CartItem) => void;
  clearCart: () => void;
  syncItemStock: (updates: Array<{ variant_id: string; available_stock: number; unit_price: number }>) => void;
}

const CART_STORAGE_KEY = 'tws_cart_v1';

const CartContext = createContext<CartContextValue | undefined>(undefined);

function normalizeStoredItem(item: CartItem): CartItem {
  for (const product of DEMO_PRODUCTS) {
    const variant = product.variants?.find(
      (v) => v.id === item.variant_id || (product.slug === item.product_slug && v.size_name === item.size_name)
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
        unit_price: product.price,
        original_price: product.original_price,
      };
    }
  }
  return item;
}

function loadStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeStoredItem) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadStoredCart);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [lastAddedMessage, setLastAddedMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, [items]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [items]
  );

  const addItem = (incoming: CartItem): { ok: boolean; message?: string } => {
    if (incoming.max_stock <= 0) {
      return { ok: false, message: 'This variant is currently out of stock.' };
    }

    let exceeded = false;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.variant_id === incoming.variant_id);
      if (idx === -1) {
        const clampedQty = Math.min(incoming.quantity, incoming.max_stock);
        return [...prev, { ...incoming, quantity: clampedQty }];
      }
      const existing = prev[idx];
      const nextQty = existing.quantity + incoming.quantity;
      if (nextQty > incoming.max_stock) {
        exceeded = true;
      }
      const clampedQty = Math.min(nextQty, incoming.max_stock);
      const updated = [...prev];
      updated[idx] = {
        ...existing,
        ...incoming,
        quantity: clampedQty,
      };
      return updated;
    });

    const msg = exceeded
      ? `Maximum available stock (${incoming.max_stock}) added to your bag.`
      : `${incoming.product_name} (${incoming.color_name} / ${incoming.size_name}) added to bag.`;
    setLastAddedMessage(msg);
    setTimeout(() => {
      setLastAddedMessage((current) => (current === msg ? null : current));
    }, 3200);

    return { ok: true, message: msg };
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((item) => item.variant_id !== variantId));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.variant_id === variantId
          ? { ...item, quantity: Math.min(quantity, Math.max(1, item.max_stock)) }
          : item
      )
    );
  };

  const replaceVariant = (oldVariantId: string, newItem: CartItem) => {
    setItems((prev) => {
      const withoutOld = prev.filter((item) => item.variant_id !== oldVariantId);
      const existingNewIdx = withoutOld.findIndex((item) => item.variant_id === newItem.variant_id);
      if (existingNewIdx === -1) {
        return [...withoutOld, { ...newItem, quantity: Math.min(newItem.quantity, newItem.max_stock) }];
      }
      const merged = [...withoutOld];
      const target = merged[existingNewIdx];
      merged[existingNewIdx] = {
        ...target,
        quantity: Math.min(target.quantity + newItem.quantity, newItem.max_stock),
        max_stock: newItem.max_stock,
      };
      return merged;
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const syncItemStock = (
    updates: Array<{ variant_id: string; available_stock: number; unit_price: number }>
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        const match = updates.find((u) => u.variant_id === item.variant_id);
        if (!match) return item;
        return {
          ...item,
          max_stock: match.available_stock,
          unit_price: match.unit_price,
          quantity: match.available_stock > 0 ? Math.min(item.quantity, match.available_stock) : item.quantity,
        };
      })
    );
  };

  return (
    <CartContext.Provider
      value={{
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
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
