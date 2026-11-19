import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock, Gift, History, Save } from 'lucide-react';
import { rpc } from '../../lib/rpc';

/** PostgREST says "Could not find the function … in the schema cache" when the
 * function is absent OR the cache is stale. Only the first is worth explaining
 * to staff, and it means a migration has not been applied. */
function isMissingFunction(message: string): boolean {
  return /could not find the function|does not exist|schema cache/i.test(message);
}

/* =========================================================
   LOYALTY PROGRAMME — the five-stamp card, configurable forward.

   The ladder customers climb: stamps 1 and 2 are regular price,
   stamp 3 unlocks 10%, stamp 4 unlocks 20%, and stamp 5 is exactly one
   free pair of pants. The free pair is the reason the card exists; it is
   locked in the database (CHECK constraint) and cannot be swapped here.

   Changes are append-only: saving writes a new programme version with a
   reason and an effective date. Progress already on customers' cards is
   never recalculated, and no past order is repriced.
   ========================================================= */

export interface LoyaltyMilestone {
  slot: number;
  reward_type: string;
  label: string;
  percent: number | null;
}

export interface LoyaltyProgramme {
  cycle_length: number;
  milestones: LoyaltyMilestone[];
  milestone_3_percent: number;
  milestone_4_percent: number;
  milestone_5_reward_type: string;
  effective_from: string;
  pending_change: {
    milestone_3_percent: number;
    milestone_4_percent: number;
    effective_from: string;
    reason: string;
  } | null;
}

interface HistoryRow {
  id: string;
  actor_email: string | null;
  action: string;
  created_at: string;
  detail: {
    milestone_3_percent?: number;
    milestone_4_percent?: number;
    milestone_5_reward_type?: string;
    effective_from?: string;
    reason?: string;
  };
}

