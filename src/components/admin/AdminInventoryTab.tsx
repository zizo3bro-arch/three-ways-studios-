import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, History, Minus, Plus, RefreshCw, Save, Search } from 'lucide-react';
import { adminClient as supabase } from '../../lib/adminClient';
import { rpc } from '../../lib/rpc';
import type { Product, ProductVariant } from '../../types/database';

interface AdminInventoryTabProps {
  products: Product[];
  onRefresh: () => Promise<void>;
}

interface Movement {
  id: string;
  variant_id: string;
  product_name: string;
  color_name: string | null;
  size_name: string;
  delta: number;
  quantity_before: number;
  quantity_after: number;
  source: string;
  reason: string;
  note: string | null;
  actor_email: string | null;
  created_at: string;
}

const QUICK: Array<{ delta: number; label: string }> = [
  { delta: -5, label: '−5' },
  { delta: -1, label: '−1' },
  { delta: 1, label: '+1' },
  { delta: 5, label: '+5' },
];

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminInventoryTab({ products, onRefresh }: AdminInventoryTabProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'out'>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [targetQty, setTargetQty] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const out: Array<{ product: Product; variant: ProductVariant }> = [];
    for (const product of products) {
      for (const variant of product.variants ?? []) {
        if (filterMode === 'low' && variant.stock_quantity > variant.low_stock_threshold) continue;
        if (filterMode === 'out' && variant.stock_quantity > 0) continue;
        if (term) {
          const haystack = [
            product.name,
            product.slug,
            product.category,
            variant.color_name,
            variant.size_name,
            variant.sku,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(term)) continue;
        }
        out.push({ product, variant });
      }
    }
    return out;
  }, [products, filterMode, query]);

  const totals = useMemo(() => {
    const all = products.flatMap((product) => product.variants ?? []);
    return {
      units: all.reduce((sum, variant) => sum + Math.max(0, variant.stock_quantity), 0),
      low: all.filter(
        (variant) => variant.stock_quantity > 0 && variant.stock_quantity <= variant.low_stock_threshold
      ).length,
      out: all.filter((variant) => variant.stock_quantity <= 0).length,
    };
  }, [products]);

  const loadLedger = useCallback(async () => {
    if (!supabase) return;
    setLoadingLedger(true);
    setLedgerError(null);
    try {
      const data = await rpc<Movement[]>('admin_list_stock_movements', { p_limit: 60 });
      setMovements(data ?? []);
    } catch (loadError) {
      setLedgerError(loadError instanceof Error ? loadError.message : 'Could not load the ledger.');
    } finally {
      setLoadingLedger(false);
    }
  }, []);

  useEffect(() => {
    if (ledgerOpen) void loadLedger();
  }, [ledgerOpen, loadLedger]);

  const openAdjust = (variant: ProductVariant, preset = 0) => {
    setEditing(variant.id);
    setTargetQty(Math.max(0, variant.stock_quantity + preset));
    setReason('');
    setNote('');
    setError(null);
  };

  const submitAdjust = async (variant: ProductVariant) => {
    if (!supabase) return;
    const delta = targetQty - variant.stock_quantity;
    if (delta === 0) {
      setError('Change the quantity before saving — a zero adjustment is not a stock movement.');
      return;
    }
    if (!reason.trim()) {
      setError('Add a short reason so the ledger explains this change.');
      return;
    }
    setSavingId(variant.id);
    setError(null);
    try {
      await rpc('admin_adjust_stock', {
        p_variant_id: variant.id,
        p_delta: delta,
        p_reason: reason.trim(),
        p_note: note.trim() || null,
      });
      setSavedId(variant.id);
      setEditing(null);
      setTimeout(() => setSavedId(null), 1800);
      await onRefresh();
      if (ledgerOpen) await loadLedger();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The adjustment was not saved.');
    } finally {
      setSavingId(null);
    }
  };

  const exportRows = () => {
    const header = ['Product', 'Category', 'Colour', 'Size', 'SKU', 'Stock', 'Low stock threshold', 'Status'];
    const body = rows.map(({ product, variant }) => [
      product.name,
      product.category,
      variant.color_name,
      variant.size_name,
      variant.sku ?? '',
      String(variant.stock_quantity),
      String(variant.low_stock_threshold),
      variant.stock_quantity <= 0 ? 'Out of stock' : variant.stock_quantity <= variant.low_stock_threshold ? 'Low' : 'In stock',
    ]);
    downloadCsv(`three-ways-inventory-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-ink uppercase">Inventory</h2>
          <p className="mt-1 max-w-[60ch] text-xs text-ink-faint">
            Stock by product and size. Every change is a movement with a reason, an author and a time —
            nothing is overwritten silently.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLedgerOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 border border-ink/20 px-4 py-1.5 text-[11px] tracking-[0.14em] text-ink uppercase hover:border-crimson"
            data-testid="inventory-ledger-toggle"
          >
            <History className="h-3.5 w-3.5" /> {ledgerOpen ? 'Hide history' : 'Stock history'}
          </button>
          <button
            type="button"
            onClick={exportRows}
            className="inline-flex items-center gap-1.5 border border-ink/20 px-4 py-1.5 text-[11px] tracking-[0.14em] text-ink uppercase hover:border-crimson"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        {[
          { label: 'Units on hand', value: totals.units },
          { label: 'Low stock', value: totals.low },
          { label: 'Out of stock', value: totals.out },
        ].map((stat) => (
          <div key={stat.label} className="border border-ink/12 px-4 py-3">
            <p className="text-[10px] tracking-[0.16em] text-ink-faint uppercase">{stat.label}</p>
            <p className="mt-1 font-display text-xl text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, colour, size or SKU"
            aria-label="Search inventory"
            className="w-full border border-ink/15 bg-paper/50 py-2 pr-3 pl-9 text-xs text-ink"
          />
        </label>
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'low', label: 'Low stock' },
            { id: 'out', label: 'Out of stock' },
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
        <div className="border border-ink/12 p-10 text-center text-xs text-ink-faint">
          {query || filterMode !== 'all'
            ? 'No variants match this search or filter.'
            : 'No variants yet — add sizes to a product first.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-ink/12">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-ink/12 text-[10px] tracking-[0.18em] text-ink-faint uppercase">
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Colour</th>
                <th className="p-4 font-medium">Size</th>
                <th className="p-4 font-medium">SKU</th>
                <th className="p-4 font-medium">On hand</th>
                <th className="p-4 text-right font-medium">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8">
              {rows.map(({ product, variant }) => {
                const isOut = variant.stock_quantity <= 0;
                const isLow = !isOut && variant.stock_quantity <= variant.low_stock_threshold;
                const isEditing = editing === variant.id;
                return (
                  <tr key={variant.id} className={isEditing ? 'bg-crimson/[0.03]' : undefined}>
                    <td className="p-4 align-top font-medium text-ink">
                      {product.name}
                      <span className="mt-0.5 block text-[10px] font-normal tracking-[0.1em] text-ink-faint uppercase">
                        {product.category}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <span className="inline-flex items-center gap-2 text-ink-soft">
                        <span
                          className="h-3 w-3 rounded-full border border-ink/25"
                          style={{ backgroundColor: variant.color_hex }}
                        />
                        {variant.color_name}
                      </span>
                    </td>
                    <td className="p-4 align-top text-ink-soft">{variant.size_name}</td>
                    <td className="p-4 align-top font-mono text-ink-faint">{variant.sku || '—'}</td>
                    <td className="p-4 align-top">
                      <span className={isOut ? 'font-medium text-crimson-deep' : 'text-ink'}>
                        {variant.stock_quantity}
                      </span>
                      {isOut ? (
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-crimson-deep">
                          <AlertTriangle className="h-3 w-3" /> Out of stock
                        </span>
                      ) : isLow ? (
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-crimson-deep">
                          <AlertTriangle className="h-3 w-3" /> Low (floor {variant.low_stock_threshold})
                        </span>
                      ) : null}
                      {isEditing ? (
                        <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] tracking-[0.12em] text-ink-faint uppercase">
                              Set to
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={targetQty}
                              onChange={(event) => setTargetQty(Math.max(0, Number(event.target.value)))}
                              aria-label={`New stock for ${product.name} ${variant.size_name}`}
                              className="w-20 border border-ink/15 bg-paper/60 px-2 py-1 text-xs"
                            />
                            {QUICK.map((quick) => (
                              <button
                                key={quick.delta}
                                type="button"
                                onClick={() => setTargetQty((value) => Math.max(0, value + quick.delta))}
                                className="border border-ink/15 px-2 py-1 text-[11px] text-ink-soft hover:border-crimson"
                              >
                                {quick.label}
                              </button>
                            ))}
                            <span className="text-[10px] text-ink-faint">
                              ({targetQty - variant.stock_quantity >= 0 ? '+' : ''}
                              {targetQty - variant.stock_quantity})
                            </span>
                          </div>
                          <input
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Reason (required) — e.g. delivery from atelier"
                            aria-label={`Reason for ${product.name} ${variant.size_name}`}
                            maxLength={160}
                            className="w-full border border-ink/15 bg-paper/60 px-2 py-1 text-xs"
                          />
                          <input
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Note (optional)"
                            aria-label={`Note for ${product.name} ${variant.size_name}`}
                            maxLength={300}
                            className="w-full border border-ink/15 bg-paper/60 px-2 py-1 text-xs"
                          />
                        </div>
                      ) : null}
                    </td>
                    <td className="p-4 text-right align-top">
                      {isEditing ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            disabled={savingId === variant.id}
                            onClick={() => void submitAdjust(variant)}
                            className="inline-flex items-center gap-1.5 bg-crimson px-3 py-1 text-[11px] text-paper uppercase"
                          >
                            <Save className="h-3 w-3" /> {savingId === variant.id ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="text-[11px] text-ink-faint hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {savedId === variant.id ? (
                            <span className="text-[10px] tracking-[0.12em] text-emerald-800 uppercase">
                              Updated
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openAdjust(variant, -1)}
                            aria-label={`Decrease ${product.name} ${variant.size_name}`}
                            className="border border-ink/20 p-1.5 text-ink-soft hover:border-crimson"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjust(variant, 1)}
                            aria-label={`Increase ${product.name} ${variant.size_name}`}
                            className="border border-ink/20 p-1.5 text-ink-soft hover:border-crimson"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjust(variant)}
                            className="border border-ink/20 px-3 py-1 text-[11px] text-ink hover:border-crimson"
                          >
                            Adjust
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {ledgerOpen ? (
        <section className="border border-ink/12" data-testid="inventory-ledger">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/12 px-4 py-3">
            <div>
              <h3 className="text-[11px] tracking-[0.18em] text-ink uppercase">Stock history</h3>
              <p className="mt-1 text-[11px] text-ink-faint">
                Newest first. Automatic rows come from orders and cancellations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadLedger()}
              className="inline-flex items-center gap-1.5 text-[11px] tracking-[0.12em] text-ink-faint uppercase hover:text-crimson"
            >
              <RefreshCw className={`h-3 w-3 ${loadingLedger ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </header>
          {ledgerError ? (
            <p role="alert" className="p-4 text-xs text-crimson-deep">
              {ledgerError}
            </p>
          ) : loadingLedger && !movements.length ? (
            <p className="p-4 text-xs text-ink-faint">Loading movements…</p>
          ) : movements.length === 0 ? (
            <p className="p-4 text-xs text-ink-faint">
              No movements yet. Order fulfilments and manual adjustments will appear here.
            </p>
          ) : (
            <ol className="divide-y divide-ink/8">
              {movements.map((movement) => (
                <li key={movement.id} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs text-ink">
                      {movement.product_name}{' '}
                      <span className="text-ink-faint">
                        · {movement.size_name}
                        {movement.color_name ? ` · ${movement.color_name}` : ''}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {movement.reason}
                      {movement.note ? ` — ${movement.note}` : ''}
                      {movement.actor_email ? ` · ${movement.actor_email}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xs font-medium ${
                        movement.delta < 0 ? 'text-crimson-deep' : 'text-emerald-800'
                      }`}
                    >
                      {movement.delta > 0 ? '+' : ''}
                      {movement.delta} → {movement.quantity_after}
                    </p>
                    <p className="text-[10px] text-ink-faint">
                      {new Date(movement.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}
