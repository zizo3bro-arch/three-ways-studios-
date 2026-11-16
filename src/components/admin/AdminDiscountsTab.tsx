import { useState } from 'react';
import { Plus, Power, Trash2 } from 'lucide-react';
import { formatEGP } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { DiscountRule } from '../../types/database';

interface AdminDiscountsTabProps {
  discounts: DiscountRule[];
  onRefresh: () => Promise<void>;
}

export function AdminDiscountsTab({ discounts, onRefresh }: AdminDiscountsTabProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('15');
  const [minOrder, setMinOrder] = useState('0');
  const [maxUses, setMaxUses] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setSaving(true);

    const { error: insErr } = await supabase.from('discount_rules').insert({
      code: code.trim().toUpperCase(),
      name: name.trim() || `Promo ${code.trim().toUpperCase()}`,
      rule_type: 'promo_code',
      discount_percent: Number(percent),
      min_order_amount: Number(minOrder) || 0,
      max_uses: maxUses.trim() ? Number(maxUses) : null,
      is_active: true,
    });

    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    setCode('');
    setName('');
    setPercent('15');
    setMinOrder('0');
    setMaxUses('');
    await onRefresh();
  };

  const handleToggleRule = async (rule: DiscountRule) => {
    if (!supabase) return;
    await supabase
      .from('discount_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    await onRefresh();
  };

  const handleUpdateEmailPercent = async (rule: DiscountRule, newPercent: number) => {
    if (!supabase || !Number.isFinite(newPercent) || newPercent <= 0 || newPercent > 100) return;
    await supabase
      .from('discount_rules')
      .update({ discount_percent: newPercent })
      .eq('id', rule.id);
    await onRefresh();
  };

  const handleDeleteRule = async (rule: DiscountRule) => {
    if (!supabase) return;
    if (rule.rule_type === 'email_auto') return;
    await supabase.from('discount_rules').delete().eq('id', rule.id);
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-medium tracking-[0.2em] text-white uppercase">
          Discounts &amp; Email Checkout Rules
        </h2>
        <p className="mt-1 text-xs text-[#9e9494]">
          All discount percentages are validated securely inside PostgreSQL during checkout.
        </p>
      </div>

      {/* Create New Promo Code */}
      <form
        onSubmit={handleCreatePromo}
        className="border border-white/12 bg-black/45 p-5 space-y-4"
      >
        <h3 className="text-xs font-medium tracking-[0.18em] text-white uppercase">
          Create Promo Code
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code (e.g. PANTHER15)"
            className="border border-white/15 bg-black/50 px-3 py-2 text-xs text-white uppercase"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Label"
            className="border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
          <input
            type="number"
            min="1"
            max="90"
            required
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="% Off"
            className="border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
          <input
            type="number"
            min="0"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            placeholder="Min EGP (0)"
            className="border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
          <input
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Max uses (optional)"
            className="border border-white/15 bg-black/50 px-3 py-2 text-xs text-white"
          />
        </div>
        {error && <p className="text-xs text-[#ff7575]">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-[#b30e16] px-5 py-2 text-xs font-medium tracking-[0.16em] text-white uppercase hover:bg-[#d4121b]"
        >
          <Plus className="h-3.5 w-3.5" />
          {saving ? 'Creating...' : 'Create Promo Code'}
        </button>
      </form>

      {/* Active & Inactive Rules */}
      <div className="space-y-3">
        {discounts.map((rule) => (
          <div
            key={rule.id}
            className="flex flex-wrap items-center justify-between gap-4 border border-white/12 bg-black/45 p-4 text-xs"
          >
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-semibold text-white">
                  {rule.code || 'EMAIL_AUTO'}
                </span>
                <span className="border border-white/15 px-2 py-0.5 text-[10px] tracking-[0.12em] text-[#cfc6c6] uppercase">
                  {rule.rule_type === 'email_auto' ? 'Auto Email Discount' : 'Promo Code'}
                </span>
                <span className="text-[#e87a80]">{rule.discount_percent}% OFF</span>
              </div>
              <p className="mt-1 text-[11px] text-[#9e9494]">
                {rule.name} · Min order {formatEGP(rule.min_order_amount)} · Uses:{' '}
                {rule.uses_count}
                {rule.max_uses ? ` / ${rule.max_uses}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {rule.rule_type === 'email_auto' && (
                <select
                  value={rule.discount_percent}
                  onChange={(e) => handleUpdateEmailPercent(rule, Number(e.target.value))}
                  aria-label="Email discount percentage"
                  className="border border-white/15 bg-[#0c0708] px-2 py-1 text-xs text-white"
                >
                  {[5, 10, 15, 20].map((pct) => (
                    <option key={pct} value={pct}>
                      {pct}%
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => handleToggleRule(rule)}
                className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] uppercase ${
                  rule.is_active
                    ? 'border-[#7bd389]/45 text-[#9ae6a6]'
                    : 'border-white/20 text-[#9e9494]'
                }`}
              >
                <Power className="h-3 w-3" />
                {rule.is_active ? 'Active' : 'Inactive'}
              </button>

              {rule.rule_type !== 'email_auto' && (
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule)}
                  aria-label={`Delete ${rule.code}`}
                  className="border border-white/15 p-1.5 text-[#9e9494] hover:text-[#ff6b6b]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
