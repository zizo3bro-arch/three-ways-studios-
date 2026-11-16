import { useState } from 'react';
import { AlertTriangle, Check, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
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
    await supabase
      .from('product_variants')
      .update({ stock_quantity: Math.max(0, nextQty) })
      .eq('id', variant.id);
    setSavingId(null);
    setSavedId(variant.id);
    setTimeout(() => setSavedId(null), 1500);
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-white uppercase">
            Inventory Matrix
          </h2>
          <p className="mt-1 text-xs text-[#9e9494]">
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
                  ? 'bg-[#e6dada] font-medium text-[#0c0708]'
                  : 'border border-white/20 text-[#cfc6c6]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="border border-white/12 bg-black/40 p-10 text-center text-xs text-[#9e9494]">
          No variants match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/12 bg-black/45">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/12 text-[10px] tracking-[0.18em] text-[#9e9494] uppercase">
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Color</th>
                <th className="p-4 font-medium">Size</th>
                <th className="p-4 font-medium">SKU</th>
                <th className="p-4 font-medium">Stock Level</th>
                <th className="p-4 text-right font-medium">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {rows.map(({ product, variant }) => {
                const val = draftStock[variant.id] ?? variant.stock_quantity;
                const isLow = variant.stock_quantity <= variant.low_stock_threshold;
                return (
                  <tr key={variant.id}>
                    <td className="p-4 font-medium text-white">{product.name}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-2 text-[#e6dfdf]">
                        <span
                          className="h-3 w-3 rounded-full border border-white/25"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                        {variant.color_name}
                      </span>
                    </td>
                    <td className="p-4 text-[#e6dfdf]">{variant.size_name}</td>
                    <td className="p-4 font-mono text-[#847878]">{variant.sku || '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={val}
                          onChange={(e) =>
                            setDraftStock((prev) => ({
                              ...prev,
                              [variant.id]: Number(e.target.value),
                            }))
                          }
                          className="w-20 border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-white"
                        />
                        {isLow && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#e89d6b]">
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
                        className="inline-flex items-center gap-1.5 border border-white/20 px-3 py-1 text-[11px] text-white hover:border-[#d4121b]"
                      >
                        {savedId === variant.id ? (
                          <>
                            <Check className="h-3 w-3 text-[#7bd389]" /> Saved
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
