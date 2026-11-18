import { Link } from 'react-router-dom';
import { Overlay } from '../ui/Overlay';
import type { Product } from '../../types/database';

export function SizeGuideModal({
  open,
  product,
  onClose,
  onOpenFitCalculator,
}: {
  open: boolean;
  product: Product;
  onClose: () => void;
  onOpenFitCalculator: () => void;
}) {
  const rows = product.size_charts ?? [];
  const measurements = ['waist_cm', 'hip_cm', 'thigh_cm', 'inseam_cm', 'length_cm'] as const;
  const columns = measurements.filter((k) => rows.some((r) => r[k]));
  return (
    <Overlay open={open} onClose={onClose} label="Size guide" placement="sheet">
      <div className="overflow-y-auto pb-4">
        <h2 className="section-label">Size guide</h2>
        <p className="my-3">{product.name}</p>
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="size-table">
              <caption>Garment measurements in centimetres</caption>
              <thead>
                <tr>
                  <th>Size</th>
                  {columns.map((k) => (
                    <th key={k}>{k.split('_')[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th>{row.size_name}</th>
                    {columns.map((k) => (
                      <td key={k}>{row[k] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="form-note">
            No measurements have been published for this piece.{' '}
            <Link onClick={onClose} className="text-action" to="/about#fit">
              House fit guide
            </Link>
          </p>
        )}
        {product.fit_info && <p className="my-4 text-sm">{product.fit_info}</p>}
        {/pants|denim|flare|trouser/i.test(
          [product.name, product.category, product.fit_info].join(' ')
        ) && (
          <button className="tws-pill mt-4" onClick={onOpenFitCalculator}>
            Find my size
          </button>
        )}
      </div>
    </Overlay>
  );
}
