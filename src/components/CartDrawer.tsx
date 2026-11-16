import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatEGP } from '../lib/format';

export function CartDrawer() {
  const {
    items,
    isDrawerOpen,
    lastAddedMessage,
    subtotal,
    closeDrawer,
    removeItem,
    updateQuantity,
  } = useCart();
  const navigate = useNavigate();

  return (
    <>
      {/* Animated Add-to-Cart Feedback Toast */}
      <AnimatePresence>
        {lastAddedMessage && !isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="fixed right-5 bottom-6 z-50 flex max-w-sm items-center gap-3 border border-[#b30e16]/60 bg-[#0d0708]/95 px-4 py-3 shadow-2xl backdrop-blur-md"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#b30e16] text-white">
              <ShoppingBag className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs leading-relaxed text-[#f2eded]">{lastAddedMessage}</p>
            <button
              type="button"
              onClick={() => {
                navigate('/checkout');
              }}
              className="shrink-0 text-[10px] font-semibold tracking-[0.18em] text-[#e83d46] uppercase hover:text-white"
            >
              Bag
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-over Cart Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-white/12 bg-[#080405] text-[#f2eded]"
              aria-label="Shopping Bag"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <div>
                  <h2 className="text-sm font-medium tracking-[0.22em] uppercase">Shopping Bag</h2>
                  <p className="mt-0.5 text-[11px] text-[#9e9494]">
                    Cash on Delivery across Egypt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close bag"
                  className="rounded-full border border-white/15 p-2 text-[#cfc6c6] transition-colors hover:border-white/40 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <ShoppingBag className="h-10 w-10 stroke-[1.2] text-[#6d6262]" />
                    <p className="mt-4 text-sm tracking-[0.16em] text-[#cfc6c6] uppercase">
                      Your bag is empty
                    </p>
                    <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#8d8282]">
                      Explore THREE WAYS STUDIOS women&apos;s pants to add pieces to your bag.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        closeDrawer();
                        navigate('/#products');
                        setTimeout(() => {
                          document
                            .getElementById('products')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }, 120);
                      }}
                      className="mt-6 rounded-full border border-white/25 px-6 py-2.5 text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-[#d4121b] hover:bg-[#b30e16]"
                    >
                      Explore Pants
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.variant_id}
                        className="flex gap-4 border-b border-white/10 pb-4"
                      >
                        <Link
                          to={`/products/${item.product_slug}`}
                          onClick={closeDrawer}
                          className="tws-card-surface h-24 w-18 shrink-0 overflow-hidden border border-white/10"
                        >
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] tracking-widest text-[#7d7373] uppercase">
                              TWS
                            </div>
                          )}
                        </Link>

                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                to={`/products/${item.product_slug}`}
                                onClick={closeDrawer}
                                className="truncate text-sm font-medium text-white hover:text-[#e63946]"
                              >
                                {item.product_name}
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeItem(item.variant_id)}
                                aria-label={`Remove ${item.product_name}`}
                                className="text-[#7d7373] transition-colors hover:text-[#e63946]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[#9e9494]">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full border border-white/25"
                                style={{ backgroundColor: item.color_hex }}
                              />
                              <span>{item.color_name}</span>
                              <span>·</span>
                              <span>Size {item.size_name}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="inline-flex items-center border border-white/15">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                                aria-label="Decrease quantity"
                                className="px-2 py-1 text-[#cfc6c6] hover:bg-white/5 hover:text-white"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="px-3 text-xs">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                                disabled={item.quantity >= item.max_stock}
                                aria-label="Increase quantity"
                                className="px-2 py-1 text-[#cfc6c6] hover:bg-white/5 hover:text-white disabled:opacity-35"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-xs font-medium text-[#f2eded]">
                              {formatEGP(item.unit_price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="border-t border-white/12 bg-[#0a0506] px-6 py-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9e9494]">Subtotal</span>
                    <span className="font-medium text-white">{formatEGP(subtotal)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#847878]">
                    Final discounts and delivery confirmed at checkout.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        closeDrawer();
                        navigate('/checkout');
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#b30e16] px-6 py-3 text-xs font-medium tracking-[0.2em] text-white uppercase transition-colors hover:bg-[#d4121b]"
                    >
                      Proceed to Checkout
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeDrawer();
                        navigate('/cart');
                      }}
                      className="w-full rounded-full border border-white/20 px-6 py-2.5 text-[11px] tracking-[0.2em] text-[#e6dfdf] uppercase transition-colors hover:border-white/45"
                    >
                      View Full Bag
                    </button>
                  </div>
                </div>
              )}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
