import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { useUI } from '../../context/UIContext';
import { calculateShippingCost, FREE_SHIPPING_THRESHOLD_EGP } from '../../lib/api';
import { formatEGP } from '../../lib/format';
import { ColourChip } from '../ui/ColourChip';
import { Overlay } from '../ui/Overlay';

/* =========================================================
   BAG DRAWER — quantity, removal, live subtotal and the shipping
   rule that checkout will actually apply (free over EGP 3,500).
   Colour is always the fixed white plate, never the garment colour.
   ========================================================= */

export function CartDrawer() {
  const { items, isDrawerOpen, closeDrawer, removeItem, updateQuantity, subtotal, itemCount, lastAddedMessage } =
    useCart();
  const { openOverlay } = useUI();
  const navigate = useNavigate();

  const shipping = calculateShippingCost(subtotal);
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD_EGP - subtotal);

  return (
    <>
      {/* add-to-bag confirmation */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[80] flex justify-center px-4 sm:justify-end sm:px-6"
      >
        {lastAddedMessage && !isDrawerOpen ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex max-w-sm items-center gap-3 border border-ink/18 bg-[rgba(244,240,232,0.96)] py-2.5 pl-3 pr-4 backdrop-blur-md"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crimson-bright text-ivory">
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
              </span>
              <p className="text-[12px] leading-tight text-ink">{lastAddedMessage}</p>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>

      <Overlay open={isDrawerOpen} onClose={closeDrawer} label="Shopping bag" placement="right">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="border-b border-ink/16 pb-3">
            <p className="tws-eyebrow text-crimson-bright">Drop 01 — 2026</p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <h2 className="font-display text-[1.9rem] uppercase leading-none tracking-[0.005em] text-ink">
                Your bag
              </h2>
              <span className="pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-faint">
                {itemCount} {itemCount === 1 ? 'piece' : 'pieces'}
              </span>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-ink/20 text-ink-faint">
                <ShoppingBag className="h-6 w-6" strokeWidth={1.3} />
              </span>
              <p className="mt-5 font-display text-xl uppercase leading-tight text-ink">Nothing in the bag</p>
              <p className="mt-2 max-w-[250px] text-[13px] leading-relaxed text-ink-soft">
                Two silhouettes, cut in Cairo and finished one at a time.
              </p>
              <div className="mt-6 flex flex-col items-center gap-2.5">
                <Link
                  to="/shop"
                  onClick={closeDrawer}
                  className="tws-pill h-12 w-full justify-center sm:w-auto sm:min-w-[220px]"
                >
                  Go to the shop
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeDrawer();
                    openOverlay('search');
                  }}
                  className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-faint underline-offset-4 transition-colors hover:text-crimson-bright hover:underline"
                >
                  Search the archive
                </button>
              </div>
            </div>
          ) : (
            <>
              <ul className="flex-1 overflow-y-auto py-1">
                {items.map((item) => (
                  <li key={item.variant_id} className="flex gap-4 border-b border-ink/10 py-4">
                    <Link
                      to={`/product/${item.product_slug}`}
                      onClick={closeDrawer}
                      className="flex h-[124px] w-[74px] shrink-0 items-end justify-center overflow-hidden bg-[rgba(23,19,15,0.05)] transition-opacity hover:opacity-90"
                    >
                      {item.product_image ? (
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          loading="lazy"
                          className="h-full w-auto object-contain object-bottom"
                        />
                      ) : null}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            to={`/product/${item.product_slug}`}
                            onClick={closeDrawer}
                            className="text-[13px] font-bold uppercase leading-snug tracking-[0.04em] text-ink transition-colors hover:text-crimson-bright"
                          >
                            {item.product_name}
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeItem(item.variant_id)}
                            aria-label={`Remove ${item.product_name} from the bag`}
                            className="shrink-0 text-ink-faint transition-colors hover:text-crimson-bright"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                          </button>
                        </div>
                        <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                          Size {item.size_name}
                        </p>
                        <ColourChip label={item.color_name} className="mt-1.5" />
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center border border-ink/20">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                            aria-label={`Decrease quantity of ${item.product_name}`}
                            className="flex h-8 w-8 items-center justify-center text-ink-soft transition-colors hover:text-crimson"
                          >
                            <Minus className="h-3 w-3" strokeWidth={2.2} />
                          </button>
                          <span className="min-w-6 text-center text-[12px] font-bold tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.variant_id, item.quantity + 1)}
                            disabled={item.quantity >= item.max_stock}
                            aria-label={`Increase quantity of ${item.product_name}`}
                            className="flex h-8 w-8 items-center justify-center text-ink-soft transition-colors hover:text-crimson disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Plus className="h-3 w-3" strokeWidth={2.2} />
                          </button>
                        </div>
                        <span className="text-[13px] font-bold tabular-nums text-ink">
                          {formatEGP(item.unit_price * item.quantity)}
                        </span>
                      </div>
                      {item.quantity >= item.max_stock ? (
                        <p className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-crimson-bright">
                          All {item.max_stock} remaining in stock
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-ink/12 pt-4">
                <dl className="space-y-2 text-[12px]">
                  <div className="flex items-baseline justify-between">
                    <dt className="tws-eyebrow text-ink-faint">Subtotal</dt>
                    <dd className="font-display text-[1.35rem] leading-none text-ink">{formatEGP(subtotal)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Delivery</dt>
                    <dd className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
                      {shipping === 0 ? 'Free' : formatEGP(shipping)}
                    </dd>
                  </div>
                </dl>

                {remaining > 0 ? (
                  <div className="mt-3">
                    <div className="h-[3px] w-full overflow-hidden rounded-full bg-ink/12">
                      <div
                        className="h-full rounded-full bg-crimson-bright transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD_EGP) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      {formatEGP(remaining)} to free delivery
                    </p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    closeDrawer();
                    navigate('/checkout');
                  }}
                  className="tws-pill mt-4 h-14 w-full justify-center"
                >
                  Checkout · cash on delivery
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
                <p className="mt-2.5 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                  Discounts applied at checkout
                </p>
              </div>
            </>
          )}
        </div>
      </Overlay>
    </>
  );
}
