import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatEGP } from '../lib/format';
import { requestSectionReveal } from '../lib/heroGate';

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

  const exploreProducts = () => {
    closeDrawer();
    if (window.location.pathname !== '/') {
      navigate('/');
      window.setTimeout(() => requestSectionReveal('products'), 340);
      return;
    }
    window.setTimeout(() => requestSectionReveal('products'), 120);
  };

  return (
    <>
      {/* Add-to-bag toast */}
      <AnimatePresence>
        {lastAddedMessage && !isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="fixed bottom-6 right-5 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-ink/15 bg-cream-card/95 px-4 py-3 shadow-[0_18px_50px_rgba(20,18,16,0.28)] backdrop-blur-md"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-cream">
              <ShoppingBag className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <p className="text-xs leading-relaxed text-ink">{lastAddedMessage}</p>
            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-crimson-bright hover:text-crimson"
            >
              Bag
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-over bag */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-[#141210]/45 backdrop-blur-[2px]"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-ink/10 bg-cream text-ink shadow-2xl"
              aria-label="Shopping bag"
            >
              <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
                <div>
                  <h2 className="font-display text-base uppercase tracking-[0.08em] text-ink">
                    Shopping Bag
                  </h2>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                    Cash on delivery — Egypt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="Close bag"
                  className="rounded-full border border-ink/15 p-2 text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <ShoppingBag className="h-10 w-10 stroke-[1.2] text-ink-faint" />
                    <p className="mt-4 font-display text-sm uppercase tracking-[0.14em] text-ink">
                      Your bag is empty
                    </p>
                    <p className="mt-2 max-w-[240px] text-xs leading-relaxed text-ink-soft">
                      Two silhouettes, one obsession. Take your pick from Drop 01.
                    </p>
                    <button
                      type="button"
                      onClick={exploreProducts}
                      className="mt-6 rounded-full bg-ink px-7 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-cream transition-colors hover:bg-crimson-bright"
                    >
                      Explore the Drop
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.variant_id}
                        className="flex gap-4 border-b border-ink/10 pb-4"
                      >
                        <div className="flex h-24 w-20 shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-ink/10 bg-cream-deep p-1.5">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              className="h-full w-auto object-contain object-bottom"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-widest text-ink-faint">
                              TWS
                            </div>
                          )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[13px] font-semibold leading-snug text-ink">
                                {item.product_name}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeItem(item.variant_id)}
                                aria-label={`Remove ${item.product_name}`}
                                className="text-ink-faint transition-colors hover:text-crimson-bright"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                              </button>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-soft">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full border border-ink/25"
                                style={{ backgroundColor: item.color_hex }}
                              />
                              <span>{item.color_name}</span>
                              <span aria-hidden="true">·</span>
                              <span>Size {item.size_name}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="inline-flex items-center rounded-full border border-ink/15">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                                aria-label="Decrease quantity"
                                className="rounded-l-full px-2.5 py-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-7 text-center text-xs font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                                disabled={item.quantity >= item.max_stock}
                                aria-label="Increase quantity"
                                className="rounded-r-full px-2.5 py-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-35"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-xs font-bold text-ink">
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
                <div className="border-t border-ink/12 bg-cream-deep/70 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-soft">
                      Subtotal
                    </span>
                    <span className="font-display text-lg text-ink">{formatEGP(subtotal)}</span>
                  </div>
                  <p className="mt-1 text-[10px] tracking-wide text-ink-faint">
                    Discounts and delivery confirmed at checkout.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      closeDrawer();
                      navigate('/checkout');
                    }}
                    className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[10px] font-bold uppercase tracking-[0.26em] text-cream transition-colors duration-300 hover:bg-crimson-bright"
                  >
                    Proceed to Checkout
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              )}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