function formatWhen(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function AdminLoyaltyProgrammePanel({ onSaved }: { onSaved?: () => void }) {
  const [programme, setProgramme] = useState<LoyaltyProgramme | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const [percent3, setPercent3] = useState('');
  const [percent4, setPercent4] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const [preview, rows] = await Promise.all([
        rpc<LoyaltyProgramme>('loyalty_program_preview'),
        rpc<HistoryRow[]>('admin_loyalty_program_history', { p_limit: 20 }),
      ]);
      setProgramme(preview);
      setHistory(rows ?? []);
      setPercent3(String(preview.milestone_3_percent));
      setPercent4(String(preview.milestone_4_percent));
      if (!effectiveFrom) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setEffectiveFrom(now.toISOString().slice(0, 16));
      }
      setState('idle');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not read the loyalty programme.');
      setState('error');
    }
  }, [effectiveFrom]);

  useEffect(() => {
    void load();
    // Loaded once on mount; saving refreshes it deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numeric3 = Number(percent3);
  const numeric4 = Number(percent4);
  const pctValid = (value: number) => Number.isFinite(value) && value > 0 && value <= 90;
  const valid =
    pctValid(numeric3) && pctValid(numeric4) && numeric4 > numeric3 && reason.trim().length >= 4;

  const changes = programme
    ? numeric3 !== Number(programme.milestone_3_percent) ||
      numeric4 !== Number(programme.milestone_4_percent)
    : true;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await rpc<LoyaltyProgramme>('admin_update_loyalty_program', {
        p_milestone_3_percent: numeric3,
        p_milestone_4_percent: numeric4,
        p_effective_from: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
        p_reason: reason.trim(),
      });
      setProgramme(next);
      setReason('');
      setConfirming(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await load();
      onSaved?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The change was not saved.');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="cms" data-testid="loyalty-programme">
      <div className="cms-head">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-ink uppercase">
            Loyalty card programme
          </h2>
          <p className="mt-1 max-w-[64ch] text-xs leading-relaxed text-ink-faint">
            Five delivered orders make a card. Stamps 1 and 2 are regular price, stamp 3 unlocks a
            discount, stamp 4 a larger one, and stamp 5 is one free pair of pants — always exactly one
            pair, and the pants are the only free item.
          </p>
        </div>
        <span className={state === 'error' ? 'cms-chip is-dirty' : 'cms-chip'}>
          <Clock className="h-3 w-3" />
          {state === 'error'
            ? 'Programme unavailable'
            : programme
              ? `In force from ${formatWhen(programme.effective_from)}`
              : 'Reading…'}
        </span>
      </div>

      {error ? (
        <div role="alert" className="cms-banner is-error">
          {isMissingFunction(error) ? (
            <>
              <p className="font-semibold">The rewards programme is not installed in this database yet.</p>
              <p className="mt-1 leading-relaxed">
                The console is deployed, but the server function it reads was not created. Apply
                <code className="mx-1">012_loyalty_delivery_unlock.sql</code> in the Supabase SQL
                editor, then reload this page. Nothing below can be read or changed until it exists —
                <strong> no customer progress or reward has been touched.</strong>
              </p>
            </>
          ) : (
            <p className="leading-relaxed">{error}</p>
          )}
          <p className="mt-1 text-[10.5px] text-ink-faint">{error}</p>
          <button type="button" className="mt-2 cms-btn" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      {state === 'loading' && !programme ? (
        <p className="text-xs text-ink-faint">Reading the current programme…</p>
      ) : programme ? (
        <ol className="grid gap-2 sm:grid-cols-5" aria-label="Ladder of rewards">
          {programme.milestones.map((milestone) => (
            <li
              key={milestone.slot}
              className={`border px-3 py-3 ${
                milestone.reward_type === 'free_pants'
                  ? 'border-crimson/45 bg-crimson/[0.04]'
                  : 'border-ink/12'
              }`}
            >
              <p className="text-[10px] tracking-[0.16em] text-ink-faint uppercase">
                Stamp {milestone.slot}
              </p>
              <p className="mt-1 text-[12.5px] font-medium text-ink">{milestone.label}</p>
              {milestone.percent ? (
                <p className="mt-0.5 text-[11px] text-ink-faint">{milestone.percent}% off</p>
              ) : null}
              {milestone.reward_type === 'free_pants' ? (
                <p className="mt-1 flex items-center gap-1 text-[10px] tracking-[0.08em] text-crimson-deep uppercase">
                  <Gift className="h-3 w-3" /> Unlocked after stamp 4
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {programme?.pending_change ? (
        <p className="cms-banner">
          A change is already scheduled for {formatWhen(programme.pending_change.effective_from)}:{' '}
          {programme.pending_change.milestone_3_percent}% and{' '}
          {programme.pending_change.milestone_4_percent}%. Saving again adds a newer version instead of
          editing it.
        </p>
      ) : null}

      <form onSubmit={submit} className="cms-fields">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="cms-field">
            <span className="cms-label">Discount on stamp 3</span>
            <span className="cms-hint">Percent off the next order when the card shows 3/5.</span>
            <input
              type="number"
              min={1}
              max={90}
              step="1"
              value={percent3}
              disabled={!programme}
              onChange={(event) => {
                setPercent3(event.target.value);
                setConfirming(false);
              }}
              className={pctValid(numeric3) ? 'tws-field' : 'tws-field is-invalid'}
              data-testid="loyalty-percent-3"
            />
          </label>
          <label className="cms-field">
            <span className="cms-label">Discount on stamp 4</span>
            <span className="cms-hint">Must be larger than stamp 3. Typically double.</span>
            <input
              type="number"
              min={1}
              max={90}
              step="1"
              value={percent4}
              disabled={!programme}
              onChange={(event) => {
                setPercent4(event.target.value);
                setConfirming(false);
              }}
              className={pctValid(numeric4) && numeric4 > numeric3 ? 'tws-field' : 'tws-field is-invalid'}
              data-testid="loyalty-percent-4"
            />
          </label>
          <label className="cms-field">
            <span className="cms-label">Applies from</span>
            <span className="cms-hint">
              Leave as now to apply immediately. A future date schedules the change; cards in progress
              are never recalculated.
            </span>
            <input
              type="datetime-local"
              value={effectiveFrom}
              disabled={!programme}
              onChange={(event) => {
                setEffectiveFrom(event.target.value);
                setConfirming(false);
              }}
              className="tws-field"
            />
          </label>
        </div>

        <label className="cms-field">
          <span className="cms-label">Reason for the change</span>
          <span className="cms-hint">
            Stored in the audit history with your email. Required — this is what explains the change
            months from now.
          </span>
          <input
            value={reason}
            disabled={!programme}
            onChange={(event) => {
              setReason(event.target.value);
              setConfirming(false);
            }}
            maxLength={300}
            placeholder="e.g. Winter campaign — reward loyal customers earlier"
            className={reason.trim().length >= 4 || reason === '' ? 'tws-field' : 'tws-field is-invalid'}
            data-testid="loyalty-reason"
          />
        </label>

        {!valid && (percent3 !== '' || percent4 !== '') ? (
          <p className="cms-error">
            {!pctValid(numeric3) || !pctValid(numeric4)
              ? 'Both discounts must be between 1% and 90%.'
              : numeric4 <= numeric3
                ? 'Stamp 4 must be a larger discount than stamp 3.'
                : 'Write a reason of at least four characters.'}
          </p>
        ) : null}

        {confirming ? (
          <div className="cms-banner" role="alert" data-testid="loyalty-confirm">
            <p className="font-semibold">Confirm the change to the rewards ladder</p>
            <p className="mt-1 leading-relaxed">
              Stamp 3 becomes <strong>{numeric3}%</strong> and stamp 4 becomes{' '}
              <strong>{numeric4}%</strong>, from {formatWhen(effectiveFrom)}.{' '}
              {changes
                ? 'Customers keep the progress they already have; their next rewards use these numbers.'
                : 'The percentages are unchanged — this saves the new version and the reason.'}{' '}
              Stamp 5 stays one free pair of pants. Nothing retroactive happens to past orders.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="submit" className="cms-btn is-primary" disabled={saving}>
                <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Yes, save this version'}
              </button>
              <button type="button" className="cms-btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="cms-actions">
            {saved ? (
              <span className="cms-chip is-saved">
                <Check className="h-3 w-3" /> Saved
              </span>
            ) : null}
            <button
              type="submit"
              className="cms-btn is-primary"
              disabled={!valid || saving || !programme}
              data-testid="loyalty-save"
            >
              <Save className="h-3.5 w-3.5" /> Review &amp; save
            </button>
          </div>
        )}
      </form>

      <div>
        <p className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] text-ink-faint uppercase">
          <History className="h-3.5 w-3.5" /> Programme history
        </p>
        {history.length ? (
          <ul className="mt-2 divide-y divide-ink/8 border border-ink/12">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span className="text-[12px] text-ink">
                  {row.detail.milestone_3_percent ?? '—'}% / {row.detail.milestone_4_percent ?? '—'}%
                  <span className="text-ink-faint"> · one free pair at stamp 5</span>
                  {row.detail.reason ? (
                    <span className="mt-0.5 block text-[11px] text-ink-faint">{row.detail.reason}</span>
                  ) : null}
                </span>
                <span className="text-[10px] text-ink-faint">
                  {formatWhen(row.created_at)}
                  {row.actor_email ? ` · ${row.actor_email}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-ink-faint">No changes recorded yet.</p>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-faint">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Stamp 5 is deliberately fixed to one free pair of pants. It cannot be replaced by a percentage
        here, because a customer who reached 4/5 has been promised a free pair.
      </p>
    </section>
  );
}
