import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, Plus } from 'lucide-react';
import {
  colorOptionsFor,
  firstAvailableColor,
  firstAvailableSize,
  primaryImage,
  resolveVariant,
} from '../../data/catalog';
import { formatEGP } from '../../lib/format';
import { useAddToBag } from '../../hooks/useAddToBag';
import { useWishlist } from '../../context/WishlistContext';
import type { Product } from '../../types/database';
import { QuantityControl } from './QuantityControl';
import { SizeRow } from './SizeRow';
import { SizeGuideModal } from './SizeGuideModal';
import { FindSizeModal } from '../FindSizeModal';

export function PurchaseOptions({
  product,
  onImage,
  onAdded,
}: {
  product: Product;
  onImage?: (url?: string) => void;
  onAdded?: () => void;
}) {
  const colors = useMemo(() => colorOptionsFor(product), [product]);
  const [color, setColor] = useState(() => firstAvailableColor(product));
  const [size, setSize] = useState(() => firstAvailableSize(product, color));
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState<'guide' | 'fit' | null>(null);
  const [note, setNote] = useState('');
  const { isWishlisted, toggleWishlist } = useWishlist();
  const add = useAddToBag();
  const navigate = useNavigate();
  const stock = resolveVariant(product, size, color)?.stock_quantity ?? 0;
  const quantity = Math.min(qty, Math.max(1, stock));
  const saved = isWishlisted(product.id);
  function buy(direct = false) {
    const result = add(product, size, { colorName: color, quantity, openDrawer: !direct });
    if (!result.ok) {
      setNote(result.message || 'This variant is unavailable.');
      return;
    }
    onAdded?.();
    if (direct) navigate('/checkout');
  }
  return (
    <div className="purchase">
      <div className="piece-title">
        <h1>{product.name}</h1>
        <button
          className="icon-action"
          aria-label={saved ? 'Unsave piece' : 'Save piece'}
          aria-pressed={saved}
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <p className="piece-price">
        {formatEGP(product.price)}{' '}
        {product.original_price && product.original_price > product.price ? (
          <del>{formatEGP(product.original_price)}</del>
        ) : null}
      </p>
      {product.description && <p className="piece-description">{product.description}</p>}
      {colors.length > 0 && (
        <div className="option-row">
          <span className="option-label">Color</span>
          <div className="choice-list" role="group" aria-label="Available colors">
            {colors.map((c) =>
              colors.length === 1 ? (
                <span key={c} className="only-color">
                  {c}
                </span>
              ) : (
                <button
                  className="choice"
                  key={c}
                  aria-pressed={c === color}
                  onClick={() => {
                    setColor(c);
                    setSize(firstAvailableSize(product, c));
                    setQty(1);
                    setNote('');
                    onImage?.(primaryImage(product, c)?.url);
                  }}
                >
                  {c}
                </button>
              )
            )}
          </div>
        </div>
      )}
      <div className="option-row">
        <div>
          <span className="option-label">Size</span>
          <button className="size-guide-link" onClick={() => setGuide('guide')}>
            Size guide
          </button>
        </div>
        <SizeRow
          product={product}
          color={color}
          value={size}
          onChange={(s) => {
            setSize(s);
            setQty(1);
            setNote('');
          }}
        />
      </div>
      <div className="option-row">
        <span className="option-label">Quantity</span>
        <QuantityControl name={product.name} value={quantity} max={stock} onChange={setQty} />
      </div>
      <button className="tws-pill wide-action" disabled={stock < 1} onClick={() => buy()}>
        {stock ? 'Add to bag' : 'Sold out'} <ArrowRight />
      </button>
      {note && (
        <p className="form-note" role="status">
          {note}
        </p>
      )}
      <div className="piece-details">
        {[
          [
            'Product details',
            [product.fabric_info, product.fit_info].filter(Boolean).join(' · ') ||
              product.description ||
              'No additional details supplied.',
          ],
          [
            'Shipping & returns',
            'Cash on delivery across Egypt. Shipping is confirmed at checkout. Returns within 14 days, unworn with tags.',
          ],
          [
            'Care instructions',
            product.care_instructions || 'Follow the care label inside the garment.',
          ],
        ].map(([label, text], i) => (
          <details key={label}>
            <summary>
              {label}
              <Plus />
            </summary>
            <p>{text}</p>
            {i === 0 && stock > 0 && (
              <button className="text-action" onClick={() => buy(true)}>
                Buy now — cash on delivery
              </button>
            )}
          </details>
        ))}
      </div>
      <SizeGuideModal
        open={guide === 'guide'}
        product={product}
        onClose={() => setGuide(null)}
        onOpenFitCalculator={() => setGuide('fit')}
      />
      <FindSizeModal
        open={guide === 'fit'}
        currentSize={size}
        onClose={() => setGuide(null)}
        onApply={(s) => {
          if ((resolveVariant(product, s, color)?.stock_quantity ?? 0) > 0) {
            setSize(s);
            setQty(1);
          } else setNote(`Recommended size ${s} is unavailable in ${color}.`);
        }}
      />
    </div>
  );
}
