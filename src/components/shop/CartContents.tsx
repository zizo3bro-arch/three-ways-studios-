import { ArrowRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useContentBlock } from '../../context/SiteSettingsContext';
import { formatEGP } from '../../lib/format';
import { QuantityControl } from './QuantityControl';

/** The bag drawer and the addressable /cart spread share one cart and all its actions. */
export function CartContents({ drawer = false }: { drawer?: boolean }) {
  const { items, updateQuantity, removeItem, subtotal, closeDrawer } = useCart();
  const emptyBag = useContentBlock('cart.empty', 'Your bag is empty.');
  const Title = drawer ? 'h2' : 'h1';
  return (
    <div className="cart-content">
      <div className="cart-heading">
        <Title>Your cart</Title>
        <Link className="text-action" to={drawer ? '/cart' : '/shop'} onClick={closeDrawer}>
          {drawer ? 'View full cart' : 'Continue shopping'} <ArrowRight />
        </Link>
      </div>
      {!items.length ? (
        <div className="cart-empty">
          <p>{emptyBag}</p>
          <Link className="tws-pill" to="/shop" onClick={closeDrawer}>
            Continue shopping <ArrowRight />
          </Link>
        </div>
      ) : (
        <>
          <ul className="cart-lines">
            {items.map((line) => (
              <li key={line.variant_id}>
                <Link
                  className="cart-photo"
                  to={`/product/${line.product_slug}`}
                  onClick={closeDrawer}
                  aria-label={`View ${line.product_name}`}
                >
                  {line.product_image && <img src={line.product_image} alt="" loading="lazy" />}
                </Link>
                <div className="cart-item-copy">
                  <Link to={`/product/${line.product_slug}`} onClick={closeDrawer}>
                    {line.product_name}
                  </Link>
                  <p>{formatEGP(line.unit_price)}</p>
                  <small>
                    Size: {line.size_name} · {line.color_name}
                  </small>
                </div>
                <div className="cart-line-actions">
                  <QuantityControl
                    value={line.quantity}
                    max={line.max_stock}
                    name={line.product_name}
                    onChange={(n) => updateQuantity(line.variant_id, n)}
                  />
                  <button
                    className="icon-action"
                    aria-label={`Remove ${line.product_name}`}
                    onClick={() => removeItem(line.variant_id)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <dl className="cart-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatEGP(subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>Calculated at checkout</dd>
            </div>
            <div className="cart-total">
              <dt>Total</dt>
              <dd>{formatEGP(subtotal)}</dd>
            </div>
          </dl>
          <Link className="tws-pill wide-action" to="/checkout" onClick={closeDrawer}>
            Proceed to checkout <ArrowRight />
          </Link>
          <div className="or-rule">Or</div>
          <Link className="tws-pill tws-pill--outline wide-action" to="/shop" onClick={closeDrawer}>
            Continue shopping
          </Link>
        </>
      )}
    </div>
  );
}
