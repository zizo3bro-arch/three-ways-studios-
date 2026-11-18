import { useState } from 'react';
import { AlertTriangle, Check, Save } from 'lucide-react';
import { adminClient as supabase } from '../../lib/adminClient';
import type { Product, ProductVariant } from '../../types/database';

interface AdminInventoryTabProps {
  products: Product[];
  onRefresh: () => Promise<void>;
}

export function AdminInventoryTab({ products, onRefresh }: AdminInventoryTabProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'out'>('all');
  const [draftStock, setDraftStock] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const rows: Array<{ product: Product; variant: ProductVariant }> = [];
  for (const p of products) {
    for (const v of p.variants ?? []) {
      if (filterMode === 'low' && v.stock_quantity > v.low_stock_threshold) continue;
      if (filterMode === 'out' && v.stock_quantity > 0) continue;
      rows.push({ product: p, variant: v });
    }
  }

  const handleSaveStock = async (variant: ProductVariant) => {
    if (!supabase) return;
    const nextQty = draftStock[variant.id] ?? variant.stock_quantity;
    setSavingId(variant.id);
    setError(null);
    const { data, error } = await supabase
      .from('product_variants')
      .update({ stock_quantity: Math.max(0, nextQty) })
      .eq('id', variant.id)
      .eq('updated_at', variant.updated_at)
      .select('id')
      .maybeSingle();
    setSavingId(null);
    if (error || !data) {
      setError(error?.message || 'Stock changed or access was lost. Refresh and review before saving.');
      return;
    }
    setDraftStock((previous) => {
      const next = { ...previous };
      delete next[variant.id];
      return next;
    });
    setSavedId(variant.id);
    setTimeout(() => setSavedId(null), 1500);
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-ink uppercase">Inventory Matrix</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Track and update live stock quantities for every color and size variant.
          </p>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All Variants' },
            { id: 'low', label: 'Low Stock' },
            { id: 'out', label: 'Out of Stock' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id as 'all' | 'low' | 'out')}
              className={`rounded-full px-4 py-1.5 text-xs ${
                filterMode === tab.id
                  ? 'bg-crimson font-medium text-paper'
                  : 'border border-ink/20 text-ink-soft'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-crimson-deep">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <div className="border border-ink/12 bg-transparent p-10 text-center text-xs text-ink-faint">
          No variants match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto border border-ink/12 bg-transparent">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead>
              <tr className="border-b border-ink/12 text-[10px] tracking-[0.18em] text-ink-faint uppercase">
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Color</th>
                <th className="p-4 font-medium">Size</th>
                <th className="p-4 font-medium">SKU</th>
                <th className="p-4 font-medium">Stock Level</th>
                <th className="p-4 text-right font-medium">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {rows.map(({ product, variant }) => {
                const val = draftStock[variant.id] ?? variant.stock_quantity;
                const isLow = variant.stock_quantity <= variant.low_stock_threshold;
                return (
                  <tr key={variant.id}>
                    <td className="p-4 font-medium text-ink">{product.name}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-2 text-ink-soft">
                        <span
                          className="h-3 w-3 rounded-full border border-ink/25"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                        {variant.color_name}
                      </span>
                    </td>
                    <td className="p-4 text-ink-soft">{variant.size_name}</td>
                    <td className="p-4 font-mono text-ink-faint">{variant.sku || '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={`Stock for ${product.name}, ${variant.color_name}, size ${variant.size_name}`}
                          type="number"
                          min="0"
                          value={val}
                          onChange={(e) =>
                            setDraftStock((prev) => ({
                              ...prev,
                              [variant.id]: Number(e.target.value),
                            }))
                          }
                          className="w-20 border border-ink/15 bg-paper/50 px-2.5 py-1 text-xs text-ink"
                        />
                        {isLow && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-crimson-deep">
                            <AlertTriangle className="h-3 w-3" />
                            {variant.stock_quantity === 0 ? 'Out' : 'Low'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        disabled={savingId === variant.id}
                        onClick={() => handleSaveStock(variant)}
                        className="inline-flex items-center gap-1.5 border border-ink/20 px-3 py-1 text-[11px] text-ink hover:border-crimson"
                      >
                        {savedId === variant.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-800" /> Saved
                          </>
                        ) : (
                          <>
                            <Save className="h-3 w-3" /> Save
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
