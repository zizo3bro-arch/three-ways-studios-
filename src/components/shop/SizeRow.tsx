import { sizeOptionsFor } from '../../data/catalog';
import type { Product } from '../../types/database';

export function SizeRow({
  product,
  color,
  value,
  onChange,
}: {
  product: Product;
  color: string;
  value: string;
  onChange: (size: string) => void;
}) {
  const variants = sizeOptionsFor(product, color);
  return (
    <div className="choice-list" role="group" aria-label="Available sizes">
      {variants.length ? (
        variants.map((v) => (
          <button
            type="button"
            className="choice"
            key={v.id}
            aria-pressed={v.size_name === value}
            disabled={v.stock_quantity <= 0}
            onClick={() => onChange(v.size_name)}
          >
            {v.size_name}
          </button>
        ))
      ) : (
        <span>Unavailable</span>
      )}
    </div>
  );
}
