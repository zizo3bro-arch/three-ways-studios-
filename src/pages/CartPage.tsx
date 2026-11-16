import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatEGP } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { ProductVariant } from '../types/database';

export function CartPage() {
  const { items, subtotal, removeItem, updateQuantity, replaceVariant, syncItemStock } = useCart();
  const navigate = useNavigate();

  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({});
  const [loadingVariants, setLoadingVariants] = useState(false);

  useEffect(() => {
    document.title = 'Shopping Bag — THREE WAYS STUDIOS';
  }, []);

  useEffect(() => {
    if (!supabase || items.length === 0) return;
    const productIds = Array.from(new Set(items.map((i) => i.product_id)));
    setLoadingVariants(true);

    supabase
      .from('product_variants')
      .select('*')
      .in('product_id', productIds)
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) {
          const grouped: Record<string, ProductVariant[]> = {};
          const stockUpdates: Array<{
            variant_id: string;
            available_stock: number;
            unit_price: number;
          }> = [];

          for (const v of data as ProductVariant[]) {
            if (!grouped[v.product_id]) grouped[v.product_id] = [];
            grouped[v.product_id].push(v);

            const cartMatch = items.find((i) => i.variant_id === v.id);
            if (cartMatch) {
              stockUpdates.push({
                variant_id: v.id,
                available_stock: v.stock_quantity,
                unit_price: cartMatch.unit_price,
              });
            }
          }
          setVariantsByProduct(grouped);
          if (stockUpdates.length > 0) {
            syncItemStock(stockUpdates);
          }
        }
        setLoadingVariants(false);
      });
  }, [items.length]);

  const handleChangeVariant = (
    currentItem: (typeof items)[number],
    nextColor: string,
    nextSize: string
  ) => {
    const productVariants = variantsByProduct[currentItem.product_id] ?? [];
    const target =
      productVariants.find((v) => v.color_name === nextColor && v.size_name === nextSize) ??
      productVariants.find((v) => v.color_name === nextColor && v.stock_quantity > 0);

    if (!target || target.stock_quantity <= 0) return;

    replaceVariant(currentItem.variant_id, {
      ...currentItem,
      variant_id: target.id,
      color_name: target.color_name,
      color_hex: target.color_hex,
      size_name: target.size_name,
      max_stock: target.stock_quantity,
    });
  };

  return (
    <main className="mx-auto max-w-[1280px] px-5 pt-30 pb-24 sm:px-8 lg:px-12">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-white/12 pb-6">
        <div>
          <p className="text-[10px] tracking-[0.24em] text-[#d4121b] uppercase">
            THREE WAYS STUDIOS
          </p>
          <h1 className="mt-2 text-2xl font-normal text-white sm:text-3xl">Shopping Bag</h1>
        </div>
        <Link
          to="/#products"
          className="inline-flex items-center gap-2 text-xs tracking-[0.16em] text-[#cfc6c6] uppercase hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Continue Shopping
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="border border-white/12 bg-black/35 py-20 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 stroke-[1.2] text-[#7a6e6e]" />
          <p className="mt-4 text-sm tracking-[0.18em] text-white uppercase">Your bag is empty</p>
          <p className="mt-2 text-xs text-[#9e9494]">
            Browse our women&apos;s pants collection to select your silhouette.
          </p>
          <Link
            to="/#products"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#b30e16] px-7 py-3 text-xs font-medium tracking-[0.2em] text-white uppercase hover:bg-[#d4121b]"
          >
            Shop Women&apos;s Pants
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {items.map((item) => {
              const allVariants = variantsByProduct[item.product_id] ?? [];
              const colors = Array.from(new Set(allVariants.map((v) => v.color_name)));
              const sizesForColor = allVariants.filter((v) => v.color_name === item.color_name);

              return (
                <div
                  key={item.variant_id}
                  className="flex flex-col gap-5 border border-white/12 bg-black/35 p-4 sm:flex-row sm:p-5"
                >
                  <Link
                    to={`/products/${item.product_slug}`}
                    className="tws-card-surface aspect-[3/4] w-24 shrink-0 overflow-hidden border border-white/10"
                  >
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </Link>

                  <div className="flex flex-1 flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          to={`/products/${item.product_slug}`}
                          className="text-sm font-medium text-white hover:text-[#d4121b]"
                        >
                          {item.product_name}
                        </Link>
                        <p className="mt-1 text-xs text-[#d4121b]">
                          {formatEGP(item.unit_price)} each
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.variant_id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#8f8383] hover:text-[#ff6b6b]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>

                    {/* Variant & Quantity Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        {colors.length > 0 ? (
                          <select
                            aria-label={`Color for ${item.product_name}`}
                            value={item.color_name}
                            onChange={(e) =>
                              handleChangeVariant(item, e.target.value, item.size_name)
                            }
                            className="border border-white/15 bg-[#0c0708] px-2.5 py-1.5 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                          >
                            {colors.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-[#b5aaaa]">{item.color_name}</span>
                        )}

                        {sizesForColor.length > 0 ? (
                          <select
                            aria-label={`Size for ${item.product_name}`}
                            value={item.size_name}
                            onChange={(e) =>
                              handleChangeVariant(item, item.color_name, e.target.value)
                            }
                            className="border border-white/15 bg-[#0c0708] px-2.5 py-1.5 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                          >
                            {sizesForColor.map((v) => (
                              <option
                                key={v.id}
                                value={v.size_name}
                                disabled={v.stock_quantity <= 0}
                              >
                                Size {v.size_name}
                                {v.stock_quantity <= 0 ? ' (Out)' : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-[#b5aaaa]">Size {item.size_name}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-5">
                        <div className="inline-flex items-center border border-white/15">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                            className="px-2.5 py-1.5 text-[#cfc6c6] hover:text-white"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-3 text-xs text-white">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                            disabled={item.quantity >= item.max_stock}
                            className="px-2.5 py-1.5 text-[#cfc6c6] hover:text-white disabled:opacity-35"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <span className="min-w-[85px] text-right text-sm font-medium text-white">
                          {formatEGP(item.unit_price * item.quantity)}
                        </span>
                      </div>
                    </div>

                    {item.max_stock <= 0 && !loadingVariants && (
                      <p className="text-xs text-[#ff7575]">
                        This variant just sold out. Select another size/color or remove it.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bag Summary */}
          <div className="lg:col-span-4">
            <div className="border border-white/15 bg-black/45 p-6">
              <h2 className="border-b border-white/10 pb-3 text-xs font-medium tracking-[0.2em] text-white uppercase">
                Order Summary
              </h2>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between text-[#cfc6c6]">
                  <span>Subtotal</span>
                  <span>{formatEGP(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#9e9494]">
                  <span>Payment Method</span>
                  <span>Cash on Delivery (COD)</span>
                </div>
                <div className="flex justify-between text-[#9e9494]">
                  <span>Discounts</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div className="mt-5 flex justify-between border-t border-white/10 pt-4 text-sm font-medium text-white">
                <span>Estimated Total</span>
                <span>{formatEGP(subtotal)}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/checkout')}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#b30e16] px-6 py-3.5 text-xs font-medium tracking-[0.2em] text-white uppercase transition-colors hover:bg-[#d4121b]"
              >
                Proceed to Checkout
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
