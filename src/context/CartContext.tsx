import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isVariantId } from '../lib/api';
import type { CartItem } from '../types/database';

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
  clearCart: () => void;
  syncItemStock: (
    updates: Array<{ variant_id: string; available_stock: number; unit_price: number }>
  ) => void;
}

const CART_STORAGE_KEY = 'tws_cart_v2';

const CartContext = createContext<CartContextValue | undefined>(undefined);

function normalizeStoredItem(item: CartItem): CartItem | null {
  if (
    !item ||
    !isVariantId(item.variant_id) ||
    typeof item.product_name !== 'string' ||
    !Number.isSafeInteger(item.quantity) ||
    item.quantity < 1 ||
    !Number.isFinite(item.unit_price)
  )
    return null;
  return item; // Retain genuine carts under their existing storage key, never resurrect a demo SKU.
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
        return {
          ok: false,
          message: `Size ${incoming.size_name} is sold out in ${incoming.product_name}.`,
        };
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

  const clearCart = useCallback(() => setItems([]), []);

  const syncItemStock = useCallback(
    (updates: Array<{ variant_id: string; available_stock: number; unit_price: number }>) => {
      setItems((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          const live = updates.find((u) => u.variant_id === item.variant_id);
          if (!live || (live.available_stock === item.max_stock && live.unit_price === item.unit_price))
            return item;
          changed = true;
          return { ...item, max_stock: live.available_stock, unit_price: live.unit_price };
        });
        return changed ? next : prev;
      });
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
