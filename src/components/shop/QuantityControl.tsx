import { Minus, Plus } from 'lucide-react';

export function QuantityControl({
  value,
  max,
  onChange,
  name = 'piece',
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  name?: string;
}) {
  return (
    <div className="quantity-control" role="group" aria-label={`Quantity of ${name}`}>
      <button
        type="button"
        aria-label={`Decrease quantity of ${name}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        aria-label={`Increase quantity of ${name}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </button>
    </div>
  );
}
